// server/src/routes/market.js — read-only market data routes.
import { sendJson, HttpError } from '../util/json.js';
import { RANGES } from '../market/provider.js';

export function marketRoutes(r, { market }) {
  r.get('/market/status', async (_req, res) => {
    sendJson(res, 200, await market.getStatus());
  });

  r.get('/market/symbols', async (_req, res) => {
    sendJson(res, 200, { symbols: await market.getSymbols() });
  });

  r.get('/market/quote/:symbol', async (_req, res, params) => {
    try {
      const q = await market.getQuote(params.symbol);
      sendJson(res, 200, q);
    } catch (e) {
      if (e.status) return sendJson(res, e.status, { error: e.code, message: e.message });
      sendJson(res, 502, { error: 'market_provider_error', message: e.message });
    }
  });

  r.get('/market/candles/:symbol', async (_req, res, params, query) => {
    const range = query.range || '1D';
    if (!RANGES.includes(range)) throw new HttpError(400, 'bad_range', `range must be one of ${RANGES.join(', ')}`);
    try {
      const c = await market.getCandles(params.symbol, range);
      sendJson(res, 200, c);
    } catch (e) {
      if (e.status) return sendJson(res, e.status, { error: e.code, message: e.message });
      sendJson(res, 502, { error: 'market_provider_error', message: e.message });
    }
  });
}
