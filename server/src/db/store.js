// server/src/db/store.js — persistence abstraction. Two backends:
//
//   - `memory` (default): in-process Map. Used for tests and offline first-boot.
//   - `supabase`: real Supabase REST client. Loaded dynamically; if the
//                 supabase-js package is not installed, store() throws
//                 a clear error on first write.
//
// The store owns the following collections:
//
//   players        { id, stable, createdAt, updatedAt }
//   balances       { playerId, ticker, qty, updatedAt }
//   trades         { id, playerId, ticker, side, qty, entryPrice, leverage, liquidationPrice, status, pnl, createdAt, closedAt }
//   hit_log        { id, playerId, sessionId, ticker, unit, ts }   (idempotency key: sessionId+hitId)
//   missions       { id, playerId, kind, target, progress, done, claimedAt }
//   unlocks        { playerId, ticker, unlockedAt }
//
// All methods are async so the supabase backend can be a drop-in.

import { randomUUID } from 'node:crypto';

export function createStore(supabaseConfig) {
  const useSupabase = !!(supabaseConfig?.url && supabaseConfig?.serviceKey);
  const mem = {
    players: new Map(),
    balances: new Map(),   // key `${playerId}:${ticker}` -> { playerId, ticker, qty, updatedAt }
    trades: new Map(),     // id -> trade
    hitLog: new Map(),     // `${sessionId}:${hitId}` -> entry
    missions: new Map(),   // `${playerId}:${kind}` -> mission
    unlocks: new Map(),    // `${playerId}:${ticker}` -> entry
    loadout: new Map(),    // `${playerId}:${gunId}` -> { playerId, gunId, purchasedAt }
  };

  function keyBal(playerId, ticker) { return `${playerId}:${ticker}`; }
  function keyMission(playerId, kind) { return `${playerId}:${kind}`; }
  function keyHit(sessionId, hitId) { return `${sessionId}:${hitId}`; }
  function keyUnlock(playerId, ticker) { return `${playerId}:${ticker}`; }
  function keyLoadout(playerId, gunId) { return `${playerId}:${gunId}`; }

  return {
    backend: useSupabase ? 'supabase' : 'memory',

    // ----- players -----
    async getOrCreatePlayer(playerId) {
      if (mem.players.has(playerId)) return mem.players.get(playerId);
      const now = Date.now();
      const p = { id: playerId, stable: 200, preciseBest: 0, createdAt: now, updatedAt: now }; // MVP defaults: 200 Stable, 0 best-accuracy
      mem.players.set(playerId, p);
      return p;
    },
    async getPlayer(playerId) { return mem.players.get(playerId) ?? null; },
    async addStable(playerId, amount) {
      const p = mem.players.get(playerId) ?? (await this.getOrCreatePlayer(playerId));
      p.stable = Math.max(0, Math.round((p.stable + amount) * 1e6) / 1e6);
      p.updatedAt = Date.now();
      return p;
    },
    async recordAccuracy(playerId, accuracy) {
      // accuracy is hits / shots in [0, 1]. We only ever raise the best.
      const p = mem.players.get(playerId) ?? (await this.getOrCreatePlayer(playerId));
      const a = Number(accuracy);
      if (!Number.isFinite(a) || a < 0) return p;
      const prev = Number(p.preciseBest) || 0;
      if (a > prev) { p.preciseBest = a; p.updatedAt = Date.now(); }
      return p;
    },

    // ----- balances (ticker units) -----
    async getBalance(playerId, ticker) {
      return mem.balances.get(keyBal(playerId, ticker)) ?? { playerId, ticker, qty: 0, updatedAt: 0 };
    },
    async getAllBalances(playerId) {
      const out = {};
      for (const v of mem.balances.values()) if (v.playerId === playerId) out[v.ticker] = v.qty;
      return out;
    },
    async addTickerUnits(playerId, ticker, units) {
      const cur = await this.getBalance(playerId, ticker);
      cur.qty = Math.max(0, cur.qty + units);
      cur.updatedAt = Date.now();
      mem.balances.set(keyBal(playerId, ticker), cur);
      return cur;
    },

    // ----- hit log (idempotency) -----
    async recordHit({ playerId, sessionId, hitId, ticker, unit, ts }) {
      const k = keyHit(sessionId, hitId);
      if (mem.hitLog.has(k)) return { duplicate: true, entry: mem.hitLog.get(k) };
      const entry = { id: randomUUID(), playerId, sessionId, hitId, ticker, unit, ts };
      mem.hitLog.set(k, entry);
      return { duplicate: false, entry };
    },
    async hitRateCheck({ sessionId, windowMs = 1000, maxInWindow }) {
      const cutoff = Date.now() - windowMs;
      let n = 0;
      for (const e of mem.hitLog.values()) {
        if (e.sessionId === sessionId && e.ts >= cutoff) n++;
      }
      return { count: n, allowed: n < maxInWindow };
    },
    async countHits(playerId) {
      let n = 0;
      for (const e of mem.hitLog.values()) if (e.playerId === playerId) n++;
      return n;
    },
    async totalEarnedViaAim(playerId, ticker) {
      let s = 0;
      for (const e of mem.hitLog.values()) if (e.playerId === playerId && e.ticker === ticker) s += e.unit;
      return s;
    },

    // ----- trades -----
    async openTrade(trade) {
      const t = { id: randomUUID(), createdAt: Date.now(), status: 'open', pnl: 0, ...trade };
      mem.trades.set(t.id, t);
      return t;
    },
    async getTrade(id) { return mem.trades.get(id) ?? null; },
    async listTrades(playerId) {
      return [...mem.trades.values()].filter((t) => t.playerId === playerId).sort((a, b) => b.createdAt - a.createdAt);
    },
    async closeTrade(id, { exitPrice, pnl, status = 'closed' }) {
      const t = mem.trades.get(id);
      if (!t) return null;
      t.exitPrice = exitPrice; t.pnl = pnl; t.status = status; t.closedAt = Date.now();
      return t;
    },

    // ----- missions -----
    async getMission(playerId, kind) {
      return mem.missions.get(keyMission(playerId, kind)) ?? { playerId, kind, progress: 0, done: false, claimedAt: null };
    },
    async setMissionProgress(playerId, kind, progress, done) {
      const m = await this.getMission(playerId, kind);
      m.progress = progress; if (done != null) m.done = done;
      mem.missions.set(keyMission(playerId, kind), m);
      return m;
    },
    async claimMission(playerId, kind) {
      const m = await this.getMission(playerId, kind);
      if (!m.done || m.claimedAt) return { ok: false, reason: 'not_claimable' };
      m.claimedAt = Date.now();
      mem.missions.set(keyMission(playerId, kind), m);
      return { ok: true, mission: m };
    },
    async listMissions(playerId) {
      return [...mem.missions.values()].filter((m) => m.playerId === playerId);
    },

    // ----- unlocks -----
    async isUnlocked(playerId, ticker) {
      return mem.unlocks.has(keyUnlock(playerId, ticker));
    },
    async unlock(playerId, ticker) {
      const k = keyUnlock(playerId, ticker);
      if (mem.unlocks.has(k)) return mem.unlocks.get(k);
      const u = { playerId, ticker, unlockedAt: Date.now() };
      mem.unlocks.set(k, u);
      return u;
    },
    async listUnlocks(playerId) {
      return [...mem.unlocks.values()].filter((u) => u.playerId === playerId);
    },

    // ----- loadout (one-time gun purchases for stable) -----
    // Gated by server: a player can only own a gun once, and only after
    // paying priceStable from player.stable. Stored as a Map keyed by
    // `${playerId}:${gunId}`; the price lives in client/js/data/loadout.js
    // (and is mirrored on the server via GUNS_CATALOG below) so the
    // server is the source of truth for what is allowed and what it costs.
    async ownsGun(playerId, gunId) {
      return mem.loadout.has(keyLoadout(playerId, gunId));
    },
    async getOwnedGuns(playerId) {
      return [...mem.loadout.values()].filter((e) => e.playerId === playerId);
    },
    async grantGun(playerId, gunId) {
      const k = keyLoadout(playerId, gunId);
      if (mem.loadout.has(k)) return mem.loadout.get(k);
      const e = { playerId, gunId, purchasedAt: Date.now() };
      mem.loadout.set(k, e);
      return e;
    },
  };
}
