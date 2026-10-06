// server/src/util/session.js — server-side session tokens.
//
// We don't use JWTs here: state is small (player id + expiry) and we
// already have Postgres, so we mint a random opaque token, store its
// SHA-256 hash in `sessions`, and look it up on every request. The raw
// token only leaves the server once (in the /auth response body).
//
// Hashing: SHA-256 is enough here because the token is 256 bits of CSPRNG
// output. We never store the raw token, so a database leak does not
// leak active sessions.

import { createHash, randomBytes } from 'node:crypto';

const DEFAULT_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

function sha256(s) {
  return createHash('sha256').update(s).digest('hex');
}

export function newSessionToken() {
  // 32 bytes -> 256 bits of entropy -> 43 base64url chars. We do not add
  // a prefix; the sessions table treats the hash as opaque.
  return randomBytes(32).toString('base64url');
}

export function hashSessionToken(token) {
  return sha256(token);
}

export function newSession({ store, playerId, ttlMs = DEFAULT_TTL_MS }) {
  const token = newSessionToken();
  const tokenHash = hashSessionToken(token);
  const expiresAt = new Date(Date.now() + ttlMs).toISOString();
  // supabaseStore requires ISO strings; memoryStore accepts Date.
  // We pass ISO and the supabase path returns a string; the memory
  // path returns the original Date we set.
  return store.createSession({ tokenHash, playerId, expiresAt }).then(() => ({
    token,
    expiresAt,
  }));
}

export function lookupSession({ store, token }) {
  if (!token) return null;
  return store.findSessionByHash({ tokenHash: hashSessionToken(token) });
}

export function destroySession({ store, tokenHash }) {
  return store.deleteSession({ tokenHash });
}
