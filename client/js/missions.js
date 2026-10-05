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

  function renderMissions() {
    if (!els.body) return;
    els.body.innerHTML = '';
    const missions = store.state.missions || [];
    for (const def of MISSIONS) {
      const live = missions.find((m) => m.kind === def.kind) || { kind: def.kind, progress: 0, done: false, claimed: false };
      const tr = document.createElement('tr');
      tr.dataset.vmKind = def.kind;
      const pct = def.target > 0 ? Math.min(1, (live.progress || 0) / def.target) : 0;
      const barWidth = `${Math.round(pct * 100)}%`;
      const status = live.claimed
        ? '<span class="vm-status claimed">claimed</span>'
        : (live.done ? '<span class="vm-status done">ready</span>' : '<span class="vm-status">in progress</span>');
      tr.innerHTML = `
        <td>
          <div class="vm-label">${def.label}</div>
          <div class="vm-progress"><span class="vm-bar" style="width:${barWidth}"></span></div>
        </td>
        <td class="num">${formatProgress(def, live.progress || 0)}</td>
        <td class="num">+${def.reward}</td>
        <td>${status}</td>
        <td>
          <button type="button" class="vm-claim-btn" data-vm-claim="${def.kind}" ${live.claimed || !live.done ? 'disabled' : ''}>
            ${live.claimed ? 'Claimed' : 'Claim'}
          </button>
        </td>
      `;
      els.body.appendChild(tr);
    }
    // wire claim buttons
    els.body.querySelectorAll('[data-vm-claim]').forEach((btn) => {
      btn.addEventListener('click', () => claim(btn.dataset.vmClaim));
    });

    // top counters
    const claimed = missions.filter((m) => m.claimed).length;
    setText(els.claimed, claimed);
    setText(els.total, MISSIONS.length);
    const roadCount = document.getElementById('overall-imp');
    const roadBar = document.getElementById('goalbar');
    const roadBreakdown = document.getElementById('impbreakdown');
    setText(roadCount, `${claimed} / ${MISSIONS.length}`);
    setText(roadBreakdown, `${claimed} / ${MISSIONS.length} complete`);
    if (roadBar) roadBar.style.width = `${Math.round((claimed / MISSIONS.length) * 100)}%`;

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
