// server/src/routes/auth.js — Google sign-in.
//
// POST /auth/google      { idToken, guestPlayerId? }
//   -> { sessionToken, expiresAt, player }
//
// Flow:
//   1. Verify the Google id_token (server-side via Google's tokeninfo).
//   2. Look up an existing player by google_id; create one if missing.
//   3. If guestPlayerId is supplied, merge guest state into the Google
//      player (additive for balances/unlocks/missions/trades/loadout;
//      never overwrites). The guest id is then released.
//   4. Mint a server-side session_token and persist its hash in
//      `sessions`.
//
// POST /auth/signout     { sessionToken }
//   -> { ok: true }
//
// GET  /auth/me            Authorization: Bearer <sessionToken>
//   -> { player, stable, balances, ... }

import { sendJson, HttpError, round } from '../util/json.js';
import { verifyGoogleIdToken } from '../util/gtoken.js';
import { newSession, hashSessionToken, destroySession, lookupSession } from '../util/session.js';

function readBearer(req) {
  const h = req.headers['authorization'] || '';
  const m = /^Bearer\s+(.+)$/i.exec(h);
  return m ? m[1].trim() : null;
}

function playerView(store, playerId) {
  return store.getOrCreatePlayer(playerId).then((p) => ({
    id: p.id,
    stable: p.stable,
    updatedAt: p.updatedAt,
    email: p.email || null,
  }));
}

export function authRoutes(r, { store, config }) {
  r.post('/auth/google', async (req, res, _params, _query, body) => {
    const { idToken, guestPlayerId } = body || {};
    if (!idToken) throw new HttpError(400, 'missing_id_token', 'idToken is required');

    const claims = await verifyGoogleIdToken(idToken, { clientId: config.google.clientId });
    // The Google id_token is the source of truth for the user identity;
    // anything else the client claims (guestPlayerId) is best-effort.
    if (!claims.googleId) {
      throw new HttpError(401, 'invalid_id_token', 'Google id_token missing subject');
    }

    // 1. Find or create the player row tied to this Google account.
    const existing = await store.findPlayerByGoogleId({ googleId: claims.googleId });
    let player;
    if (existing) {
      // Refresh email/name in case they updated their Google profile.
      player = await store.updatePlayerIdentity({
        playerId: existing.id,
        email: claims.email,
      });
    } else {
      player = await store.createPlayerWithGoogle({
        googleId: claims.googleId,
        email: claims.email,
      });
    }

    // 2. Optionally merge a guest player into this account.
    let mergedFromGuest = null;
    if (guestPlayerId && guestPlayerId !== player.id) {
      const guest = await store.getPlayer(guestPlayerId);
      if (guest && !guest.google_id) {
        // Guest is unclaimed — safe to merge.
        await store.mergeGuestIntoPlayer({ fromPlayerId: guestPlayerId, toPlayerId: player.id });
        mergedFromGuest = guestPlayerId;
      }
    }

    // 3. Mint a server-side session.
    const { token, expiresAt } = await newSession({ store, playerId: player.id });

    const view = await playerView(store, player.id);
    sendJson(res, 200, {
      ok: true,
      sessionToken: token,
      expiresAt,
      player: view,
      mergedFromGuest,
    });
  });

  r.post('/auth/signout', async (req, res, _params, _query, body) => {
    const token = (body && body.sessionToken) || readBearer(req);
    if (!token) {
      sendJson(res, 200, { ok: true });
      return;
    }
    await destroySession({ store, tokenHash: hashSessionToken(token) });
    sendJson(res, 200, { ok: true });
  });

  r.get('/auth/me', async (req, res) => {
    const token = readBearer(req);
    if (!token) {
      sendJson(res, 401, { error: 'unauthenticated' });
      return;
    }
    const session = await lookupSession({ store, token });
    if (!session) {
      sendJson(res, 401, { error: 'invalid_session' });
      return;
    }
    if (session.expiresAt && new Date(session.expiresAt) < new Date()) {
      await destroySession({ store, tokenHash: hashSessionToken(token) });
      sendJson(res, 401, { error: 'session_expired' });
      return;
    }
    const view = await playerView(store, session.playerId);
    const balances = await store.getAllBalances(session.playerId);
    const trades = await store.listTrades(session.playerId);
    const unlocks = await store.listUnlocks(session.playerId);
    sendJson(res, 200, { player: view, balances, trades, unlocks });
  });
}
