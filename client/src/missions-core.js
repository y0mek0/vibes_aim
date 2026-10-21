// client/src/missions-core.js — pure helpers for the Stable reward missions.
// The client computes progress for instant UI feedback; the server remains
// the authority for claim and reward balances.

export const MISSIONS = [
  { kind: 'first_10_hits',   label: 'Land 10 aim hits',                target: 10,  reward: 50  },
  { kind: 'earn_half_aapl',  label: 'Earn 0.5 AAPL via aim',          target: 0.5, reward: 250 },
  { kind: 'first_trade',     label: 'Open and close your first trade', target: 1,   reward: 150 },
  { kind: 'first_profit',    label: 'Close a trade in profit',         target: 1,   reward: 200 },
  { kind: 'hold_60s',        label: 'Hold a long position 60 seconds', target: 60,  reward: 200 },
  { kind: 'precise_session', label: 'Reach 70% accuracy in a session', target: 0.7, reward: 350 },
];

// Resolve progress for one mission from the player's current state.
// `state` shape: { hits, earnedAapl, trades, preciseBest }.
export function missionProgress(def, state) {
  const s = state || {};
  switch (def.kind) {
    case 'first_10_hits': {
      const n = Number(s.hits) || 0;
      return { progress: Math.min(n, def.target), done: n >= def.target };
    }
    case 'earn_half_aapl': {
      const v = Number(s.earnedAapl) || 0;
      return { progress: Math.min(v, def.target), done: v >= def.target };
    }
    case 'first_trade': {
      const n = countClosedTrades(s.trades);
      return { progress: Math.min(n, def.target), done: n >= def.target };
    }
    case 'first_profit': {
      const n = countProfitableTrades(s.trades);
      return { progress: Math.min(n, def.target), done: n >= def.target };
    }
    case 'hold_60s': {
      // Real 60-second hold. Server is the authority; this is a UI hint
      // for the missions panel that ticks the progress to 1 when a long
      // trade lasted at least 60s.
      const ok = hasHeldLong(s.trades, 60_000);
      return { progress: ok ? 1 : 0, done: ok };
    }
    case 'precise_session': {
      const acc = Number(s.preciseBest);
      if (!Number.isFinite(acc)) return { progress: 0, done: false };
      return { progress: Math.min(acc, def.target), done: acc >= def.target };
    }
    default:
      return { progress: 0, done: false };
  }
}

function countClosedTrades(trades) {
  if (!Array.isArray(trades)) return 0;
  return trades.filter((t) => t.status !== 'open').length;
}
function countProfitableTrades(trades) {
  if (!Array.isArray(trades)) return 0;
  return trades.filter((t) => t.status === 'closed' && Number(t.pnl) > 0).length;
}
function hasHeldLong(trades, ms) {
  if (!Array.isArray(trades)) return false;
  return trades.some((t) => t.side === 'long' && t.status === 'closed'
    && (Number(t.closedAt) - Number(t.createdAt)) >= ms);
}

// Format a mission progress value for display. The target may be
// integer (10 hits) or fractional (0.5 AAPL) or percentage (0.7 acc).
export function formatProgress(def, progress) {
  if (!def) return '—';
  if (def.target < 1 && def.target > 0) {
    // 0.5-style
    return `${progress.toFixed(2)} / ${def.target.toFixed(2)}`;
  }
  if (def.target === 1) {
    return progress >= 1 ? 'done' : `${progress} / 1`;
  }
  // integer targets
  return `${Math.floor(progress)} / ${def.target}`;
}
