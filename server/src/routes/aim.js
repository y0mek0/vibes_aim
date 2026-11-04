// server/src/routes/aim.js — POST /aim/hit with rate limit + idempotency.
// Server is the ONLY place that mints simulated ticker units.

import { sendJson, HttpError, round } from '../util/json.js';
import { getEarnMult, GUNS_CATALOG } from '../data/loadout.js';
import { getBoostTickerForGun } from '../../../client/js/data/nvda-boost.js';

export function aimRoutes(r, { store, config, holding }) {
  r.post('/aim/hit', async (req, res, _params, _query, body) => {
    const playerId = req.headers['x-player-id'];
    const sessionId = req.headers['x-session-id'];
    if (!playerId) throw new HttpError(400, 'missing_player_id', 'X-Player-Id header is required');
    if (!sessionId) throw new HttpError(400, 'missing_session_id', 'X-Session-Id header is required');
    const { hitId, ticker, accuracy, streak, ts } = body || {};
    if (!hitId || typeof hitId !== 'string') throw new HttpError(400, 'missing_hit_id', 'hitId is required');
    if (!ticker || typeof ticker !== 'string') throw new HttpError(400, 'missing_ticker', 'ticker is required');
    const boostTicker = getBoostTickerForGun(body?.gunId, GUNS_CATALOG);

    // AAPL, NVDA, TSLA and MSFT are active farm tickers from the start.
    const FREE_FARM_TICKERS = new Set(['AAPL', 'NVDA', 'TSLA', 'MSFT']);
    const PRE_IPO = new Set(['OPENAI', 'ANTHROPIC']);
    const unlocks = await store.listUnlocks(playerId);
    const effectiveTicker = boostTicker || ticker;
    if (!FREE_FARM_TICKERS.has(effectiveTicker) && !PRE_IPO.has(effectiveTicker) && !unlocks.some((unlock) => unlock.ticker === effectiveTicker)) {
      throw new HttpError(400, 'ticker_locked', `Ticker ${effectiveTicker} is not active for farming yet.`);
    }

    const holdingStatus = holding ? await holding.getVerifiedStatus(req.headers['x-wallet-proof']) : null;
    const holdingMultiplier = holdingStatus?.multiplier || 1;

    // Rate limit (per session, sliding window)
    const rate = await store.hitRateCheck({ sessionId, windowMs: 1000, maxInWindow: config.aim.hitRps });
    if (!rate.allowed) {
      throw new HttpError(429, 'rate_limited', `max ${config.aim.hitRps} hits/sec/session`);
    }

    // Mint simulated units. The base rate belongs to the effective ticker;
    // boosts route the reward before the gun, holding, streak, and accuracy multipliers.
    const acc = Number(accuracy);
    const streakN = Number(streak);
    const earnMult = getEarnMult(body?.gunId);
    const baseUnit = config.aim.hitUnits[effectiveTicker] ?? config.aim.hitUnits.AAPL;
    let unit = baseUnit * earnMult * holdingMultiplier;
    // Slight streak bonus: +20% per 5 in streak, capped at +50% (x1.5)
    if (Number.isFinite(streakN) && streakN > 0) {
      const bonus = Math.min(0.5, Math.floor(streakN / 5) * 0.2);
      unit = unit * (1 + bonus);
    }
    // Accuracy under 0.4 does not mint (penalty), not a full reverse
    if (Number.isFinite(acc) && acc < 0.4) unit = unit * 0.25;
    unit = round(unit, 8);

    // Idempotency (sessionId + hitId). Persist the final calculated unit so a
    // retry returns exactly what the original hit minted.
    const dup = await store.recordHit({ playerId, sessionId, hitId, ticker: effectiveTicker, unit, ts: ts || Date.now() });
    if (dup && dup.duplicate) {
      const recordedUnit = (dup.entry && typeof dup.entry.unit === 'number') ? dup.entry.unit : 0;
      return sendJson(res, 200, {
        ok: true, duplicate: true, unit: recordedUnit, ticker: effectiveTicker,
        accuracy, streak, boostedTicker: boostTicker, nvdaBoosted: boostTicker === 'NVDA',
        holdingMultiplier, holdingVerified: !!holdingStatus,
      });
    }

    await store.getOrCreatePlayer(playerId);
    if (Number.isFinite(acc)) await store.recordAccuracy(playerId, acc);
    const bal = await store.addTickerUnits(playerId, effectiveTicker, unit);

    sendJson(res, 200, {
      ok: true,
      duplicate: false,
      unit,
      ticker: effectiveTicker,
      boostedTicker: boostTicker,
      nvdaBoosted: boostTicker === 'NVDA',
      holdingMultiplier,
      holdingVerified: !!holdingStatus,
      balance: round(bal.qty, 8),
    });
  });
}
