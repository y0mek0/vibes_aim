import assert from 'node:assert/strict';
import { createApp } from '../server/src/index.js';
import { createStore } from '../server/src/db/store.js';

const store = createStore();
const privy = {
  config: { enabled: true },
  async verifyGoogleUser(accessToken) {
    if (accessToken === 'bad-token') throw new Error('invalid_privy_access_token');
    if (accessToken === 'new-token') {
      return { user_id: 'did:privy:new-user', googleId: 'google-new', email: 'new@example.com' };
    }
    return { user_id: 'did:privy:legacy-user', googleId: 'google-legacy', email: 'legacy@example.com' };
  },
  async verifyWallet() { throw new Error('not_used'); },
};

const legacy = await store.createPlayerWithGoogle({ googleId: 'google-legacy', email: 'old@example.com' });
await store.addStable(legacy.id, 75);
const { listen } = createApp({ store, privy });
const server = listen(0);
await new Promise((resolve) => server.once('listening', resolve));
const port = server.address().port;
const base = `http://127.0.0.1:${port}`;

try {
  const missing = await fetch(`${base}/auth/privy`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
  assert.equal(missing.status, 401);

  const migrated = await fetch(`${base}/auth/privy`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: 'Bearer legacy-token' },
    body: '{}',
  });
  assert.equal(migrated.status, 200);
  const migratedBody = await migrated.json();
  assert.equal(migratedBody.player.id, legacy.id);
  assert.equal(migratedBody.player.stable, 275);
  assert.equal((await store.findPlayerByPrivyId({ privyId: 'did:privy:legacy-user' })).id, legacy.id);

  const me = await fetch(`${base}/auth/me`, { headers: { authorization: `Bearer ${migratedBody.sessionToken}` } });
  assert.equal(me.status, 200);
  assert.equal((await me.json()).player.id, legacy.id);

  const fresh = await fetch(`${base}/auth/privy`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: 'Bearer new-token' },
    body: '{}',
  });
  assert.equal(fresh.status, 200);
  assert.equal((await fresh.json()).player.id, 'privy-did:privy:new-user');

  const invalid = await fetch(`${base}/auth/privy`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: 'Bearer bad-token' },
    body: '{}',
  });
  assert.equal(invalid.status, 401);
  console.log('Privy Google identity migration: ALL PASS');
} finally {
  await new Promise((resolve) => server.close(resolve));
}
