// client/js/chart.js — mini chart panel for the floating corner widget.
// Uses TradingView Lightweight Charts via the importmap entry
// "lightweight-charts". Fetches initial candles from /market/candles,
// updates the latest candle every 1s from /market/quote, and shows a
// stale label if no fresh tick arrives for STALE_AFTER_MS.
//
// Public API:
//   import { mountChart, setActiveTicker, fetchCandles, fetchQuote,
//            buildHeader, buildStatus } from './chart.js';
//
// The module is import-safe in environments where lightweight-charts is
// not present (tests). In that case, mountChart returns a no-op handle.

import { api } from '../src/api.js';

const STALE_AFTER_MS = 5000;
const POLL_MS = 1000;

let TV = null;
let lightweightChartsPromise = null;

function loadLightweightCharts() {
  if (TV) return Promise.resolve(TV);
  if (!lightweightChartsPromise) {
    lightweightChartsPromise = import('lightweight-charts')
      .then((m) => { TV = m; return m; })
      .catch((err) => { console.warn('[vibes] lightweight-charts load failed:', err && err.message); return null; });
  }
  return lightweightChartsPromise;
}

// --- Pure helpers (testable) -----------------------------------------

export function accentColor(t) {
  if (t === 'NVDA') return '#7df9c5';
  if (t === 'SPCX') return '#ffb347';
  if (t === 'OPENAI' || t === 'ANTHROPIC') return '#9aa3b2';
  return '#c9ccd1';
}

export function fmtPrice(n) {
  if (n == null || !Number.isFinite(n)) return '—';
  return n.toFixed(2);
}

export function fmtChange(pct) {
  if (pct == null || !Number.isFinite(pct)) return '—';
  const sign = pct >= 0 ? '+' : '';
  return `${sign}${pct.toFixed(2)}%`;
}

// Build the candle series data the chart expects.
export function buildSeriesData(candles) {
  return (candles || []).map((c) => ({
    time: Math.floor((c.t || 0) / 1000),
    open: c.o, high: c.h, low: c.l, close: c.c,
  }));
}

// Decide what text the status badge should show, and whether it's stale.
export function buildStatus({ lastTickTs, marketStatus, isPreIpo, error } = {}) {
  if (isPreIpo) return { text: 'awaiting market', stale: true };
  if (error)    return { text: 'error: ' + (error.message || error), stale: true };
  if (marketStatus === 'stub') {
    return { text: 'offline stub', stale: false };
  }
  if (!lastTickTs) return { text: 'connecting…', stale: false };
  return { text: 'live', stale: false };
}

// Decide the price + change for a quote.
export function buildHeader(quote) {
  if (!quote) return { price: '—', change: '—', changeClass: '' };
  if (quote.status === 'pre_ipo' || quote.price == null) {
    return { price: '—', change: '—', changeClass: '' };
  }
  const change = (quote.dp != null) ? quote.dp : null;
  const changeClass = change == null ? '' : (change >= 0 ? 'pos' : 'neg');
  return { price: fmtPrice(quote.price), change: fmtChange(change), changeClass };
}

// --- Network wrappers (testable) --------------------------------------

export async function fetchCandles(ticker, range) {
  return api.get(`/market/candles/${encodeURIComponent(ticker)}`, { query: { range } });
}
export async function fetchQuote(ticker) {
  return api.get(`/market/quote/${encodeURIComponent(ticker)}`);
}

// --- Live mount --------------------------------------------------------

function setText(el, value) { if (el) el.textContent = value; }

