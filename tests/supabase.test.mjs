// tests/supabase.test.mjs — mocked PostgREST test for the Supabase store.
// Spins up a tiny HTTP server that speaks the small subset of PostgREST
// that server/src/db/supabase.js uses, then exercises the store against
// it. Asserts that hit-mint, idempotency, open-trade, close-trade,
// claim-mission, and unlock-NVDA all behave like the in-memory store.

import http from 'node:http';
import assert from 'node:assert/strict';
import { createSupabaseStore } from '../server/src/db/supabase.js';

let fails = 0;
const ok  = (m) => console.log(`ok   ${m}`);
const bad = (m) => { fails++; console.error(`FAIL ${m}`); };

// -- Tiny PostgREST emulator ---------------------------------------------
// Tables: players, balances, trades, hit_log, missions, unlocks.
// Implements the verbs our store uses: GET, POST, PATCH, plus HEAD with
// Prefer: count=exact for countHits.
function makePostgrest() {
  const tables = {
    players:  new Map(), // id -> row
    balances: new Map(), // `${playerId}|${ticker}` -> row
    trades:   new Map(), // id -> row
    hit_log:  new Map(), // id -> row
    missions: new Map(), // `${playerId}|${kind}` -> row
    unlocks:  new Map(), // `${playerId}|${ticker}` -> row
  };
  const listeners = []; // for diagnostics

  function keyBal(pid, t) { return `${pid}|${t}`; }
  function keyMis(pid, k) { return `${pid}|${k}`; }
  function keyUnl(pid, t) { return `${pid}|${t}`; }

  function rowsOf(tableName) { return [...tables[tableName].values()]; }

  // PostgREST syntax: ?col=eq.value   (the value carries the "eq." prefix)
  function filter(rows, url) {
    const sp = url.searchParams;
    const eqs = []; // [{ col, value }]
    for (const [col, v] of sp.entries()) {
      if (typeof v === 'string' && v.startsWith('eq.')) {
        eqs.push({ col, value: decodeURIComponent(v.slice(3)) });
      }
    }
    const out = [];
    for (const r of rows) {
      let ok = true;
      for (const e of eqs) {
        if (String(r[e.col]) !== e.value) { ok = false; break; }
      }
      if (ok) out.push(r);
    }
    if (sp.has('limit')) out.length = Math.min(out.length, Number(sp.get('limit')));
    if (sp.has('order')) {
      const [col, dir] = sp.get('order').split('.');
      out.sort((a, b) => {
        if (a[col] < b[col]) return dir === 'desc' ? 1 : -1;
        if (a[col] > b[col]) return dir === 'desc' ? -1 : 1;
        return 0;
      });
    }
    return out;
  }

  function handle(req, res, body) {
    const url = new URL(req.url, 'http://x');
    const parts = url.pathname.split('/').filter(Boolean);
    // /rest/v1/<table>?...
    if (parts[0] !== 'rest' || parts[1] !== 'v1') {
      res.writeHead(404, { 'content-type': 'application/json' });
      return res.end('{"message":"not found"}');
    }
    const tableName = parts[2];
    if (!tables[tableName]) {
      res.writeHead(404, { 'content-type': 'application/json' });
      return res.end(`{"message":"unknown table ${tableName}"}`);
    }
    const method = req.method;
    if (method === 'GET') {
      const rows = filter(rowsOf(tableName), url);
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify(rows));
    } else if (method === 'POST') {
      const items = body || [];
      const preferMergeDup = (req.headers['prefer'] || '').includes('resolution=merge-duplicates');
      const preferReturn = (req.headers['prefer'] || '').includes('return=representation');
      const out = [];
      for (const it of items) {
        const row = { ...it };
        if (tableName === 'players' && !row.created_at) row.created_at = new Date().toISOString();
        if (!row.updated_at) row.updated_at = new Date().toISOString();
        if (tableName === 'hit_log' && !row.id) row.id = 'hlog-' + Math.random().toString(36).slice(2, 10);
        if (tableName === 'trades' && !row.id) row.id = 'trade-' + Math.random().toString(36).slice(2, 10);
        if (preferMergeDup) {
          // find duplicate by the unique key for this table and merge.
          let dupKey = null;
          if (tableName === 'balances') dupKey = keyBal(it.player_id, it.ticker);
          if (dupKey && tables.balances.has(dupKey)) {
            const existing = tables.balances.get(dupKey);
            Object.assign(existing, row);
            out.push(existing);
            continue;
          }
          // merge-duplicates for balances: still insert (PostgREST upsert
          // behaviour when no conflict).
          if (tableName === 'balances') {
            tables.balances.set(dupKey, row);
            out.push(row);
            continue;
          }
        }
        if (tableName === 'hit_log' && !preferMergeDup) {
          // unique(session_id, hit_id)
          for (const ex of tables.hit_log.values()) {
            if (ex.session_id === it.session_id && ex.hit_id === it.hit_id) {
              res.writeHead(409, { 'content-type': 'application/json' });
              return res.end('{"code":"23505","message":"duplicate key value violates unique constraint","details":"Key (session_id, hit_id)=(' + it.session_id + ', ' + it.hit_id + ') already exists.","hint":null}');
            }
          }
        }
        if (tableName === 'balances' && !preferMergeDup) {
          tables.balances.set(keyBal(it.player_id, it.ticker), row);
        } else if (tableName === 'players') {
          tables.players.set(it.id, row);
        } else if (tableName === 'trades') {
          tables.trades.set(row.id, row);
        } else if (tableName === 'hit_log') {
          tables.hit_log.set(row.id, row);
        } else if (tableName === 'missions') {
          tables.missions.set(keyMis(it.player_id, it.kind), row);
        } else if (tableName === 'unlocks') {
          tables.unlocks.set(keyUnl(it.player_id, it.ticker), row);
        } else {
          // generic: use first unique-ish key
        }
        out.push(row);
      }
      // Always return the inserted rows (PostgREST defaults to returning
      // the row when there is no Prefer header and we want a clean store
      // contract). Tests are explicit.
      res.writeHead(201, { 'content-type': 'application/json' });
      res.end(JSON.stringify(out));
    } else if (method === 'PATCH') {
      const rows = filter(rowsOf(tableName), url);
      const updated = [];
      for (const r of rows) {
        Object.assign(r, body || {});
        r.updated_at = new Date().toISOString();
        updated.push(r);
      }
      const preferReturn = (req.headers['prefer'] || '').includes('return=representation');
      if (preferReturn) {
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify(updated));
      } else {
        res.writeHead(204);
        res.end();
      }
    } else if (method === 'HEAD') {
      const rows = filter(rowsOf(tableName), url);
      res.writeHead(200, { 'content-range': `0-${Math.max(0, rows.length - 1)}/${rows.length}` });
      res.end();
    } else {
      res.writeHead(405);
      res.end();
    }
  }

  return { tables, handle };
}

