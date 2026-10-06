// tests/auth.test.mjs — server-side Google sign-in endpoint.
//
// We mock the Google tokeninfo endpoint so this test is hermetic. The
// tests cover: happy path (id_token accepted -> player created, session
// issued), idempotency (re-sign-in returns the same player), missing
// token, malformed body, invalid token (Google rejects), wrong audience.

import assert from 'node:assert/strict';
import http from 'node:http';
import { createApp } from '../server/src/index.js';

// Capture every Google tokeninfo call so we can decide what the fake
// server should return next.
const tokeninfoCalls = [];
let nextTokeninfoResponse = { status: 200, body: {} };

// Stub global fetch so verifyGoogleIdToken hits our fake server instead
// of oauth2.googleapis.com. We restore the original on test teardown.
const realFetch = globalThis.fetch;
function fakeFetch(url, init) {
  if (typeof url === 'string' && url.startsWith('https://oauth2.googleapis.com/tokeninfo')) {
    tokeninfoCalls.push({ url, init });
    const r = nextTokeninfoResponse;
    return Promise.resolve(new Response(JSON.stringify(r.body), {
      status: r.status,
      headers: { 'content-type': 'application/json' },
    }));
  }
  return realFetch(url, init);
}

let server, port;
let failCount = 0;
const ok = (m) => console.log(`ok   ${m}`);
const bad = (m) => { failCount++; console.error(`FAIL ${m}`); };

function setToken(googleId, extra = {}) {
  nextTokeninfoResponse = {
    status: 200,
    body: {
      sub: googleId,
      email: extra.email || `${googleId}@example.com`,
      email_verified: 'true',
      name: extra.name || 'Test User',
      aud: 'test-client-id',
      iss: 'https://accounts.google.com',
      exp: Math.floor(Date.now() / 1000) + 3600,
      ...extra,
    },
  };
}

