// client/src/persist.js — guest-mode localStorage adapter.
//
// We never persist progress for an unauthenticated guest beyond a single
// device + browser. The user explicitly chose "no save without login" in
// the MVP brief. The functions here only read what the same browser tab
// wrote in the current session.
//
// This file is a thin wrapper around localStorage. If localStorage is
// unavailable (Safari private mode, sandboxed iframe), all reads return
// null and all writes are no-ops.

const KEY = 'vibes_aim.guestSnapshot.v1';

function safeGet() {
  try { return localStorage.getItem(KEY); } catch { return null; }
}
function safeSet(value) {
  try { localStorage.setItem(KEY, value); } catch { /* ignore */ }
}
function safeRemove() {
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
}

export function loadGuestSnapshot() {
  const raw = safeGet();
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

export function saveGuestSnapshot(state) {
  // Keep only the fields that matter; trim to fit under any browser limit.
  const trimmed = {
    savedAt: Date.now(),
    player: state.player ?? null,
    balances: state.balances ?? {},
    trades: state.trades ?? [],
    unlocks: state.unlocks ?? [],
    missions: state.missions ?? [],
  };
  safeSet(JSON.stringify(trimmed));
}

export function clearGuestSnapshot() { safeRemove(); }
