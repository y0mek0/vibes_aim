// tests/hold60s.test.mjs — focused 60-second real-time test for the
// hold_60s mission. This test does NOT run by default in the fast
// `npm test` chain. It is invoked explicitly via `npm run test:slow`
// because waiting 60+ seconds in every CI run is hostile to developer
// experience.
//
// The fast chain still asserts the pure-function rules (>= 60_000 ms,
// long + closed) in tests/missions.test.mjs. This file proves the
// server actually respects the threshold over a real 60-second wait.

import http from 'node:http';
import assert from 'node:assert/strict';

let fails = 0;
const ok  = (m) => console.log(`ok   ${m}`);
const bad = (m) => { fails++; console.error(`FAIL ${m}`); };

process.env.AIM_HIT_RPS = '5000';
const { createApp } = await import('../server/src/index.js');
const { listen } = createApp();
const server = listen(0);
await new Promise((r) => server.once('listening', r));
const port = server.address().port;

function req({ method, path, headers = {}, body }) {
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
        let json = null; try { json = JSON.parse(text); } catch { /* keep */ }
        resolve({ status: res.statusCode, body: json, text });
      });
    });
    r.on('error', reject);
    if (data) r.write(data);
    r.end();
  });
}

const playerId = 'hold60s-player';
const sessionId = 'hold60s-session';

// 1. open a long position
const o = await req({
  method: 'POST', path: '/portfolio/order', headers: { 'X-Player-Id': playerId, 'X-Session-Id': sessionId },
  body: { ticker: 'AAPL', side: 'long', leverage: 1, notional: 100, confirmLiquidation: true },
});
assert.equal(o.status, 200, `order open: ${o.status} ${o.text}`);
const tradeId = o.body.trade.id;
ok(`opened long position ${tradeId.slice(0, 8)} at ${new Date().toISOString()}`);

// 2. wait the full 60 seconds. Print a heartbeat so the user knows
//    the test is alive.
const TOTAL_MS = 60_000;
const TICK_MS = 10_000;
const start = Date.now();
for (let elapsed = 0; elapsed < TOTAL_MS; elapsed = Date.now() - start) {
  if (elapsed > 0) console.log(`     ... ${Math.round(elapsed / 1000)}s elapsed`);
  await new Promise((r) => setTimeout(r, Math.min(TICK_MS, TOTAL_MS - elapsed)));
}
ok(`waited 60s (real wall-clock)`);

// 3. close the position. closedAt - createdAt should be ~60_001 ms.
const c = await req({
  method: 'POST', path: '/portfolio/close', headers: { 'X-Player-Id': playerId },
  body: { tradeId },
});
assert.equal(c.status, 200);
const dur = c.body.trade.closedAt - c.body.trade.createdAt;
assert.ok(dur >= 60_000, `closedAt - createdAt should be >= 60_000, got ${dur}`);
ok(`closed position, duration ${dur}ms`);

// 4. missions endpoint reports hold_60s as done.
const m = await req({ method: 'GET', path: '/missions', headers: { 'X-Player-Id': playerId } });
assert.equal(m.status, 200);
const h = m.body.missions.find((x) => x.kind === 'hold_60s');
assert.ok(h, 'hold_60s mission in list');
assert.equal(h.done, true, 'hold_60s should be done after a 60s+ hold');
ok('GET /missions shows hold_60s as done after a real 60s hold');

// 5. claim should credit the reward.
const claim = await req({
  method: 'POST', path: '/missions/claim', headers: { 'X-Player-Id': playerId },
  body: { kind: 'hold_60s' },
});
assert.equal(claim.status, 200);
assert.equal(claim.body.reward, 200);
ok('claim hold_60s -> +200 Stable');

server.close();
if (fails) { console.error(`${fails} FAILURES`); process.exit(1); }
console.log('ALL PASS');
