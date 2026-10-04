// server/src/market/stub.js — deterministic offline provider for tests and
// for first-boot before the user has configured a real token. Quotes are
// derived from a constant base plus a deterministic per-symbol drift.
// It is NOT a real market data source. The status reports 'stub' so the
// UI can label it appropriately.

const BASES = {
  AAPL: 187.50,
  MSFT: 412.20,
  NVDA: 118.40,
  TSLA: 244.10,
  AMZN: 178.90,
  SPY: 524.30,
  SPCX: 280.00,        // SpaceX proxy, real ticker does not exist — labelled in UI
  OPENAI: 0,           // Pre-IPO
  ANTHROPIC: 0,        // Pre-IPO
};

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

function lastTs(range) {
  return Date.now();
}

function priceAt(symbol, ts) {
  const base = BASES[symbol] ?? 0;
  // tiny deterministic drift: ~+/- 0.3% per day
  const dayKey = Math.floor(ts / 86_400_000);
  const drift = Math.sin(dayKey * (symbol.charCodeAt(0) + 1)) * 0.003;
  return Math.max(0, base * (1 + drift));
}

function candlesFor(symbol, range) {
  if (BASES[symbol] === 0) return []; // Pre-IPO: no chart
  const now = Date.now();
  let step, count;
  switch (range) {
    case '1D': step = 60_000; count = 24 * 60; break;       // 1m x 1440
    case '5D': step = 5 * 60_000; count = 5 * 24 * 12; break; // 5m x 576
    case '1M': step = 60 * 60_000; count = 30 * 6; break;    // 1h x 180
    case '3M': step = 86_400_000; count = 90; break;
    default: step = 86_400_000; count = 30;
  }
  const out = [];
  let t = now - step * count;
  let prev = priceAt(symbol, t);
  for (let i = 0; i < count; i++) {
    const o = prev;
    const drift = (Math.sin((t / step) * (symbol.charCodeAt(1) + 1)) + Math.cos((t / step) * 0.3)) * 0.004;
    const c = Math.max(0, o * (1 + drift));
    const h = Math.max(o, c) * (1 + Math.abs(Math.sin(t / step)) * 0.002);
    const l = Math.min(o, c) * (1 - Math.abs(Math.cos(t / step)) * 0.002);
    out.push({ t, o: round(o, 4), h: round(h, 4), l: round(l, 4), c: round(c, 4) });
    prev = c;
    t += step;
  }
  return out;
}

function round(n, d) {
  const f = 10 ** d;
  return Math.round(n * f) / f;
}

export function createStubProvider() {
  return {
    name: 'stub',
    async getQuote(symbol) {
      if (!(symbol in BASES)) throw new Error(`unknown symbol: ${symbol}`);
      const ts = lastTs();
      if (BASES[symbol] === 0) {
        return { symbol, price: null, ts, currency: 'USD', status: 'pre_ipo' };
      }
      return { symbol, price: round(priceAt(symbol, ts), 4), ts, currency: 'USD' };
    },
    async getCandles(symbol, range) {
      return { symbol, range, candles: candlesFor(symbol, range) };
    },
    async getStatus() {
      return { provider: 'stub', status: 'stub', lastTickTs: Date.now() };
    },
    async getSymbols() {
      return Object.entries(BASES).map(([symbol, base]) => ({
        symbol,
        name: NAMES[symbol] ?? symbol,
        market: base === 0 ? 'pre_ipo' : 'us_equity',
        preIpo: base === 0,
      }));
    },
  };
}
