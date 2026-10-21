// client/js/missions.js — missions panel and Stable reward flow.
// Reads missions from the server (via client/src/store.js), shows
// progress and claim buttons. Ticker access is handled by the farm picker;
// missions only award extra Stable.

import { store } from '../src/store.js?v=20261013-6';
import { MISSIONS, formatProgress } from '../src/missions-core.js?v=20261021-5';

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
          <div class="vm-mission-top"><div class="vm-label">${def.label}</div><div class="vm-reward num">+${def.reward} USD</div></div>
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
      btn.addEventListener('click', () => claim(btn.dataset.vmClaim, btn));
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

    // Completion is a Stable milestone only; it never changes ticker access.
    if (els.unlockCard) els.unlockCard.hidden = !missions.length || claimed < MISSIONS.length;
  }

  async function claim(kind, button) {
    if (button?.disabled) return;
    if (button) {
      button.disabled = true;
      button.textContent = 'Claiming…';
    }
    try {
      const r = await store.claimMission(kind);
      if (!r || !r.ok) throw new Error(r?.reason || 'claim rejected');
      renderMissions();
    } catch (e) {
      if (button) {
        button.disabled = false;
        button.textContent = 'Claim';
      }
      const row = button?.closest('tr');
      const status = row?.querySelector('.vm-status');
      if (status) {
        status.textContent = 'claim failed';
        status.classList.add('error');
      }
      console.warn('[missions] claim failed', kind, e);
    }
  }

  panel.querySelectorAll('[data-vm-filter]').forEach((filter) => filter.addEventListener('click', () => {
    activeFilter = filter.dataset.vmFilter || 'all';
    panel.querySelectorAll('[data-vm-filter]').forEach((item) => item.classList.toggle('active', item === filter));
    renderMissions();
  }));

  const unsub = store.subscribe(() => {
    renderMissions();
  });

  renderMissions();

  function unmount() { unsub(); }
  return { unmount, state: () => ({ activeFilter }) };
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
