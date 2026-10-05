// server/src/routes/portfolio.js — paper trading: open / close positions.
// All math is server-side. Long/short, leverage up to 20x, liquidation preview
// before confirmation. No real money, no broker, no debt: on liquidation,
// position closes, balance reflects realized P/L, and Stable is never negative.

import { sendJson, HttpError, round, clamp } from '../util/json.js';

const MAX_LEVERAGE = 20;

// Unlock check: AAPL is always farmable. Pre-IPO tickers (OPENAI,
// ANTHROPIC) are checked separately by the market layer (returns price:
// null), so we skip them here. Any other ticker must be unlocked by the
// player (default unlocks are empty, so a fresh player cannot preview
// or open a position on TSLA / NVDA / etc.).
const PRE_IPO = new Set(['OPENAI', 'ANTHROPIC']);
async function assertTickerUnlocked(store, playerId, ticker) {
  if (ticker === 'AAPL') return;
  if (PRE_IPO.has(ticker)) return; // pre-IPO tickers are checked via price
  const unlocks = await store.listUnlocks(playerId);
  if (!unlocks.some((u) => u.ticker === ticker)) {
    throw new HttpError(400, 'ticker_locked', `Ticker ${ticker} is not unlocked. Complete the AAPL chain to unlock NVDA.`);
  }
}

export function portfolioRoutes(r, { market, store }) {
  // GET /portfolio?playerId=... — current state snapshot
  r.get('/portfolio', async (req, res, _params, query) => {
    const playerId = query.playerId || req.headers['x-player-id'];
    if (!playerId) throw new HttpError(400, 'missing_player_id');
    const player = await store.getOrCreatePlayer(playerId);
    const balances = await store.getAllBalances(playerId);
    const trades = await store.listTrades(playerId);
    const unlocks = await store.listUnlocks(playerId);
    sendJson(res, 200, {
      player: { id: player.id, stable: player.stable, updatedAt: player.updatedAt },
      balances,
      trades,
      unlocks,
    });
  });

  // POST /portfolio/preview — given ticker/side/leverage/notional, return
  // the entry and liquidation price without opening a position.
  r.post('/portfolio/preview', async (req, res, _params, _query, body) => {
    const { ticker, side, leverage, notional } = body || {};
    if (!ticker || !side) throw new HttpError(400, 'bad_request', 'ticker and side required');
    if (!['long', 'short'].includes(side)) throw new HttpError(400, 'bad_side');
    // Unlock check: read X-Player-Id from headers (preview is usually
    // sent from the chart panel which knows the player).
    const playerId = req.headers['x-player-id'];
    if (playerId) await assertTickerUnlocked(store, playerId, ticker);
    const lev = clamp(Number(leverage) || 1, 1, MAX_LEVERAGE);
    const q = await market.getQuote(ticker);
    if (q.price == null) throw new HttpError(400, 'no_price', `${ticker} is awaiting market`);
    const entry = q.price;
    const liq = computeLiquidationPrice(side, entry, lev);
    const size = Number(notional) || entry; // default size = 1 share worth
    sendJson(res, 200, {
      ticker, side, leverage: lev, entry, liquidationPrice: liq,
      notional: round(size * lev, 6),
      margin: round(size / lev, 6),
    });
  });

  // POST /portfolio/order — open a position. Body: { ticker, side, leverage, notional, confirmLiquidation }
  r.post('/portfolio/order', async (req, res, _params, _query, body) => {
    const playerId = req.headers['x-player-id'];
    if (!playerId) throw new HttpError(400, 'missing_player_id');
    const { ticker, side, leverage, notional, confirmLiquidation } = body || {};
    if (!ticker || !side) throw new HttpError(400, 'bad_request', 'ticker and side required');
    if (!['long', 'short'].includes(side)) throw new HttpError(400, 'bad_side');
    await assertTickerUnlocked(store, playerId, ticker);
    const lev = clamp(Number(leverage) || 1, 1, MAX_LEVERAGE);
    const q = await market.getQuote(ticker);
    if (q.price == null) throw new HttpError(400, 'no_price', `${ticker} is awaiting market`);
    const entry = q.price;
    const liq = computeLiquidationPrice(side, entry, lev);
    if (confirmLiquidation !== true) {
      // UI must call /preview first, then POST with confirmLiquidation: true.
      throw new HttpError(400, 'confirm_required', 'Call /portfolio/preview first, then POST with confirmLiquidation:true');
    }
    const size = Number(notional) || entry;
    // Margin = notional / leverage. With leverage 5x and notional 100,
    // you commit 20 as margin and control 100 of position. Matches
    // client/src/terminal-core.js#computeOrder and the /close return.
    const margin = size / lev;
    const player = await store.getOrCreatePlayer(playerId);
    if (player.stable < margin) throw new HttpError(400, 'insufficient_margin', `need ${margin.toFixed(2)} stable, have ${player.stable.toFixed(2)}`);
    await store.addStable(playerId, -margin);
    const trade = await store.openTrade({
      playerId, ticker, side, leverage: lev,
      qty: round(size / entry, 8), // number of shares
      entryPrice: entry,
      liquidationPrice: liq,
    });
    sendJson(res, 200, { ok: true, trade });
  });

  // POST /portfolio/close — close an open trade at current market price.
  r.post('/portfolio/close', async (req, res, _params, _query, body) => {
    const playerId = req.headers['x-player-id'];
    if (!playerId) throw new HttpError(400, 'missing_player_id');
    const { tradeId } = body || {};
    if (!tradeId) throw new HttpError(400, 'missing_trade_id');
    const t = await store.getTrade(tradeId);
    if (!t) throw new HttpError(404, 'not_found');
    if (t.playerId !== playerId) throw new HttpError(403, 'forbidden');
    if (t.status !== 'open') throw new HttpError(400, 'not_open');
    const q = await market.getQuote(t.ticker);
    if (q.price == null) throw new HttpError(400, 'no_price');
    const exit = q.price;
    const liq = computeLiquidationPrice(t.side, t.entryPrice, t.leverage);
    let status = 'closed', pnl;
    if ((t.side === 'long' && exit <= liq) || (t.side === 'short' && exit >= liq)) {
      // Liquidated: full margin lost.
      pnl = -((t.entryPrice * t.qty) / t.leverage);
      status = 'liquidated';
    } else {
      const sign = t.side === 'long' ? 1 : -1;
      pnl = sign * (exit - t.entryPrice) * t.qty;
    }
    pnl = round(pnl, 6);
    // Return margin + pnl to stable (on liquidation, only pnl is negative; margin is already gone)
    const margin = (t.entryPrice * t.qty) / t.leverage;
    const returned = status === 'liquidated' ? Math.max(0, margin + pnl) : margin + pnl;
    await store.addStable(playerId, round(returned, 6));
    const updated = await store.closeTrade(t.id, { exitPrice: exit, pnl, status });
    sendJson(res, 200, { ok: true, trade: updated });
  });
}

// Liquidation rule (toy): 100% loss of margin at the 1/leverage move.
// For a long with leverage L at entry E: liq = E * (1 - 1/L).
// For a short: liq = E * (1 + 1/L).
export function computeLiquidationPrice(side, entry, leverage) {
  const move = 1 / leverage;
  const liq = side === 'long' ? entry * (1 - move) : entry * (1 + move);
  return round(liq, 6);
}
