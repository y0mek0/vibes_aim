// server/src/db/supabase.js — store-compatible implementation backed by
// Supabase PostgREST. The client is built with the project's `fetch` so
// we don't need a npm dependency. If the URL/key aren't set, the factory
// returns the in-memory store instead (this file exports both, and the
// caller picks one based on env).
//
// Schema: see server/migrations/0001_init.sql
//
// Notes:
//   - All amounts go in/out as strings (numeric type). We round on read.
//   - hit_log is the only collection with idempotency: unique(session_id, hit_id).
//     We rely on Postgres to reject duplicates with 23505 and translate
//     that to { duplicate: true, entry: existing }.
//   - missions table has a composite primary key (player_id, kind), so
//     "upsert" is just POST with Prefer: resolution=merge-duplicates.

import { randomUUID } from 'node:crypto';
import { createStore as createMemoryStore } from './store.js';

const TABLE = {
  players:  'players',
  balances: 'balances',
  trades:   'trades',
  hitLog:   'hit_log',
  missions: 'missions',
  unlocks:  'unlocks',
};

function round6(n) { return Math.round(n * 1e6) / 1e6; }
function round8(n) { return Math.round(n * 1e8) / 1e8; }

export function createSupabaseStore({ url, serviceKey }) {
  if (!url || !serviceKey) return null;
  const headers = {
    'apikey': serviceKey,
    'Authorization': `Bearer ${serviceKey}`,
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  };

  async function rpc(table, query = '', init = {}) {
    const u = new URL(`${url.replace(/\/$/, '')}/rest/v1/${table}${query}`);
    // fetch() expects body as a string or stream; serialize if we got a JS value.
    const finalInit = { ...init, headers: { ...headers, ...(init.headers || {}) } };
    if (finalInit.body !== undefined && finalInit.body !== null && typeof finalInit.body !== 'string') {
      finalInit.body = JSON.stringify(finalInit.body);
    }
    const res = await fetch(u, finalInit);
    const text = await res.text();
    let body = null; try { body = text ? JSON.parse(text) : null; } catch { /* keep text */ }
    if (!res.ok) {
      // PostgREST error envelope
      const msg = (body && (body.message || body.error_description || body.error)) || res.statusText;
      const err = new Error(`Supabase ${res.status}: ${msg}`);
      err.status = res.status;
      err.code = (body && body.code) || `supabase_${res.status}`;
      err.body = body;
      throw err;
    }
    return body;
  }

  function eqFilter(col, val) { return `${col}=eq.${encodeURIComponent(val)}`; }
  function select(cols) { return cols ? `select=${encodeURIComponent(cols)}` : 'select=*'; }
  function toPlayer(row) {
    if (!row) return null;
    return {
      ...row,
      stable: Number(row.stable),
      // Backward-compatible for a row created before migration 0002.
      preciseBest: Number.isFinite(Number(row.precise_best)) ? Number(row.precise_best) : 0,
    };
  }

  return {
    backend: 'supabase',

    // ----- players -----
    async getOrCreatePlayer(playerId) {
      const rows = await rpc(TABLE.players, `?${eqFilter('id', playerId)}&limit=1`);
      if (rows && rows[0]) return toPlayer(rows[0]);
      const now = new Date().toISOString();
      const body = [{ id: playerId, stable: 200, precise_best: 0, created_at: now, updated_at: now }];
      const inserted = await rpc(TABLE.players, `?${select()}`, { method: 'POST', body });
      return toPlayer(inserted && inserted[0]);
    },
    async getPlayer(playerId) {
      const rows = await rpc(TABLE.players, `?${eqFilter('id', playerId)}&limit=1`);
      return rows && rows[0] ? toPlayer(rows[0]) : null;
    },
    async addStable(playerId, amount) {
      const cur = await this.getOrCreatePlayer(playerId);
      const next = Math.max(0, round6(Number(cur.stable) + amount));
      const now = new Date().toISOString();
      const rows = await rpc(TABLE.players,
        `?${eqFilter('id', playerId)}`,
        { method: 'PATCH', body: { stable: next, updated_at: now },
          headers: { 'Prefer': 'return=representation' } });
      return rows && rows[0] ? toPlayer(rows[0]) : { ...cur, stable: next, updated_at: now };
    },
    async recordAccuracy(playerId, accuracy) {
      const cur = await this.getOrCreatePlayer(playerId);
      const next = Number(accuracy);
      if (!Number.isFinite(next) || next < 0 || next <= cur.preciseBest) return cur;
      const now = new Date().toISOString();
      const rows = await rpc(TABLE.players,
        `?${eqFilter('id', playerId)}`,
        { method: 'PATCH', body: { precise_best: round6(next), updated_at: now },
          headers: { 'Prefer': 'return=representation' } });
      return rows && rows[0]
        ? toPlayer(rows[0])
        : { ...cur, preciseBest: round6(next), updated_at: now };
    },

    // ----- balances -----
    async getBalance(playerId, ticker) {
      const rows = await rpc(TABLE.balances,
        `?${eqFilter('player_id', playerId)}&${eqFilter('ticker', ticker)}&limit=1`);
      if (!rows || !rows[0]) return { playerId, ticker, qty: 0, updatedAt: 0 };
      return { playerId, ticker, qty: Number(rows[0].qty), updatedAt: Date.parse(rows[0].updated_at) || 0 };
    },
    async getAllBalances(playerId) {
      const rows = await rpc(TABLE.balances, `?${eqFilter('player_id', playerId)}`);
      const out = {};
      for (const r of rows || []) out[r.ticker] = Number(r.qty);
      return out;
    },
    async addTickerUnits(playerId, ticker, units) {
      const cur = await this.getBalance(playerId, ticker);
      const next = Math.max(0, cur.qty + units);
      const now = new Date().toISOString();
      // Upsert via POST with merge-duplicates
      const rows = await rpc(TABLE.balances, `?${select()}`, {
        method: 'POST',
        headers: { 'Prefer': 'resolution=merge-duplicates,return=representation' },
        body: [{ player_id: playerId, ticker, qty: round8(next), updated_at: now }],
      });
      const r = rows && rows[0];
      return { playerId, ticker, qty: r ? Number(r.qty) : next, updatedAt: Date.now() };
    },

    // ----- hit log -----
    async recordHit({ playerId, sessionId, hitId, ticker, unit, ts }) {
      try {
        const rows = await rpc(TABLE.hitLog, `?${select()}`, {
          method: 'POST',
          headers: { 'Prefer': 'return=representation' },
          body: [{ player_id: playerId, session_id: sessionId, hit_id: hitId, ticker, unit: round8(unit), ts }],
        });
        return { duplicate: false, entry: rows && rows[0] };
      } catch (e) {
        // 23505 = unique_violation
        const code = e.code || '';
        const isDup = e.status === 409 || /23505|duplicate/i.test(code) || /duplicate key/i.test(e.message);
        if (!isDup) throw e;
        // Fetch the existing entry
        const rows = await rpc(TABLE.hitLog,
          `?${eqFilter('session_id', sessionId)}&${eqFilter('hit_id', hitId)}&limit=1`);
        return { duplicate: true, entry: rows && rows[0] };
      }
    },
    async hitRateCheck({ sessionId, windowMs = 1000, maxInWindow }) {
      const cutoff = Date.now() - windowMs;
      // We can't filter by ts in a single PostgREST call cheaply without an index range.
      // Pull recent rows for the session and count in JS.
      const rows = await rpc(TABLE.hitLog,
        `?${eqFilter('session_id', sessionId)}&order=ts.desc&limit=1000`);
      let n = 0;
      for (const r of rows || []) if (Number(r.ts) >= cutoff) n++;
      return { count: n, allowed: n < maxInWindow };
    },
    async countHits(playerId) {
      // PostgREST count via exact count header
      const u = new URL(`${url.replace(/\/$/, '')}/rest/v1/${TABLE.hitLog}`);
      u.searchParams.set('select', 'id');
      u.searchParams.set(eqFilter('player_id', playerId).split('=')[0], `eq.${encodeURIComponent(playerId)}`);
      const res = await fetch(u, { method: 'HEAD', headers: { ...headers, 'Prefer': 'count=exact' } });
      const cr = res.headers.get('content-range'); // "0-N/COUNT" or "*/0"
      if (!cr) return 0;
      const m = /\/(\d+)/.exec(cr);
      return m ? Number(m[1]) : 0;
    },
    async totalEarnedViaAim(playerId, ticker) {
      const rows = await rpc(TABLE.hitLog,
        `?${eqFilter('player_id', playerId)}&${eqFilter('ticker', ticker)}&select=unit`);
      let s = 0;
      for (const r of rows || []) s += Number(r.unit);
      return s;
    },

    // ----- trades -----
    async openTrade(t) {
      const id = t.id || randomUUID();
      const row = {
        id, player_id: t.playerId, ticker: t.ticker,
        side: t.side, qty: round8(t.qty), entry_price: round6(t.entryPrice),
        exit_price: t.exitPrice == null ? null : round6(t.exitPrice),
        leverage: t.leverage, liquidation_price: round6(t.liquidationPrice),
        status: t.status || 'open', pnl: 0, created_at: new Date().toISOString(),
        closed_at: t.closedAt ? new Date(t.closedAt).toISOString() : null,
      };
      const rows = await rpc(TABLE.trades, `?${select()}`, { method: 'POST', body: [row] });
      return this._rowToTrade(rows && rows[0]);
    },
    async getTrade(id) {
      const rows = await rpc(TABLE.trades, `?${eqFilter('id', id)}&limit=1`);
      return rows && rows[0] ? this._rowToTrade(rows[0]) : null;
    },
    async listTrades(playerId) {
      const rows = await rpc(TABLE.trades, `?${eqFilter('player_id', playerId)}&order=created_at.desc`);
      return (rows || []).map((r) => this._rowToTrade(r));
    },
    async closeTrade(id, { exitPrice, pnl, status = 'closed' }) {
      const body = {
        exit_price: round6(exitPrice), pnl: round6(pnl), status,
        closed_at: new Date().toISOString(),
      };
      const rows = await rpc(TABLE.trades, `?${eqFilter('id', id)}`, {
        method: 'PATCH', body,
        headers: { 'Prefer': 'return=representation' },
      });
      return rows && rows[0] ? this._rowToTrade(rows[0]) : null;
    },
    _rowToTrade(r) {
      if (!r) return null;
      return {
        id: r.id, playerId: r.player_id, ticker: r.ticker, side: r.side,
        qty: Number(r.qty), entryPrice: Number(r.entry_price),
        exitPrice: r.exit_price == null ? null : Number(r.exit_price),
        leverage: r.leverage, liquidationPrice: Number(r.liquidation_price),
        status: r.status, pnl: Number(r.pnl),
        createdAt: Date.parse(r.created_at) || 0,
        closedAt: r.closed_at ? Date.parse(r.closed_at) : null,
      };
    },

    // ----- missions -----
    async getMission(playerId, kind) {
      const rows = await rpc(TABLE.missions, `?${eqFilter('player_id', playerId)}&${eqFilter('kind', kind)}&limit=1`);
      if (!rows || !rows[0]) return { playerId, kind, progress: 0, done: false, claimedAt: null };
      const r = rows[0];
      return {
        playerId, kind,
        progress: Number(r.progress), done: !!r.done,
        claimedAt: r.claimed_at ? Date.parse(r.claimed_at) : null,
      };
    },
    async setMissionProgress(playerId, kind, progress, done) {
      const now = new Date().toISOString();
      const body = { progress: round6(progress), done: !!done };
      const rows = await rpc(TABLE.missions,
        `?${eqFilter('player_id', playerId)}&${eqFilter('kind', kind)}`, {
        method: 'PATCH', body,
        headers: { 'Prefer': 'return=representation' },
      });
      if (rows && rows[0]) return this._rowToMission(rows[0]);
      // Insert if not present
      const inserted = await rpc(TABLE.missions, `?${select()}`, {
        method: 'POST', body: [{ player_id: playerId, kind, ...body }],
      });
      return this._rowToMission(inserted && inserted[0]);
    },
    async claimMission(playerId, kind) {
      const m = await this.getMission(playerId, kind);
      if (!m.done || m.claimedAt) return { ok: false, reason: 'not_claimable' };
      const now = new Date().toISOString();
      const rows = await rpc(TABLE.missions,
        `?${eqFilter('player_id', playerId)}&${eqFilter('kind', kind)}`, {
        method: 'PATCH', body: { claimed_at: now },
        headers: { 'Prefer': 'return=representation' },
      });
      return { ok: true, mission: this._rowToMission(rows && rows[0]) };
    },
    async listMissions(playerId) {
      const rows = await rpc(TABLE.missions, `?${eqFilter('player_id', playerId)}`);
      return (rows || []).map((r) => this._rowToMission(r));
    },
    _rowToMission(r) {
      if (!r) return { playerId: '', kind: '', progress: 0, done: false, claimedAt: null };
      return {
        playerId: r.player_id, kind: r.kind,
        progress: Number(r.progress), done: !!r.done,
        claimedAt: r.claimed_at ? Date.parse(r.claimed_at) : null,
      };
    },

    // ----- unlocks -----
    async isUnlocked(playerId, ticker) {
      const rows = await rpc(TABLE.unlocks, `?${eqFilter('player_id', playerId)}&${eqFilter('ticker', ticker)}&limit=1`);
      return !!(rows && rows[0]);
    },
    async unlock(playerId, ticker) {
      if (await this.isUnlocked(playerId, ticker)) {
        return { playerId, ticker, unlockedAt: Date.now() };
      }
      const rows = await rpc(TABLE.unlocks, `?${select()}`, {
        method: 'POST',
        body: [{ player_id: playerId, ticker }],
      });
      return { playerId, ticker, unlockedAt: Date.parse((rows && rows[0] && rows[0].unlocked_at) || new Date().toISOString()) };
    },
    async listUnlocks(playerId) {
      const rows = await rpc(TABLE.unlocks, `?${eqFilter('player_id', playerId)}`);
      return (rows || []).map((r) => ({ playerId, ticker: r.ticker, unlockedAt: Date.parse(r.unlocked_at) || 0 }));
    },
  };
}

// Helper: pick the right store based on config.
export function pickStore(supabaseConfig) {
  const sb = createSupabaseStore(supabaseConfig);
  if (sb) return sb;
  return createMemoryStore();
}
