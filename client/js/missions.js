// client/js/missions.js — missions panel and NVDA unlock flow.
// Reads missions from the server (via client/src/store.js), shows
// progress, claim buttons, and a one-time unlock animation when the
// AAPL chain is complete.

import { store } from '../src/store.js';
import { getActiveTicker, setActiveTicker } from './aim-bridge.js';
import {
  MISSIONS, missionProgress, allMissionsClaimed,
  describeUnlocks, formatProgress, NVDA_UNLOCK,
} from '../src/missions-core.js';

const SELECTORS = {
  root: '#vibes-missions',
  body: '[data-vm-body]',
  total: '[data-vm-total]',
  claimed: '[data-vm-claimed]',
  unlockCard: '[data-vm-unlock-card]',
  unlockTicker: '[data-vm-unlock-ticker]',
  unlockBtn: '[data-vm-unlock-btn]',
};

const MISSION_GROUPS = {
  first_10_hits: 'Aim',
  earn_half_aapl: 'Aim',
  first_trade: 'Trading',
  first_profit: 'Trading',
  hold_60s: 'Trading',
  precise_session: 'Aim',
};

function missionGroup(kind) { return MISSION_GROUPS[kind] || 'Objective'; }
function setText(el, value) { if (el) el.textContent = value; }

export function mountMissions({ root, onTickerUnlocked } = {}) {
  const panel = root || document.querySelector(SELECTORS.root);
  if (!panel) return { unmount() {}, state: null };
  // Do NOT auto-show the panel here. The user opens it via the bottom-left
  // tab button. Showing on mount would cover the engine menu and the chart
  // panel. The host page is expected to set `hidden` on the markup; we
  // leave it alone.

  const els = {};
  for (const [k, sel] of Object.entries(SELECTORS)) els[k] = panel.querySelector(sel);

  let unlockedThisSession = false;
  let lastUnlocks = new Set();
  let activeFilter = 'all';

  function renderMissions() {
    if (!els.body) return;
    els.body.innerHTML = '';
    const missions = store.state.missions || [];
    const visibleDefs = MISSIONS.filter((def) => {
      if (activeFilter === 'all') return true;
      const live = missions.find((m) => m.kind === def.kind) || {};
      if (activeFilter === 'completed') return Boolean(live.claimed);
      return missionGroup(def.kind).toLowerCase() === activeFilter;
    });
    for (const def of visibleDefs) {
      const live = missions.find((m) => m.kind === def.kind) || { kind: def.kind, progress: 0, done: false, claimed: false };
      const tr = document.createElement('tr');
      tr.dataset.vmKind = def.kind;
      const pct = def.target > 0 ? Math.min(1, (live.progress || 0) / def.target) : 0;
      const barWidth = `${Math.round(pct * 100)}%`;
      const statusLabel = live.claimed ? 'claimed' : (live.done ? 'complete' : 'in progress');
      const statusClass = live.claimed ? 'claimed' : (live.done ? 'done' : '');
      const claimControl = live.done && !live.claimed
        ? `<button type="button" class="vm-claim-btn" data-vm-claim="${def.kind}">Claim</button>`
        : '';
      tr.innerHTML = `
        <td class="vm-mission-cell">
          <div class="vm-mission-top"><div class="vm-label">${def.label}</div><div class="vm-reward num">+${def.reward}</div></div>
          <div class="vm-mission-meta"><span class="vm-group">${missionGroup(def.kind)}</span><span class="vm-progress-value num">${formatProgress(def, live.progress || 0)}</span><span class="vm-status ${statusClass}">${statusLabel}</span>${claimControl}</div>
          <div class="vm-progress" aria-label="${formatProgress(def, live.progress || 0)} progress"><span class="vm-bar" style="width:${barWidth}"></span></div>
        </td>
      `;
      els.body.appendChild(tr);
    }
    if (!visibleDefs.length) {
      els.body.innerHTML = '<tr class="vm-empty"><td>No completed missions yet.</td></tr>';
    }
    // wire claim buttons
    els.body.querySelectorAll('[data-vm-claim]').forEach((btn) => {
      btn.addEventListener('click', () => claim(btn.dataset.vmClaim));
    });

    // top counters
    const claimed = missions.filter((m) => m.claimed).length;
    setText(els.claimed, claimed);
    setText(els.total, MISSIONS.length);
    document.querySelectorAll('[data-vm-side-claimed]').forEach((el) => { el.textContent = claimed; });
    document.querySelectorAll('[data-vm-side-total]').forEach((el) => { el.textContent = MISSIONS.length; });
    const sideBar = document.querySelector('[data-vm-side-bar]');
    if (sideBar) sideBar.style.width = `${Math.round((claimed / MISSIONS.length) * 100)}%`;
    const roadCount = document.getElementById('overall-imp');
    const roadBar = document.getElementById('goalbar');
    setText(roadCount, `${claimed} / ${MISSIONS.length}`);
    if (roadBar) roadBar.style.width = `${Math.round((claimed / MISSIONS.length) * 100)}%`;
    const roadMissions = document.querySelector('[data-road-missions]');
    if (roadMissions) {
      roadMissions.innerHTML = MISSIONS.map((def) => {
        const live = missions.find((m) => m.kind === def.kind) || { progress: 0, done: false, claimed: false };
        const status = live.claimed ? 'claimed' : (live.done ? 'ready' : 'in progress');
        return `<div class="road-mission" data-road-kind="${def.kind}">
          <span class="road-mission-label">${def.label}</span>
          <span class="road-mission-progress">${formatProgress(def, live.progress || 0)}</span>
          <span class="road-mission-status ${status.replace(' ', '-')}">${status}</span>
        </div>`;
      }).join('');
    }

    // unlock card: visible if every mission is claimed
    if (allMissionsClaimed(missions)) {
      if (els.unlockCard) {
        els.unlockCard.hidden = false;
        if (els.unlockTicker) els.unlockTicker.textContent = NVDA_UNLOCK;
        const alreadyUnlocked = (store.state.unlocks || []).includes(NVDA_UNLOCK);
        if (els.unlockBtn) {
          els.unlockBtn.disabled = alreadyUnlocked;
          els.unlockBtn.textContent = alreadyUnlocked ? 'NVDA unlocked' : 'Switch to NVDA';
        }
      }
    } else if (els.unlockCard) {
      els.unlockCard.hidden = true;
    }
  }

  async function claim(kind) {
    try {
      const r = await store.claimMission(kind);
      if (r && r.ok) {
        await store.refresh();
        renderMissions();
      }
    } catch (e) {
      // Show a soft error in the unlock card text, do not throw.
      if (els.unlockTicker) els.unlockTicker.textContent = 'claim error: ' + (e && e.message || e);
    }
  }

  async function switchToNvda() {
    // Mark locally so the chart and aim-bridge pick it up.
    setActiveTicker(NVDA_UNLOCK);
    if (typeof onTickerUnlocked === 'function') onTickerUnlocked(NVDA_UNLOCK);
    // The active ticker is now NVDA on the bridge; the next chart quote
    // request and the next aim-bridge POST will use it. Re-render the
    // chart panel if it is on screen.
    if (els.unlockBtn) {
      els.unlockBtn.disabled = true;
      els.unlockBtn.textContent = 'NVDA active';
    }
  }

  function checkUnlocks() {
    const unlocks = new Set(store.state.unlocks || []);
    // If NVDA just appeared in unlocks, treat it as a session unlock.
    if (unlocks.has(NVDA_UNLOCK) && !lastUnlocks.has(NVDA_UNLOCK) && !unlockedThisSession) {
      unlockedThisSession = true;
      // Do NOT auto-switch — let the player choose. But show the unlock
      // card with the "Switch to NVDA" button enabled.
    }
    lastUnlocks = unlocks;
  }

  panel.querySelectorAll('[data-vm-filter]').forEach((filter) => filter.addEventListener('click', () => {
    activeFilter = filter.dataset.vmFilter || 'all';
    panel.querySelectorAll('[data-vm-filter]').forEach((item) => item.classList.toggle('active', item === filter));
    renderMissions();
  }));

  const unsub = store.subscribe(() => {
    checkUnlocks();
    renderMissions();
  });

  // Wire the unlock button
  if (els.unlockBtn) {
    els.unlockBtn.addEventListener('click', switchToNvda);
  }

  renderMissions();
  checkUnlocks();

  function unmount() { unsub(); }
  return { unmount, state: () => ({ unlockedThisSession, lastUnlocks: [...lastUnlocks] }) };
}

// Auto-mount after the panel markup is definitely available. Module scripts
// are deferred, but several independent modules boot in parallel; using the
// DOM readiness boundary avoids a rare visual-test race where the aim menu
// was ready before this panel had subscribed to the store.
function autoMountMissions() {
  const panel = document.getElementById('vibes-missions');
  if (!panel || panel.dataset.vmMounted === 'true') return;
  panel.dataset.vmMounted = 'true';
  mountMissions({ root: panel });
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', autoMountMissions, { once: true });
  } else {
    queueMicrotask(autoMountMissions);
  }
}
