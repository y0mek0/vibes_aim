// client/src/store.js — client-side mirror of the server state.
// Pulls from /portfolio and /missions on demand, exposes a tiny event
// emitter so the UI can subscribe. No third-party state lib.

import { api } from './api.js';
import { getPlayerId, setPlayerId } from './api.js';
import { getSessionId } from './session.js';
import { loadGuestSnapshot, saveGuestSnapshot, clearGuestSnapshot } from './persist.js';

function createStore() {
  const listeners = new Set();
  const state = {
    ready: false,
    player: null,         // { id, stable, updatedAt }
    balances: {},         // { AAPL: 0.034, NVDA: 0 }
    trades: [],           // [ { id, ticker, side, ... } ]
    unlocks: [],          // [ 'AAPL', 'NVDA' ]
    missions: [],         // [ { kind, progress, done, claimed } ]
    lastError: null,
    lastHit: null,        // last aim/hit result (for the floating HUD chip)
  };

  function emit() { for (const l of listeners) l(state); }

  async function refresh() {
    const [p, m] = await Promise.all([
      api.get('/portfolio'),
      api.get('/missions'),
    ]);
    state.player = p.player;
    state.balances = p.balances || {};
    state.trades = p.trades || [];
    state.unlocks = (p.unlocks || []).map((u) => u.ticker);
    state.missions = m.missions || [];
    state.ready = true;
    state.lastError = null;
    saveGuestSnapshot(state);
    emit();
    return state;
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
    // Eagerly kick off a server refresh. mountMissions (and other panels)
    // subscribe to the store; without this, the first render reads an
    // empty state and shows "0/6 claimed" instead of the real data.
    refresh().catch(() => { /* server may be down; keep guest snapshot */ });
  }

  async function recordAimHit({ hitId, ticker, accuracy, streak }) {
    const r = await api.post('/aim/hit', {
      hitId, ticker, accuracy, streak, ts: Date.now(),
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
  async function claimMission(kind) {
    const r = await api.post('/missions/claim', { kind });
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
    claimMission,
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
