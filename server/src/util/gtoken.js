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

import { HttpError } from './json.js';

const TOKENINFO_URL = 'https://oauth2.googleapis.com/tokeninfo';

export async function verifyGoogleIdToken(idToken, { clientId } = {}) {
  if (!idToken || typeof idToken !== 'string') {
    throw new HttpError(400, 'missing_id_token', 'idToken is required');
  }
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
  // Audience check: the token must have been issued for our OAuth client.
  if (clientId && payload.aud && payload.aud !== clientId) {
    throw new HttpError(401, 'audience_mismatch', 'id_token was issued for a different OAuth client');
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