export function mountChart({ root, ticker = 'AAPL', range = '1D' } = {}) {
  const panel = root || document.getElementById('vibes-chart');
  if (!panel) return { unmount() {}, setTicker() {}, setRange() {}, state: null };
  panel.hidden = false;
  panel.dataset.ticker = ticker;

  const els = {
    ticker:  panel.querySelector('[data-vc-ticker]'),
    price:   panel.querySelector('[data-vc-price]'),
    change:  panel.querySelector('[data-vc-change]'),
    status:  panel.querySelector('[data-vc-status]'),
    body:    panel.querySelector('[data-vc-body]'),
    tickerBtns: Array.from(panel.querySelectorAll('[data-vc-ticker-btn]')),
    rangeBtns:  Array.from(panel.querySelectorAll('[data-vc-range-btn]')),
  };
  if (els.ticker) els.ticker.textContent = ticker;
  els.tickerBtns.forEach((b) => b.classList.toggle('active', b.dataset.vcTickerBtn === ticker));
  els.rangeBtns.forEach((b) => b.classList.toggle('active', b.dataset.vcRangeBtn === range));

  let chart = null;
  let series = null;
  let lastTickTs = 0;
  let pollTimer = null;
  let staleTimer = null;
  let active = { ticker, range };
  let stopped = false;

  async function ensureChart() {
    if (chart || stopped) return;
    const LWC = await loadLightweightCharts();
    if (!LWC || !LWC.createChart || !els.body) return;
    els.body.innerHTML = '';
    chart = LWC.createChart(els.body, {
      layout: {
        background: { type: 'solid', color: '#11141b' },
        textColor: '#8a91a0',
        fontFamily: 'JetBrains Mono, ui-monospace, monospace',
        fontSize: 11,
      },
      grid: {
        vertLines: { color: 'rgba(255,255,255,0.04)' },
        horzLines: { color: 'rgba(255,255,255,0.04)' },
      },
      timeScale: { timeVisible: true, secondsVisible: false, borderColor: 'rgba(255,255,255,0.06)' },
      rightPriceScale: { borderColor: 'rgba(255,255,255,0.06)' },
      crosshair: { mode: 1 },
      autoSize: true,
    });
    const color = accentColor(active.ticker);
    series = chart.addCandlestickSeries({
      upColor: color, downColor: '#ff5d6c',
      borderUpColor: color, borderDownColor: '#ff5d6c',
      wickUpColor: color, wickDownColor: '#ff5d6c',
    });
  }

  function markStatus(text, stale = false) {
    if (!els.status) return;
    els.status.textContent = text;
    els.status.classList.toggle('stale', !!stale);
  }

  function applyHeader(quote) {
    const h = buildHeader(quote);
    setText(els.price, h.price);
    setText(els.change, h.change);
    if (els.change) {
      els.change.classList.remove('pos', 'neg');
      if (h.changeClass) els.change.classList.add(h.changeClass);
    }
  }

  async function loadCandles() {
    markStatus('loading…');
    try {
      const r = await fetchCandles(active.ticker, active.range);
      if (!r || !Array.isArray(r.candles) || r.candles.length === 0) {
        markStatus('no data', true);
        return;
      }
      await ensureChart();
      if (!series) return;
      series.setData(buildSeriesData(r.candles));
      chart && chart.timeScale().fitContent();
      markStatus(`updated ${new Date().toLocaleTimeString()}`);
    } catch (e) {
      markStatus('error: ' + (e && e.message || e), true);
    }
  }

  async function pollOnce() {
    try {
      const q = await fetchQuote(active.ticker);
      if (q && q.price != null) {
        const t = q.ts || Date.now();
        if (series) series.update({ time: Math.floor(t / 1000), value: q.price });
        applyHeader(q);
        lastTickTs = Date.now();
        markStatus('live');
        clearTimeout(staleTimer);
        staleTimer = setTimeout(() => { if (!stopped) markStatus('stale', true); }, STALE_AFTER_MS);
      } else if (q && q.status === 'pre_ipo') {
        markStatus('awaiting market', true);
        setText(els.price, '—');
        setText(els.change, '—');
      }
    } catch (_) { /* keep last good state */ }
  }

  function startPolling() {
    stopPolling();
    pollTimer = setInterval(pollOnce, POLL_MS);
  }
  function stopPolling() {
    if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
    if (staleTimer) { clearTimeout(staleTimer); staleTimer = null; }
  }

  els.tickerBtns.forEach((b) => b.addEventListener('click', () => {
    const t = b.dataset.vcTickerBtn;
    if (!t || t === active.ticker) return;
    setActiveTicker(t);
  }));
  els.rangeBtns.forEach((b) => b.addEventListener('click', () => {
    const r = b.dataset.vcRangeBtn;
    if (!r || r === active.range) return;
    active.range = r;
    els.rangeBtns.forEach((x) => x.classList.toggle('active', x === b));
    loadCandles();
  }));

  function setActiveTicker(t) {
    if (!t) return;
    active.ticker = t;
    panel.dataset.ticker = t;
    if (els.ticker) els.ticker.textContent = t;
    els.tickerBtns.forEach((b) => b.classList.toggle('active', b.dataset.vcTickerBtn === t));
    if (chart) {
      const color = accentColor(t);
      try {
        series.applyOptions({
          upColor: color, downColor: '#ff5d6c',
          borderUpColor: color, borderDownColor: '#ff5d6c',
          wickUpColor: color, wickDownColor: '#ff5d6c',
        });
      } catch (_) { /* noop */ }
    }
    loadCandles();
  }

  loadCandles().then(() => {
    if (stopped) return;
    pollOnce();
    startPolling();
  });

  function unmount() {
    stopped = true;
    stopPolling();
    try { chart && chart.remove(); } catch (_) { /* noop */ }
    chart = null; series = null;
  }

  return { unmount, setTicker: setActiveTicker, setRange: (r) => { active.range = r; loadCandles(); }, state: () => ({ ...active }) };
}

export function setActiveTicker(t) {
  const panel = document.getElementById('vibes-chart');
  if (!panel) return;
  const btn = panel.querySelector(`[data-vc-ticker-btn="${t}"]`);
  if (btn) btn.click();
}

// Auto-mount when this module loads in a real browser.
if (typeof window !== 'undefined') {
  queueMicrotask(() => {
    if (document.getElementById('vibes-chart')) {
      mountChart({ ticker: 'AAPL', range: '1D' });
    }
  });
}
