// tests/missions.test.mjs — missions panel + AAPL -> NVDA unlock tests.
//
// Two layers:
//   1) Pure-function tests on client/src/missions-core.js: each mission's
//      progress math, allMissionsClaimed, describeUnlocks, formatProgress.
//   2) Integration tests against the live server: hit the missions
//      endpoint, claim a few, assert NVDA unlocks after the 6th claim.
//
// Run: node tests/missions.test.mjs (from vibes_aim/)

import http from 'node:http';
import assert from 'node:assert/strict';
import {
  MISSIONS, missionProgress, allMissionsClaimed,
  describeUnlocks, formatProgress, NVDA_UNLOCK,
} from '../client/src/missions-core.js';

// Set env BEFORE importing the server so config.js reads the new value.
// The default AIM_HIT_RPS is 15; raise it for the integration burst test.
process.env.AIM_HIT_RPS = '5000';

let fails = 0;
const ok  = (m) => console.log(`ok   ${m}`);
const bad = (m) => { fails++; console.error(`FAIL ${m}`); };

// ---------- Pure helpers ----------
{
  // 6 missions defined and all unique
  assert.equal(MISSIONS.length, 6);
  const kinds = new Set(MISSIONS.map((m) => m.kind));
  assert.equal(kinds.size, 6);
  ok('MISSIONS has 6 unique entries');
}
{
  // first_10_hits: counts hits
  let r = missionProgress(MISSIONS[0], { hits: 0 });
  assert.equal(r.progress, 0);
  assert.equal(r.done, false);
  r = missionProgress(MISSIONS[0], { hits: 5 });
  assert.equal(r.progress, 5);
  assert.equal(r.done, false);
  r = missionProgress(MISSIONS[0], { hits: 10 });
  assert.equal(r.progress, 10);
  assert.equal(r.done, true);
  ok('first_10_hits counts hits');
}
{
  // earn_half_aapl: counts earned AAPL
  let r = missionProgress(MISSIONS[1], { earnedAapl: 0.3 });
  assert.equal(r.done, false);
  assert.equal(r.progress, 0.3);
  r = missionProgress(MISSIONS[1], { earnedAapl: 0.5 });
  assert.equal(r.done, true);
  r = missionProgress(MISSIONS[1], { earnedAapl: 1.0 });
  assert.equal(r.done, true);
  // progress caps at target
  assert.equal(r.progress, 0.5);
  ok('earn_half_aapl caps at target and flips at 0.5');
}
{
  // first_trade: counts closed trades
  const trades = [
    { id: '1', status: 'open' },
    { id: '2', status: 'closed', pnl: -5 },
    { id: '3', status: 'liquidated', pnl: -10 },
  ];
  const r = missionProgress(MISSIONS[2], { trades });
  // closed + liquidated count as closed (status !== 'open').
  // Progress is clamped to the target (1).
  assert.equal(r.progress, 1);
  assert.equal(r.done, true);
  ok('first_trade counts closed + liquidated as closed, clamps progress to target');
}
{
  // first_profit: only positive pnl
  const trades = [
    { id: '1', status: 'closed', pnl: -5 },
    { id: '2', status: 'closed', pnl: 10 },
    { id: '3', status: 'liquidated', pnl: -20 },
  ];
  const r = missionProgress(MISSIONS[3], { trades });
  assert.equal(r.progress, 1);
  assert.equal(r.done, true);
  ok('first_profit counts only positive pnl');
}
{
  // hold_60s: long trade that survived >= 60s (real MVP threshold).
  // Boundary cases: exactly 60s -> done, 59.999s -> not done.
  const t1 = { side: 'long', status: 'closed', createdAt: 0, closedAt: 60_000 };
  const t2 = { side: 'long', status: 'closed', createdAt: 0, closedAt: 59_999 };
  let r = missionProgress(MISSIONS[4], { trades: [t1] });
  assert.equal(r.done, true);
  r = missionProgress(MISSIONS[4], { trades: [t2] });
  assert.equal(r.done, false);
  // short doesn't count even after 9999s
  r = missionProgress(MISSIONS[4], { trades: [{ side: 'short', status: 'closed', createdAt: 0, closedAt: 9999 }] });
  assert.equal(r.done, false);
  // open (not closed) doesn't count
  r = missionProgress(MISSIONS[4], { trades: [{ side: 'long', status: 'open', createdAt: 0 }] });
  assert.equal(r.done, false);
  ok('hold_60s requires long + closed + duration >= 60s');
}
{
  // precise_session: accuracy >= 0.7
  let r = missionProgress(MISSIONS[5], { preciseBest: 0.5 });
  assert.equal(r.done, false);
  r = missionProgress(MISSIONS[5], { preciseBest: 0.7 });
  assert.equal(r.done, true);
  r = missionProgress(MISSIONS[5], { preciseBest: 1.0 });
  assert.equal(r.done, true);
  assert.equal(r.progress, 0.7);
  ok('precise_session requires 0.7 accuracy');
}
{
  // allMissionsClaimed
  assert.equal(allMissionsClaimed([]), false);
  assert.equal(allMissionsClaimed(MISSIONS.map((m) => ({ kind: m.kind, claimed: true }))), true);
  assert.equal(allMissionsClaimed(MISSIONS.map((m) => ({ kind: m.kind, claimed: false }))), false);
  // one missing
  const five = MISSIONS.slice(0, 5).map((m) => ({ kind: m.kind, claimed: true }));
  assert.equal(allMissionsClaimed(five), false);
  ok('allMissionsClaimed requires every mission claimed');
}
{
  // describeUnlocks
  assert.deepEqual(describeUnlocks([]).unlockedTickers, []);
  assert.deepEqual(
    describeUnlocks(MISSIONS.map((m) => ({ kind: m.kind, claimed: true }))).unlockedTickers,
    [NVDA_UNLOCK],
  );
  ok('describeUnlocks returns [NVDA] when all claimed, [] otherwise');
}
{
  // formatProgress
  assert.equal(formatProgress(MISSIONS[0], 5), '5 / 10');
  assert.equal(formatProgress(MISSIONS[0], 10), '10 / 10');
  assert.equal(formatProgress(MISSIONS[1], 0.3), '0.30 / 0.50');
  assert.equal(formatProgress(MISSIONS[2], 1), 'done');
  assert.equal(formatProgress(MISSIONS[2], 0.5), '0.5 / 1');
  assert.equal(formatProgress(MISSIONS[3], 0), '0 / 1');
  ok('formatProgress formats integer, fractional, and done cases');
}
{
  // unknown kind returns done:false, progress:0
  const r = missionProgress({ kind: 'made_up', target: 1 }, { hits: 999 });
  assert.equal(r.done, false);
  assert.equal(r.progress, 0);
  ok('unknown mission kind returns safe defaults');
}

