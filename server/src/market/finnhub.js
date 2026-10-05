// server/src/market/finnhub.js — Finnhub adapter.
//
// We keep this adapter isolated. It does NOT import a fetch polyfill — we
// use Node's built-in fetch (Node 18+). Auth is via the `X-Finnhub-Token`
// header or `?token=` query. The token is read from config.market.finnhubToken.
//
// If the token is empty, the adapter is created in a "no-token" state and
// getQuote/getCandles throw HttpError(503, 'market_not_configured'). This
// keeps the rest of the server alive — tests pass without a real token,
// and the UI can show a "configure market data" message.

import { HttpError } from '../util/json.js';

const FINNHUB_BASE = 'https://finnhub.io/api/v1';
const FINNHUB_WS = 'wss://ws.finnhub.io';

const NAMES = {
  AAPL: 'Apple Inc.',
  MSFT: 'Microsoft Corp.',
  NVDA: 'NVIDIA Corp.',
  TSLA: 'Tesla Inc.',
  AMZN: 'Amazon.com Inc.',
  SPY: 'SPDR S&P 500 ETF Trust',
  SPCX: 'SpaceX (proxy)',
  OPENAI: 'OpenAI (Pre-IPO)',
  ANTHROPIC: 'Anthropic (Pre-IPO)',
};

// RANGES (matching provider.js)
const RANGE_TO_FH = {
  '15m': { resolution: 1, fromDays: 15 / 1440, aggregate: '1' },
  '1H': { resolution: 1, fromDays: 1 / 24, aggregate: '1' },
  '4H': { resolution: 5, fromDays: 4 / 24, aggregate: '5' },
  '1D': { resolution: 1, fromDays: 1, aggregate: '1' },
  '5D': { resolution: 5, fromDays: 5, aggregate: '5' },
  '1M': { resolution: 60, fromDays: 30, aggregate: '60' },
  '3M': { resolution: 'D', fromDays: 90, aggregate: 'D' },
};

function requireToken(token) {
  if (!token) throw new HttpError(503, 'market_not_configured', 'Finnhub token is not set. Add FINNHUB_TOKEN to server/.env.');
}

async function fhGet(path, token, params = {}) {
  requireToken(token);
  const url = new URL(FINNHUB_BASE + path);
  Object.entries(params).forEach(([k, v]) => { if (v != null) url.searchParams.set(k, String(v)); });
  const res = await fetch(url, { headers: { 'X-Finnhub-Token': token } });
  if (!res.ok) {
    const body = await res.text();
    throw new HttpError(502, 'market_provider_error', `Finnhub ${res.status}: ${body.slice(0, 200)}`);
  }
  return res.json();
}

function addSocketListener(socket, event, listener) {
  if (typeof socket?.addEventListener === 'function') {
    socket.addEventListener(event, listener);
    return;
  }
  if (typeof socket?.on === 'function') {
    socket.on(event, listener);
    return;
  }
  throw new Error('Finnhub WebSocket does not expose addEventListener/on');
}

// Finnhub WebSocket trade payloads use: { type: 'trade', data: [{ p, s, t, v }] }.
// A malformed or unrelated event is ignored rather than ending a live stream.
export function parseFinnhubTradeMessage(raw, symbol) {
  let payload;
  try {
    const candidate = typeof raw === 'string'
      ? raw
      : (typeof raw?.data === 'string' ? raw.data : raw);
    payload = typeof candidate === 'string' ? JSON.parse(candidate) : candidate;
  } catch (_) {
    return [];
  }
  if (payload?.type !== 'trade' || !Array.isArray(payload.data)) return [];
  return payload.data
    .filter((trade) => trade?.s === symbol && Number.isFinite(Number(trade.p)))
    .map((trade) => ({
      symbol,
      price: Number(trade.p),
      // Finnhub trade timestamps are epoch milliseconds. Keep a safe
      // local fallback for a malformed upstream timestamp.
      ts: Number.isFinite(Number(trade.t)) ? Number(trade.t) : Date.now(),
      currency: 'USD',
    }));
}

