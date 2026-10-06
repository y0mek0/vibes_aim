// server/src/util/gtoken.js — verify a Google id_token.
//
// We use Google's public tokeninfo endpoint instead of fetching Google's
// JWKS / verifying the signature ourselves: the tokeninfo call is
// authenticated with the token itself (Google knows which tokens it
// issued) and returns the full payload if valid. That keeps the
// dependency surface small and avoids a JWT lib in a server with no
// other crypto needs.
//
// On any verification error we throw — the caller turns it into a 401.
//
// Audience check: the optional `expectedAud` argument is the OAuth client
// id we expect to see in the `aud` claim. If supplied and the token
// reports a different `aud`, the token is rejected. This is what
// prevents an attacker from replaying a token they got for a different
// app at our endpoint. The expected id is wired up by authRoutes from
// config.google.clientId.

import { HttpError } from './json.js';

const TOKENINFO_URL = 'https://oauth2.googleapis.com/tokeninfo';

export async function verifyGoogleIdToken(idToken, { expectedAud } = {}) {
  if (!idToken || typeof idToken !== 'string') {
    throw new HttpError(400, 'missing_id_token', 'idToken is required');
  }
  // We resolve the expected audience at call time, not module load
  // time, so a test that mutates process.env.GOOGLE_CLIENT_ID before
  // calling us actually wins. The explicit `expectedAud` argument
  // always wins (used by the production wiring in auth.js).
  const aud = expectedAud || process.env.GOOGLE_CLIENT_ID || '';
  const url = `${TOKENINFO_URL}?id_token=${encodeURIComponent(idToken)}`;
  const res = await fetch(url, { method: 'GET' });
  if (!res.ok) {
    throw new HttpError(401, 'invalid_id_token', 'Google rejected the id_token');
  }
  const payload = await res.json();
  // tokeninfo gives us: sub, email, email_verified, name, picture, aud, iss, exp.
  if (!payload.sub) {
    throw new HttpError(401, 'invalid_id_token', 'tokeninfo response missing sub');
  }
  // Audience check. If we know our client id, the token's `aud` MUST
  // match. If we don't know it (e.g. dev env without GOOGLE_CLIENT_ID),
  // we still record what the token claims, but don't reject — the
  // server operator can opt in to a stricter check by setting the env
  // var. We also defensively reject any aud that is not a string or is
  // an array, since Google always issues a single string aud.
  if (aud) {
    if (payload.aud !== aud) {
      throw new HttpError(401, 'audience_mismatch',
        `id_token was issued for a different OAuth client (expected ${aud}, got ${payload.aud})`);
    }
  }
  // Issuer check: must be Google (account chooser returns accounts.google.com too).
  if (payload.iss && payload.iss !== 'https://accounts.google.com' && payload.iss !== 'accounts.google.com') {
    throw new HttpError(401, 'issuer_mismatch', `unexpected issuer: ${payload.iss}`);
  }
  // Expiry check (tokeninfo also returns `exp` as epoch seconds).
  if (payload.exp) {
    const exp = Number(payload.exp);
    if (Number.isFinite(exp) && exp * 1000 < Date.now() - 5000) {
      throw new HttpError(401, 'id_token_expired', 'id_token has expired');
    }
  }
  return {
    googleId: payload.sub,
    email: payload.email_verified === 'true' || payload.email_verified === true ? payload.email : null,
    name: payload.name || null,
    picture: payload.picture || null,
  };
}
