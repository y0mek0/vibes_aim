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

function tradingStatus(ts = Date.now()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York', weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date(ts));
  const values = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  const minutes = Number(values.hour) * 60 + Number(values.minute);
  const isWeekday = values.weekday !== 'Sat' && values.weekday !== 'Sun';
  const isOpen = isWeekday && minutes >= 570 && minutes < 960;
  return { provider: 'stub', isOpen, session: isOpen ? 'regular' : 'closed', timezone: 'America/New_York', hours: '09:30–16:00 ET' };
}

function priceAt(symbol, ts) {
  const base = BASES[symbol] ?? 0;
  // Deterministic per-day drift (~+/- 0.3%) plus a per-minute micro-drift
  // so live quotes move slightly between calls inside the same day.
  // Together they make paper trading deterministic enough for tests
  // but lively enough for a real session.
  const dayKey = Math.floor(ts / 86_400_000);
  const dayDrift = Math.sin(dayKey * (symbol.charCodeAt(0) + 1)) * 0.003;
  // Use a 5-second bucket so tests that wait 1-2s between open and close
  // see a different price and can produce a non-zero pnl.
  const tickKey = Math.floor(ts / 5_000);
  const tickDrift = Math.cos(tickKey * 0.7 + symbol.charCodeAt(1)) * 0.0008;
  return Math.max(0, base * (1 + dayDrift + tickDrift));
}

function candlesFor(symbol, range) {
  if (BASES[symbol] === 0) return []; // Pre-IPO: no chart
  const now = Date.now();
  let step, count;
  switch (range) {
    case '5m': step = 60_000; count = 5; break;            // 1m x 5
    case '15m': step = 60_000; count = 15; break;          // 1m x 15
    case '1H': step = 60_000; count = 60; break;            // 1m x 60
    case '4H': step = 5 * 60_000; count = 48; break;        // 5m x 48
    // The chart is a compact 500px widget: one-minute/5-minute bars turn
    // into visual noise. Use readable 5m/30m candles while keeping the
    // requested calendar span intact.
    case '1D': step = 5 * 60_000; count = 24 * 12; break;   // 5m x 288
    case '5D': step = 30 * 60_000; count = 5 * 24 * 2; break; // 30m x 240
    case '1M': step = 60 * 60_000; count = 30 * 6; break;    // 1h x 180
    case '3M': step = 86_400_000; count = 90; break;
    default: step = 86_400_000; count = 30;
  }
  const rangeAmplitude = {
    // 5m and 15m are the short intraday views — these are the most-viewed
    // ranges, so keep the price motion small and obviously stable.
    '5m': 0.0018, '15m': 0.004,
    // 1H/4H are intraday swings: 1.2% and 2.4% tops keep them readable.
    '1H': 0.012, '4H': 0.024,
    // 1D/5D used to swing ±5.5%/±9.5% which looked broken on a quiet demo
    // feed; real AAPL rarely moves more than ~2% on a 1D view offline.
    '1D': 0.022, '5D': 0.045,
    // 1M/3M keep the broader range so the chart still feels like a chart
    // and not a flat line.
    '1M': 0.085, '3M': 0.16,
  }[range] ?? 0.05;
  const symbolSeed = symbol.split('').reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
  const out = [];
  let t = now - step * count;
  let prev = priceAt(symbol, t);
  for (let i = 0; i < count; i++) {
    const o = prev;
    // Use a range-specific walk so 5m, 15m, 1H, and longer views are not
    // the same flat candle shape. This keeps the offline provider useful for
    // the UI while remaining deterministic enough for tests.
    const phase = i / Math.max(1, count - 1);
    // Broad, low-frequency movement reads like a market session. The former
    // per-candle oscillation produced a saw-tooth "accordion" on 1D/5D.
    const wave = Math.sin(phase * Math.PI * 2 + symbolSeed * 0.11) * 0.62
      + Math.sin(phase * Math.PI * 6 + symbolSeed * 0.07) * 0.18;
    // Keep the fixture oscillating around a baseline; compounding each candle
    // made the 1D/5D preview look like a permanently rising asset.
    const center = priceAt(symbol, t) * (1 + wave * rangeAmplitude * 0.45 + (phase - 0.5) * rangeAmplitude * 0.08);
    const c = Math.max(0, center);
    const wick = rangeAmplitude * (0.05 + Math.abs(Math.sin(phase * Math.PI * 4 + symbolSeed)) * 0.05);
    const h = Math.max(o, c) * (1 + wick);
    const l = Math.min(o, c) * (1 - wick);
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
      return { symbol, price: round(priceAt(symbol, ts), 4), ts, currency: 'USD', trading: tradingStatus(ts) };
    },
    async getCandles(symbol, range) {
      return { symbol, range, candles: candlesFor(symbol, range), trading: tradingStatus() };
    },
    async getStatus() {
      return { provider: 'stub', status: 'stub', lastTickTs: Date.now() };
    },
    // The offline game provider has no exchange session. It stays tradeable
    // so local play and deterministic tests never depend on wall-clock time.
    async getTradingStatus() {
      return tradingStatus();
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