function makeFinnhubSubscriber({ token, WebSocketImpl }) {
  return function subscribe(symbol, listener) {
    if (!(symbol in NAMES)) throw new HttpError(400, 'unknown_symbol', symbol);
    // There is no upstream feed for the game's Pre-IPO labels. Deliver a
    // deterministic no-price state so SSE preserves existing semantics.
    if (NAMES[symbol].includes('Pre-IPO')) {
      let closed = false;
      queueMicrotask(() => {
        if (!closed) listener({ symbol, price: null, ts: Date.now(), currency: 'USD', status: 'pre_ipo' });
      });
      return { unsubscribe: () => { closed = true; } };
    }
    requireToken(token);
    if (typeof WebSocketImpl !== 'function') return null;

    let closed = false;
    const url = `${FINNHUB_WS}?token=${encodeURIComponent(token)}`;
    const socket = new WebSocketImpl(url);
    const stop = () => {
      if (closed) return;
      closed = true;
      try { socket.close(); } catch (_) { /* noop */ }
    };
    addSocketListener(socket, 'open', () => {
      if (!closed) socket.send(JSON.stringify({ type: 'subscribe', symbol }));
    });
    addSocketListener(socket, 'message', (event) => {
      if (closed) return;
      for (const tick of parseFinnhubTradeMessage(event, symbol)) listener(tick);
    });
    // A close/error leaves the client-side stale indicator to do its job.
    // The SSE layer keeps its connection alive and does not spin retries.
    addSocketListener(socket, 'close', () => { closed = true; });
    addSocketListener(socket, 'error', () => {});
    return { unsubscribe: stop };
  };
}

export function createFinnhubProvider({ token, WebSocketImpl = globalThis.WebSocket } = {}) {
  return {
    name: 'finnhub',
    subscribe: makeFinnhubSubscriber({ token, WebSocketImpl }),
    async getQuote(symbol) {
      if (!(symbol in NAMES)) throw new HttpError(400, 'unknown_symbol', symbol);
      if (NAMES[symbol].includes('Pre-IPO')) {
        return { symbol, price: null, ts: Date.now(), currency: 'USD', status: 'pre_ipo' };
      }
      const data = await fhGet('/quote', token, { symbol });
      // Finnhub /quote returns: c (current), d (change), dp (change %), h, l, o, pc, t
      if (!data || data.c == null || data.c === 0) {
        throw new HttpError(502, 'market_provider_empty', `Finnhub returned no quote for ${symbol}`);
      }
      return { symbol, price: data.c, ts: (data.t ? data.t * 1000 : Date.now()), currency: 'USD' };
    },
    async getCandles(symbol, range) {
      const r = RANGE_TO_FH[range];
      if (!r) throw new HttpError(400, 'bad_range', range);
      const to = Math.floor(Date.now() / 1000);
      const from = to - r.fromDays * 86_400;
      const data = await fhGet('/stock/candle', token, { symbol, resolution: r.resolution, from, to });
      if (!data || data.s !== 'ok' || !Array.isArray(data.t)) {
        return { symbol, range, candles: [] };
      }
      const candles = data.t.map((t, i) => ({
        t: t * 1000,
        o: data.o[i], h: data.h[i], l: data.l[i], c: data.c[i],
      }));
      return { symbol, range, candles };
    },
    async getStatus() {
      return { provider: 'finnhub', status: token ? 'live' : 'unconfigured', lastTickTs: Date.now() };
    },
    async getTradingStatus() {
      // Finnhub owns the exchange-calendar logic (weekends, holidays and
      // special sessions). A malformed/unavailable response is fail-closed:
      // no new paper order is opened without an explicit isOpen: true.
      const data = await fhGet('/stock/market-status', token, { exchange: 'US' });
      return {
        provider: 'finnhub',
        isOpen: data?.isOpen === true,
        session: data?.session || (data?.isOpen === true ? 'regular' : 'closed'),
        holiday: data?.holiday || null,
      };
    },
    async getSymbols() {
      // The fixed game set; we don't query Finnhub for the symbol list.
      return ['AAPL', 'MSFT', 'NVDA', 'TSLA', 'AMZN', 'SPY', 'SPCX', 'OPENAI', 'ANTHROPIC']
        .map((symbol) => ({
          symbol,
          name: NAMES[symbol] ?? symbol,
          market: NAMES[symbol]?.includes('Pre-IPO') ? 'pre_ipo' : 'us_equity',
          preIpo: NAMES[symbol]?.includes('Pre-IPO') ?? false,
        }));
    },
  };
}