function postJson(path, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body || {});
    const req = http.request({
      method: 'POST', host: '127.0.0.1', port, path,
      headers: {
        'content-type': 'application/json',
        'content-length': Buffer.byteLength(data),
        ...headers,
      },
    }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8');
        let json = null; try { json = text ? JSON.parse(text) : null; } catch { /* */ }
        resolve({ status: res.statusCode, body: json, text });
      });
    });
    req.on('error', reject);
    req.write(data); req.end();
  });
}
function getJson(path, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request({
      method: 'GET', host: '127.0.0.1', port, path, headers,
    }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8');
        let json = null; try { json = text ? JSON.parse(text) : null; } catch { /* */ }
        resolve({ status: res.statusCode, body: json, text });
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function setup() {
  globalThis.fetch = fakeFetch;
  // Force in-memory store so we don't depend on Supabase.
  process.env.SUPABASE_URL = '';
  process.env.SUPABASE_SERVICE_KEY = '';
  // Configure the server with a known Google client id so the audience
  // check in gtoken.js actually fires. Production sets this from the
  // GOOGLE_CLIENT_ID env var; we inject it directly for the test.
  process.env.GOOGLE_CLIENT_ID = 'test-client-id';
  // Reload config + everything that depends on it. Easiest path: a
  // fresh import of the index module so deps.config is built from the
  // new env. Use a unique cache-buster query to dodge Node's ESM cache.
  const url = `../server/src/index.js?test=${Date.now()}`;
  const mod = await import(url);
  const app = mod.createApp();
  const srv = app.listen(0);
  await new Promise((r) => srv.once('listening', r));
  port = srv.address().port;
  server = srv;
}

async function teardown() {
  globalThis.fetch = realFetch;
  if (server) await new Promise((r) => server.close(r));
  delete process.env.GOOGLE_CLIENT_ID;
}

async function run() {
  await setup();

  // 1. Happy path: id_token verifies, player is created, session is returned.
  setToken('google-sub-1');
  const r1 = await postJson('/auth/google', { idToken: 'fake-token-1' });
  assert.equal(r1.status, 200, 'happy path should return 200');
  assert.ok(r1.body.sessionToken, 'sessionToken present');
  assert.equal(r1.body.player.id, 'google-sub-1', 'player id == google sub');
  assert.equal(r1.body.player.stable, 200, 'fresh player stable == 200');
  assert.equal(r1.body.mergedFromGuest, null, 'no guest to merge on first sign-in');
  ok('first sign-in creates player and issues session');
  const session1 = r1.body.sessionToken;

  // 2. /auth/me with the session token returns the player.
  const me1 = await getJson('/auth/me', { authorization: `Bearer ${session1}` });
  assert.equal(me1.status, 200);
  assert.equal(me1.body.player.id, 'google-sub-1');
  assert.equal(me1.body.player.stable, 200);
  ok('/auth/me with valid bearer returns the signed-in player');

  // 3. Idempotency: re-signing the same Google account reuses the player.
  setToken('google-sub-1');
  const r2 = await postJson('/auth/google', { idToken: 'fake-token-2' });
  assert.equal(r2.status, 200);
  assert.equal(r2.body.player.id, 'google-sub-1', 'same Google sub maps to same player');
  assert.equal(r2.body.player.stable, 200, 'stable unchanged on re-sign-in');
  ok('re-signing the same Google account reuses the existing player');

  // 4. /auth/me without bearer returns 401.
  const me2 = await getJson('/auth/me');
  assert.equal(me2.status, 401);
  ok('/auth/me without bearer returns 401');

  // 5. /auth/me with bogus bearer returns 401.
  const me3 = await getJson('/auth/me', { authorization: 'Bearer not-a-real-token' });
  assert.equal(me3.status, 401);
  ok('/auth/me with bogus bearer returns 401');

  // 6. Missing idToken returns 400.
  const r3 = await postJson('/auth/google', {});
  assert.equal(r3.status, 400);
  assert.equal(r3.body.error, 'missing_id_token');
  ok('POST /auth/google without idToken returns 400');

  // 7. Empty body returns 400.
  const r4 = await postJson('/auth/google', null);
  assert.equal(r4.status, 400);
  ok('POST /auth/google with empty body returns 400');

  // 8. Google rejects the token (network-level error from tokeninfo).
  nextTokeninfoResponse = { status: 400, body: { error_description: 'Invalid Value' } };
  const r5 = await postJson('/auth/google', { idToken: 'bad-token' });
  assert.equal(r5.status, 401, 'invalid id_token returns 401');
  assert.equal(r5.body.error, 'invalid_id_token');
  ok('Google-rejected id_token returns 401 invalid_id_token');

  // 9. Wrong audience (Google signs token for a different client).
  setToken('google-sub-1', { aud: 'attacker-client-id' });
  const r6 = await postJson('/auth/google', { idToken: 'token-with-wrong-aud' });
  assert.equal(r6.status, 401, 'wrong aud returns 401');
  assert.equal(r6.body.error, 'audience_mismatch');
  ok('id_token with wrong aud is rejected as audience_mismatch');

  // 10. Wrong issuer.
  setToken('google-sub-1', { iss: 'https://evil.example.com' });
  const r7 = await postJson('/auth/google', { idToken: 'token-from-evil' });
  assert.equal(r7.status, 401);
  assert.equal(r7.body.error, 'issuer_mismatch');
  ok('id_token with wrong iss is rejected as issuer_mismatch');

  // 11. Expired token.
  setToken('google-sub-1', { exp: Math.floor(Date.now() / 1000) - 60 });
  const r8 = await postJson('/auth/google', { idToken: 'expired-token' });
  assert.equal(r8.status, 401);
  assert.equal(r8.body.error, 'id_token_expired');
  ok('expired id_token is rejected as id_token_expired');

  // 12. signout invalidates the session.
  setToken('google-sub-2');
  const r9 = await postJson('/auth/google', { idToken: 'tok-2' });
  assert.equal(r9.status, 200);
  const s2 = r9.body.sessionToken;
  const me4 = await getJson('/auth/me', { authorization: `Bearer ${s2}` });
  assert.equal(me4.status, 200);
  const r10 = await postJson('/auth/signout', { sessionToken: s2 });
  assert.equal(r10.status, 200);
  const me5 = await getJson('/auth/me', { authorization: `Bearer ${s2}` });
  assert.equal(me5.status, 401, 'session is gone after signout');
  ok('signout invalidates the session');

  // 13. Guest merge: sign in with guestPlayerId moves the guest's state
  //     into the Google player row.
  // First create a guest and add some state.
  setToken('google-sub-3');
  const guest = `guest-${Date.now()}`;
  const hdr = { 'x-player-id': guest, 'x-session-id': `sess-${guest}` };
  // Add a few AAPL units via /aim/hit and buy a gun.
  for (let i = 0; i < 3; i++) {
    const r = await postJson('/aim/hit', {
      hitId: `g-${i}-${Date.now()}`, ticker: 'AAPL',
      accuracy: 0.9, streak: 0, ts: Date.now(), gunId: 'usp',
    }, hdr);
    if (r.status !== 200) { console.error('aim/hit failed:', r); }
    assert.equal(r.status, 200);
  }
  // Sign in passing the guest id; we expect the Google player to
  // receive the AAPL balance that the guest had.
  const r11 = await postJson('/auth/google', {
    idToken: 'tok-merge', guestPlayerId: guest,
  });
  assert.equal(r11.status, 200);
  assert.equal(r11.body.player.id, 'google-sub-3');
  assert.equal(r11.body.mergedFromGuest, guest, 'mergedFromGuest returned');
  // The merged player should now have the AAPL units the guest earned.
  const me6 = await getJson('/auth/me', { authorization: `Bearer ${r11.body.sessionToken}` });
  assert.equal(me6.body.balances.AAPL, 0.0024, 'AAPL balance is merged from guest');
  ok('guest progress is merged into the new Google account');

  // 14. The guest's stable + balances are merged too.
  setToken('google-sub-4');
  const guest2 = `guest-stable-${Date.now()}`;
  const hdr2 = { 'x-player-id': guest2, 'x-session-id': `sess-${guest2}` };
  const stableBefore = 200;
  const r12 = await postJson('/auth/google', { idToken: 'tok-merge-2', guestPlayerId: guest2 });
  assert.equal(r12.status, 200);
  assert.equal(r12.body.player.stable, stableBefore, 'stable carries over from guest');
  ok('guest stable carries over on merge');

  await teardown();
  if (failCount > 0) { console.error(`\n${failCount} FAILURES`); process.exit(1); }
  console.log('\nALL PASS');
}

run().catch((e) => { console.error(e); teardown().finally(() => process.exit(1)); });