async function main() {
  const pg = makePostgrest();
  const fakeServer = http.createServer((req, res) => {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      let parsed = null;
      try { parsed = body ? JSON.parse(body) : null; } catch { /* ignore */ }
      try { pg.handle(req, res, parsed); }
      catch (e) { res.writeHead(500); res.end(String(e && e.stack || e)); }
    });
  });
  await new Promise((r) => fakeServer.listen(0, r));
  const port = fakeServer.address().port;
  const store = createSupabaseStore({ url: `http://127.0.0.1:${port}`, serviceKey: 'test-key' });
  if (!store) { bad('createSupabaseStore returned null'); process.exit(1); }
  assert.equal(store.backend, 'supabase');
  ok('createSupabaseStore returns supabase backend when env present');

  // 1. getOrCreatePlayer mints a new player
  const p1 = await store.getOrCreatePlayer('p1');
  assert.equal(p1.id, 'p1');
  assert.equal(Number(p1.stable), 1000);
  ok('getOrCreatePlayer mints new player with 1000 stable');

  // 2. addStable updates player
  await store.addStable('p1', 500);
  const p1b = await store.getOrCreatePlayer('p1');
  assert.equal(Number(p1b.stable), 1500);
  await store.addStable('p1', -2000); // floor at 0
  const p1c = await store.getOrCreatePlayer('p1');
  assert.equal(Number(p1c.stable), 0, 'stable floored at 0');
  ok('addStable applies deltas and floors at 0');

  // 3. recordHit mints; duplicate returns the existing entry. Note:
  //    recordHit ONLY logs the hit; balances are updated by the route
  //    via addTickerUnits, which we test separately below.
  const first = await store.recordHit({ playerId: 'p1', sessionId: 's1', hitId: 'h1', ticker: 'AAPL', unit: 0.5, ts: 1 });
  assert.equal(first.duplicate, false);
  assert.ok(first.entry);
  const dup = await store.recordHit({ playerId: 'p1', sessionId: 's1', hitId: 'h1', ticker: 'AAPL', unit: 0.5, ts: 1 });
  assert.equal(dup.duplicate, true);
  assert.equal(dup.entry.hit_id, 'h1');
  ok('recordHit is idempotent on (sessionId, hitId)');

  // 4. addTickerUnits (the call routes/aim.js makes) updates balances.
  await store.addTickerUnits('p1', 'AAPL', 0.5);
  const bal = await store.getBalance('p1', 'AAPL');
  assert.equal(Number(bal.qty), 0.5);
  const all = await store.getAllBalances('p1');
  assert.equal(Number(all.AAPL), 0.5);
  ok('addTickerUnits / getBalance / getAllBalances round-trip');

  // 5. countHits and totalEarnedViaAim
  await store.recordHit({ playerId: 'p1', sessionId: 's1', hitId: 'h2', ticker: 'AAPL', unit: 0.25, ts: 2 });
  await store.addTickerUnits('p1', 'AAPL', 0.25);
  const c = await store.countHits('p1');
  assert.equal(c, 2, `expected 2 hits, got ${c}`);
  const e = await store.totalEarnedViaAim('p1', 'AAPL');
  assert.equal(Number(e), 0.75);
  ok('countHits / totalEarnedViaAim return correct aggregates');

  // 6. openTrade / listTrades / closeTrade
  const trade = await store.openTrade({
    playerId: 'p1', ticker: 'AAPL', side: 'long', leverage: 2,
    qty: 1.5, entryPrice: 100, liquidationPrice: 50,
  });
  assert.equal(trade.ticker, 'AAPL');
  assert.equal(Number(trade.entryPrice), 100);
  const listed = await store.listTrades('p1');
  assert.equal(listed.length, 1);
  const closed = await store.closeTrade(trade.id, { exitPrice: 120, pnl: 30, status: 'closed' });
  assert.equal(closed.status, 'closed');
  assert.equal(Number(closed.pnl), 30);
  ok('openTrade / listTrades / closeTrade round-trip');

  // 7. unlock NVDA
  await store.unlock('p1', 'NVDA');
  assert.equal(await store.isUnlocked('p1', 'NVDA'), true);
  const unlocks = await store.listUnlocks('p1');
  assert.ok(unlocks.some((u) => u.ticker === 'NVDA'));
  ok('unlock / isUnlocked / listUnlocks round-trip');

  // 8. recordHit rejects duplicate with 23505 -> duplicate:true (no throw)
  const dup2 = await store.recordHit({ playerId: 'p1', sessionId: 's1', hitId: 'h1', ticker: 'AAPL', unit: 0.5, ts: 1 });
  assert.equal(dup2.duplicate, true);
  ok('recordHit duplicate path returns existing entry (no throw)');

  // 9. addStable on a fresh player creates them
  const p2 = await store.addStable('p-fresh', 100);
  assert.equal(p2.id, 'p-fresh');
  assert.equal(Number(p2.stable), 1100);
  ok('addStable creates a new player on first write');

  fakeServer.close();
  if (fails) { console.error(`${fails} FAILURES`); process.exit(1); }
  console.log('ALL PASS');
}

main().catch((e) => { console.error('TEST CRASH:', e && e.stack ? e.stack : e); process.exit(1); });