// ---------- Integration tests against the live server ----------
async function integration() {
  const { createApp } = await import('../server/src/index.js');
  // AIM_HIT_RPS was raised at the top of this file so config.js picks
  // it up at import time.
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

  const playerId = 'missions-player';
  const sessionId = 'missions-session';

  // 1. /missions returns 6 entries
  const m1 = await req({ method: 'GET', path: '/missions', headers: { 'X-Player-Id': playerId } });
  assert.equal(m1.status, 200);
  assert.equal(m1.body.missions.length, 6);
  ok('GET /missions returns 6 missions for a new player');

  // 2. claim not done -> 400
  const c0 = await req({
    method: 'POST', path: '/missions/claim', headers: { 'X-Player-Id': playerId },
    body: { kind: 'first_10_hits' },
  });
  assert.equal(c0.status, 400);
  assert.equal(c0.body.error, 'not_done');
  ok('POST /missions/claim before threshold -> 400 not_done');

  // 3. earn half aapl: send many hits then claim
  for (let i = 0; i < 700; i++) {
    await req({
      method: 'POST', path: '/aim/hit',
      headers: { 'X-Player-Id': playerId, 'X-Session-Id': sessionId },
      body: { hitId: `mh${i}`, ticker: 'AAPL', accuracy: 0.9, streak: 0, ts: Date.now() },
    });
  }
  const claimAapl = await req({
    method: 'POST', path: '/missions/claim', headers: { 'X-Player-Id': playerId },
    body: { kind: 'earn_half_aapl' },
  });
  assert.equal(claimAapl.status, 200);
  assert.equal(claimAapl.body.kind, 'earn_half_aapl');
  assert.equal(claimAapl.body.reward, 250);
  assert.ok(claimAapl.body.stable > 1000);
  ok('POST /missions/claim earn_half_aapl credits 250 Stable');

  // 4. open + close a profitable trade. We wait 6s so the stub price
  // drifts to a different tickKey -> the close is profitable ->
  // first_profit mission completes. hold_60s is covered by a focused
  // 60s test below; we do not wait 60s here.
  const o = await req({
    method: 'POST', path: '/portfolio/order', headers: { 'X-Player-Id': playerId },
    body: { ticker: 'AAPL', side: 'long', leverage: 1, notional: 100, confirmLiquidation: true },
  });
  assert.equal(o.status, 200);
  await new Promise((r) => setTimeout(r, 6100)); // wait 6s for price drift -> different tickKey -> close is profitable
  const c = await req({
    method: 'POST', path: '/portfolio/close', headers: { 'X-Player-Id': playerId },
    body: { tradeId: o.body.trade.id },
  });
  assert.equal(c.status, 200);
  ok('open + close round-trip completed (used by first_trade / first_profit)');

  // 5. claim first_10_hits, first_trade, first_profit (hold_60s is in a focused test below)
  for (const kind of ['first_10_hits', 'first_trade', 'first_profit']) {
    const r = await req({
      method: 'POST', path: '/missions/claim', headers: { 'X-Player-Id': playerId },
      body: { kind },
    });
    assert.equal(r.status, 200, `claim ${kind} status ${r.status} body ${JSON.stringify(r.body)}`);
  }
  ok('3 missions claimed (first_10_hits, first_trade, first_profit)');

  // 6. precise_session needs player.preciseBest >= 0.7. The 700 hits
  //    we just sent had accuracy 0.9, so the server recorded
  //    preciseBest = 0.9 -> mission is done.
  const claim6 = await req({
    method: 'POST', path: '/missions/claim', headers: { 'X-Player-Id': playerId },
    body: { kind: 'precise_session' },
  });
  assert.equal(claim6.status, 200, `claim precise_session status ${claim6.status} body ${JSON.stringify(claim6.body)}`);
  ok('6th mission (precise_session) claimed (real accuracy, >= 0.7)');

  // 7. /portfolio should now include NVDA in unlocks
  const p = await req({ method: 'GET', path: '/portfolio', headers: { 'X-Player-Id': playerId } });
  assert.equal(p.status, 200);
  const unlocks = (p.body.unlocks || []).map((u) => u.ticker);
  assert.ok(unlocks.includes('NVDA'), `expected NVDA in unlocks, got ${JSON.stringify(unlocks)}`);
  ok('all 6 missions claimed -> NVDA unlocked for the player');

  // 8. /missions/claim already-claimed mission -> 400 already_claimed
  const dup = await req({
    method: 'POST', path: '/missions/claim', headers: { 'X-Player-Id': playerId },
    body: { kind: 'first_10_hits' },
  });
  assert.equal(dup.status, 400);
  assert.equal(dup.body.error, 'already_claimed');
  ok('POST /missions/claim already-claimed -> 400 already_claimed');

  // 9. unknown mission kind -> 404
  const unk = await req({
    method: 'POST', path: '/missions/claim', headers: { 'X-Player-Id': playerId },
    body: { kind: 'made_up' },
  });
  assert.equal(unk.status, 404);
  ok('POST /missions/claim unknown kind -> 404');

  server.close();
}

await integration();

if (fails) { console.error(`${fails} FAILURES`); process.exit(1); }
console.log('ALL PASS');
