// client/src/store.js — client-side mirror of the server state.
// Pulls from /portfolio and /missions on demand, exposes a tiny event
// emitter so the UI can subscribe. No third-party state lib.
//
// Auth is handled by client/js/auth.js which mounts a global window.auth
// singleton. The store listens to it and re-binds player identity when
// the user signs in / out, so the rest of the app only has to look at
// state.player to know who is playing.

import { api } from './api.js?v=20261009-1';
import { getPlayerId, setPlayerId } from './api.js?v=20261009-1';
import { getSessionId } from './session.js?v=20261009-1';
import { loadGuestSnapshot, saveGuestSnapshot, clearGuestSnapshot } from './persist.js?v=20261009-1';

function createStore() {
  const listeners = new Set();
  const state = {
    ready: false,
    player: null,         // { id, stable, updatedAt }
    balances: {},         // { AAPL: 0.034, NVDA: 0 }
    trades: [],           // [ { id, ticker, side, ... } ]
    unlocks: [],          // [ 'AAPL', 'NVDA' ]
    missions: [],         // [ { kind, progress, done, claimed } ]
    loadout: { owned: [], catalog: [] }, // { owned: [gunId], catalog: [...] }
    lastError: null,
    lastHit: null,        // last aim/hit result (for the floating HUD chip)
    auth: { signedIn: false, email: null }, // mirror of window.auth
  };

  function emit() { for (const l of listeners) l(state); }

  async function refresh() {
    const [p, m, l] = await Promise.all([
      api.get('/portfolio'),
      api.get('/missions'),
      api.get('/loadout').catch(() => null),
    ]);
    state.player = p.player;
    state.balances = p.balances || {};
    state.trades = p.trades || [];
    state.unlocks = (p.unlocks || []).map((u) => u.ticker);
    state.missions = m.missions || [];
    if (l) {
      state.loadout = { owned: l.owned || [], catalog: l.catalog || [] };
    }
    state.ready = true;
    state.lastError = null;
    saveGuestSnapshot(state);
    emit();
    return state;
  }

  function applyAuthState(authState) {
    // Mirror the auth singleton into our store so UI panels can read
    // state.auth without taking a hard dependency on window.auth.
    state.auth = {
      signedIn: !!(authState && authState.player),
      email: authState?.profile?.email || authState?.player?.email || null,
      playerId: authState?.player?.id || null,
    };
    if (state.auth.signedIn) {
      // Adopt the signed-in player id so /portfolio, /aim/hit, etc.
      // start using the persisted Google-backed account.
      setPlayerId(state.auth.playerId);
      // Re-fetch the store with the newly-bound player id. Without this
      // the UI keeps showing the stale guest snapshot (stable 200) even
      // though setPlayerId now points at the Google account.
      refresh().catch(() => {});
    }
    emit();
  }

  // Local-only bootstrap: if the user has a saved guest snapshot, use it
  // for an instant first paint while the server round-trip is in flight.
  function bootstrap() {
    const snap = loadGuestSnapshot();
    if (snap) {
      state.player = snap.player || null;
      state.balances = snap.balances || {};
      state.trades = snap.trades || [];
      state.unlocks = snap.unlocks || [];
      state.missions = snap.missions || [];
    }
    // Subscribe to auth state. auth.js (loaded as a separate module) is
    // expected to put a singleton on window.auth. We poll briefly so a
    // race-condition between module load order doesn't leave us deaf.
    function attach() {
      if (window.auth && typeof window.auth.onChange === 'function') {
        window.auth.onChange(applyAuthState);
        // Sync the initial state in case auth already finished its
        // /auth/me lookup.
        applyAuthState(window.auth.state);
        return true;
      }
      return false;
    }
    if (!attach()) {
      let tries = 0;
      const id = setInterval(() => {
        if (attach() || ++tries > 50) clearInterval(id);
      }, 60);
    }
    // Eagerly kick off a server refresh. mountMissions (and other panels)
    // subscribe to the store; without this, the first render reads an
    // empty state and shows "0/6 claimed" instead of the real data.
    refresh().catch(() => { /* server may be down; keep guest snapshot */ });
  }

  async function recordAimHit({ hitId, ticker, accuracy, streak, gunId }) {
    const r = await api.post('/aim/hit', {
      hitId, ticker, accuracy, streak, ts: Date.now(),
      // Pass the gunId so the server can apply per-weapon earnMult.
      gunId: gunId || null,
    });
    state.lastHit = r;
    // Optimistic local update of the balance, but trust the server on the
    // next /portfolio pull (which `refresh()` does right after).
    state.balances = { ...state.balances, [ticker]: r.balance };
    saveGuestSnapshot(state);
    emit();
    return r;
  }

  async function previewOrder({ ticker, side, leverage, notional }) {
    return api.post('/portfolio/preview', { ticker, side, leverage, notional });
  }
  async function openOrder({ ticker, side, leverage, notional, confirmLiquidation }) {
    const r = await api.post('/portfolio/order', { ticker, side, leverage, notional, confirmLiquidation });
    await refresh();
    return r;
  }
  async function closeOrder(tradeId) {
    const r = await api.post('/portfolio/close', { tradeId });
    await refresh();
    return r;
  }
  async function convertAsset({ ticker, units }) {
    const r = await api.post('/portfolio/convert', { ticker, units });
    await refresh();
    return r;
  }
  async function tradeSpot({ ticker, side, units }) {
    const r = await api.post('/portfolio/spot', { ticker, side, units });
    await refresh();
    return r;
  }
  async function claimMission(kind) {
    const r = await api.post('/missions/claim', { kind });
    await refresh();
    return r;
  }
  async function fetchLoadout() {
    const r = await api.get('/loadout');
    state.loadout = { owned: r.owned || [], catalog: r.catalog || [] };
    saveGuestSnapshot(state);
    emit();
    return state.loadout;
  }
  async function buyGun(gunId) {
    const r = await api.post('/loadout/buy', { gunId });
    await refresh();
    return r;
  }
  async function fetchQuote(symbol) {
    return api.get(`/market/quote/${encodeURIComponent(symbol)}`);
  }
  async function fetchCandles(symbol, range) {
    return api.get(`/market/candles/${encodeURIComponent(symbol)}`, { query: { range } });
  }
  async function fetchSymbols() {
    return (await api.get('/market/symbols')).symbols;
  }
  async function fetchMarketStatus() {
    return api.get('/market/status');
  }

  function reset() {
    clearGuestSnapshot();
    setPlayerId(null);
    state.ready = false;
    state.player = null;
    state.balances = {};
    state.trades = [];
    state.unlocks = [];
    state.missions = [];
    state.lastError = null;
    state.lastHit = null;
    emit();
  }

  return {
    get state() { return state; },
    bootstrap,
    refresh,
    recordAimHit,
    previewOrder,
    openOrder,
    closeOrder,
    convertAsset,
    tradeSpot,
    claimMission,
    buyGun,
    fetchLoadout,
    fetchQuote,
    fetchCandles,
    fetchSymbols,
    fetchMarketStatus,
    reset,
    subscribe(fn) { listeners.add(fn); fn(state); return () => listeners.delete(fn); },
    // Exposed for tests:
    _getPlayerId: getPlayerId,
    _getSessionId: getSessionId,
  };
}

export const store = createStore();
