// tests/client-bridge.test.mjs — integration test for the client/server
// wire. Boots the server in-process and sends the same POST shape that
// client/js/aim-bridge.js produces. Asserts the response shape matches
// what client/src/api.js expects to read back.
//
// Run: node tests/client-bridge.test.mjs (from aim2stock/)

import http from 'node:http';
import assert from 'node:assert/strict';
import { createApp } from '../server/src/index.js';
import { activeTickerLabel, getActiveTicker, setActiveTicker } from '../client/js/aim-bridge.js';

let fails = 0;
const ok  = (m) => console.log(`ok   ${m}`);
const bad = (m) => { fails++; console.error(`FAIL ${m}`); };

function req({ port, method, path, headers = {}, body }) {
  return new Promise((resolve, reject) => {
    const data = body == null ? null : JSON.stringify(body);
    const r = http.request({
      method, host: '127.0.0.1', port, path,
      headers: { 'Content-Type': 'application/json', 'Content-Length': data ? Buffer.byteLength(data) : 0, ...headers },
    }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8');
        let json = null; try { json = JSON.parse(text); } catch { /* keep text */ }
        resolve({ status: res.statusCode, body: json, text });
      });
    });
    r.on('error', reject);
    if (data) r.write(data);
    r.end();
  });
}

async function main() {
  // The HUD must name the selected farm ticker, and this state transition
  // is safe to evaluate in non-browser tests (no localStorage required).
  assert.equal(getActiveTicker(), 'AAPL');
  assert.equal(activeTickerLabel(getActiveTicker()), 'Active farm ticker: AAPL');
  setActiveTicker('NVDA');
  assert.equal(getActiveTicker(), 'NVDA');
  assert.equal(activeTickerLabel(getActiveTicker()), 'Active farm ticker: NVDA');
  setActiveTicker('AAPL');
  ok('active ticker HUD label follows AAPL → NVDA → AAPL');

  const { listen } = createApp();
  const server = listen(0);
  await new Promise((r) => server.once('listening', r));
  const port = server.address().port;
  const playerId = 'bridge-player';
  const sessionId = 'bridge-session';

  // 1. POST /aim/hit with the exact field shape the bridge sends.
  //    client/js/aim-bridge.js sends: { hitId, ticker, accuracy, streak, ts }
  //    and expects: { ok, duplicate, unit, ticker, balance } (or duplicate=true path)
  const r1 = await req({
    port, method: 'POST', path: '/aim/hit',
    headers: { 'X-Player-Id': playerId, 'X-Session-Id': sessionId },
    body: { hitId: 'bridge-h-1', ticker: 'AAPL', accuracy: 0.8, streak: 0, ts: Date.now() },
  });
  assert.equal(r1.status, 200, `first hit status ${r1.status} body=${JSON.stringify(r1.body)}`);
  // Exact shape contract with the bridge
  assert.equal(typeof r1.body.ok, 'boolean');
  assert.equal(typeof r1.body.duplicate, 'boolean');
  assert.equal(typeof r1.body.unit, 'number');
  assert.equal(typeof r1.body.ticker, 'string');
  assert.equal(typeof r1.body.balance, 'number');
  assert.equal(r1.body.ticker, 'AAPL');
  assert.ok(r1.body.unit > 0);
  assert.ok(r1.body.balance > 0);
  ok('POST /aim/hit shape matches client bridge expectations');

  // 2. POST again with the same hitId (idempotency). Bridge retries on
  //    network blip; server must not double-mint.
  const r2 = await req({
    port, method: 'POST', path: '/aim/hit',
    headers: { 'X-Player-Id': playerId, 'X-Session-Id': sessionId },
    body: { hitId: 'bridge-h-1', ticker: 'AAPL', accuracy: 0.8, streak: 0, ts: Date.now() },
  });
  assert.equal(r2.status, 200);
  assert.equal(r2.body.duplicate, true);
  assert.equal(r2.body.unit, r1.body.unit);
  ok('POST /aim/hit duplicate hitId is idempotent, no double-mint');

  // 3. POST with a streak > 0. Bridge computes streak from the engine;
  //    server applies the +20% bonus per 5.
  const r3 = await req({
    port, method: 'POST', path: '/aim/hit',
    headers: { 'X-Player-Id': playerId, 'X-Session-Id': sessionId },
    body: { hitId: 'bridge-h-2', ticker: 'AAPL', accuracy: 0.8, streak: 5, ts: Date.now() },
  });
  assert.equal(r3.status, 200);
  assert.ok(r3.body.unit > r1.body.unit, `streak bonus: ${r3.body.unit} > ${r1.body.unit}`);
  ok('POST /aim/hit with streak applies the +20% bonus');

  // 4. GET /portfolio shape matches what client/src/store.js reads.
  //    Bridge will call this on /missions/claim, /portfolio/order, etc.
  //    Required fields per store.js: player {id, stable, updatedAt}, balances,
  //    trades, unlocks.
  const r4 = await req({
    port, method: 'GET', path: '/portfolio',
    headers: { 'X-Player-Id': playerId },
  });
  assert.equal(r4.status, 200);
  assert.equal(typeof r4.body.player, 'object');
  assert.equal(typeof r4.body.player.id, 'string');
  assert.equal(typeof r4.body.player.stable, 'number');
  assert.equal(typeof r4.body.player.updatedAt, 'number');
  assert.equal(typeof r4.body.balances, 'object');
  assert.equal(typeof r4.body.trades, 'object'); // store.js does Array.isArray; this is fine
  assert.ok(Array.isArray(r4.body.trades));
  assert.ok(Array.isArray(r4.body.unlocks));
  // After 2 successful hits, AAPL balance must be > 0
  assert.ok((r4.body.balances.AAPL || 0) > 0, `expected AAPL>0, got ${JSON.stringify(r4.body.balances)}`);
  ok('GET /portfolio shape matches client store expectations, AAPL balance > 0');

  // 5. GET /missions shape matches what client/src/store.js reads.
  //    Required: { stable, missions: [{ kind, label, target, reward, progress, done, claimed }] }
  const r5 = await req({
    port, method: 'GET', path: '/missions',
    headers: { 'X-Player-Id': playerId },
  });
  assert.equal(r5.status, 200);
  assert.equal(typeof r5.body.stable, 'number');
  assert.ok(Array.isArray(r5.body.missions));
  assert.equal(r5.body.missions.length, 6);
  for (const m of r5.body.missions) {
    assert.equal(typeof m.kind, 'string');
    assert.equal(typeof m.label, 'string');
    assert.equal(typeof m.target, 'number');
    assert.equal(typeof m.reward, 'number');
    assert.equal(typeof m.progress, 'number');
    assert.equal(typeof m.done, 'boolean');
    assert.equal(typeof m.claimed, 'boolean');
  }
  ok('GET /missions shape matches client store expectations, 6 missions');

  // 6. POST /missions/claim shape: { ok, kind, reward, stable }
  const r6 = await req({
    port, method: 'POST', path: '/missions/claim',
    headers: { 'X-Player-Id': playerId },
    body: { kind: 'first_10_hits' },
  });
  // Not done yet (we only have 2 hits); expect 400 not_done
  assert.equal(r6.status, 400);
  assert.equal(r6.body.error, 'not_done');
  ok('POST /missions/claim returns 400 not_done before threshold');

  // 7. POST /portfolio/preview shape: { ticker, side, leverage, entry, liquidationPrice, notional, margin }
  const r7 = await req({
    port, method: 'POST', path: '/portfolio/preview',
    headers: { 'X-Player-Id': playerId },
    body: { ticker: 'AAPL', side: 'long', leverage: 5, notional: 500 },
  });
  assert.equal(r7.status, 200);
  for (const k of ['ticker', 'side', 'leverage', 'entry', 'liquidationPrice', 'notional', 'margin']) {
    assert.ok(r7.body[k] !== undefined, `preview missing ${k}`);
  }
  ok('POST /portfolio/preview shape matches client expectations');

  // 8. POST /portfolio/order requires confirmLiquidation (proves UI must
  //    call /preview first). This is the safety net for the 20x cap.
  const r8 = await req({
    port, method: 'POST', path: '/portfolio/order',
    headers: { 'X-Player-Id': playerId },
    body: { ticker: 'AAPL', side: 'long', leverage: 5, notional: 500 },
  });
  assert.equal(r8.status, 400);
  assert.equal(r8.body.error, 'confirm_required');
  ok('POST /portfolio/order without confirm -> 400 confirm_required');

  server.close();
  if (fails) { console.error(`${fails} FAILURES`); process.exit(1); }
  console.log('ALL PASS');
}

main().catch((e) => { console.error('TEST CRASH:', e && e.stack ? e.stack : e); process.exit(1); });
