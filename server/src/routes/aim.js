// server/src/routes/aim.js — POST /aim/hit with rate limit + idempotency.
// Server is the ONLY place that mints simulated ticker units.

import { sendJson, HttpError, round } from '../util/json.js';

export function aimRoutes(r, { store, config }) {
  r.post('/aim/hit', async (req, res, _params, _query, body) => {
    const playerId = req.headers['x-player-id'];
    const sessionId = req.headers['x-session-id'];
    if (!playerId) throw new HttpError(400, 'missing_player_id', 'X-Player-Id header is required');
    if (!sessionId) throw new HttpError(400, 'missing_session_id', 'X-Session-Id header is required');
    const { hitId, ticker, accuracy, streak, ts } = body || {};
    if (!hitId || typeof hitId !== 'string') throw new HttpError(400, 'missing_hit_id', 'hitId is required');
    if (!ticker || typeof ticker !== 'string') throw new HttpError(400, 'missing_ticker', 'ticker is required');

    // Rate limit (per session, sliding window)
    const rate = await store.hitRateCheck({ sessionId, windowMs: 1000, maxInWindow: config.aim.hitRps });
    if (!rate.allowed) {
      throw new HttpError(429, 'rate_limited', `max ${config.aim.hitRps} hits/sec/session`);
    }

    // Idempotency (sessionId + hitId)
    const dup = await store.recordHit({ playerId, sessionId, hitId, ticker, unit: config.aim.hitUnit, ts: ts || Date.now() });
    if (dup.duplicate) {
      // Re-grant the same unit, but do NOT double-mint. Just return the recorded entry.
      return sendJson(res, 200, { ok: true, duplicate: true, unit: dup.entry.unit, ticker, accuracy, streak });
    }

    // Mint simulated units
    const acc = Number(accuracy);
    const streakN = Number(streak);
    let unit = config.aim.hitUnit;
    // Slight streak bonus: +20% per 5 in streak, capped at +50% (x1.5)
    if (Number.isFinite(streakN) && streakN > 0) {
      const bonus = Math.min(0.5, Math.floor(streakN / 5) * 0.2);
      unit = unit * (1 + bonus);
    }
    // Accuracy under 0.4 does not mint (penalty), not a full reverse
    if (Number.isFinite(acc) && acc < 0.4) unit = unit * 0.25;
    unit = round(unit, 8);

    await store.getOrCreatePlayer(playerId);
    const bal = await store.addTickerUnits(playerId, ticker, unit);

    sendJson(res, 200, {
      ok: true,
      duplicate: false,
      unit,
      ticker,
      balance: round(bal.qty, 8),
    });
  });
}
