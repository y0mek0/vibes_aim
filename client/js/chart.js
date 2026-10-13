// client/js/chart.js — mini chart panel for the floating corner widget.
// Uses TradingView Lightweight Charts 5.x via the standalone CDN build.
// "lightweight-charts". Fetches initial candles from /market/candles,
// updates the latest candle every 1s from /market/quote, and shows a
// stale label if no fresh tick arrives for STALE_AFTER_MS.
//
// Public API:
//   import { mountChart, setActiveTicker, fetchCandles, fetchQuote,
//            buildHeader, buildStatus } from './chart.js?v=20261013-4';
//
// The module is import-safe in environments where lightweight-charts is
// not present (tests). In that case, mountChart returns a no-op handle.

import { api } from '../src/api.js?v=20261013-6';
import { store } from '../src/store.js?v=20261013-6';

const STALE_AFTER_MS = 15_000;
const POLL_MS = 5_000;
const RANGE_SECONDS = {
  '5m': 60,
  '15m': 60,
  '1H': 60,
  '4H': 5 * 60,
  '1D': 5 * 60,
  '5D': 30 * 60,
  '1M': 60 * 60,
  '3M': 24 * 60 * 60,
};

let TV = null;
let lightweightChartsPromise = null;
const LIGHTWEIGHT_CHARTS_CDN = 'https://cdn.jsdelivr.net/npm/lightweight-charts@5.2.1/dist/lightweight-charts.standalone.production.js';

function loadLightweightCharts() {
  if (TV) return Promise.resolve(TV);
  if (!lightweightChartsPromise) {
    lightweightChartsPromise = new Promise((resolve) => {
      if (typeof window === 'undefined' || typeof document === 'undefined') { resolve(null); return; }
      if (window.LightweightCharts) { TV = window.LightweightCharts; resolve(TV); return; }
      const script = document.createElement('script');
      script.src = LIGHTWEIGHT_CHARTS_CDN;
      script.async = true;
      script.onload = () => { TV = window.LightweightCharts || null; resolve(TV); };
      script.onerror = () => { console.warn('[vibes] lightweight-charts load failed'); resolve(null); };
      document.head.appendChild(script);
    });
  }
  return lightweightChartsPromise;
}

// --- Pure helpers (testable) -----------------------------------------

export function accentColor(t) {
  if (t === 'NVDA') return '#f6d447';
  if (t === 'SPCX') return '#f6d447';
  if (t === 'OPENAI' || t === 'ANTHROPIC') return '#9aa3b2';
  return '#c9ccd1';
}

// True when the range spans hours rather than days. Used to decide
// whether the chart axis labels should show HH:MM (intraday) or a date
// (1D/5D).
export function isIntraday(range) {
  if (!range) return false;
  return /^(\d+)?[mM]$/.test(range) || /^(\d+)?[hH]$/.test(range);
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
  const seen = new Set();
  return (candles || [])
    .map((c) => ({
      time: Math.floor((c.t || 0) / 1000),
      open: Number(c.o), high: Number(c.h), low: Number(c.l), close: Number(c.c),
    }))
    .filter((c) => c.time > 0 && [c.open, c.high, c.low, c.close].every(Number.isFinite))
    .sort((a, b) => a.time - b.time)
    .filter((c) => {
      if (seen.has(c.time)) return false;
      seen.add(c.time);
      return true;
    });
}

export function rangeSeconds(range) {
  return RANGE_SECONDS[range] || RANGE_SECONDS['1D'];
}

export function bucketTime(ts, range) {
  const seconds = Math.floor(Number(ts) / 1000);
  const step = rangeSeconds(range);
  return Math.floor(seconds / step) * step;
}

export function mergeLiveCandle(last, price, ts, range) {
  const value = Number(price);
  if (!Number.isFinite(value)) return last || null;
  const time = bucketTime(ts, range);
  if (!last || time > last.time) {
    return { time, open: value, high: value, low: value, close: value };
  }
  if (time < last.time) return last;
  return {
    time: last.time,
    open: last.open,
    high: Math.max(last.high, value),
    low: Math.min(last.low, value),
    close: value,
  };
}

function formatTooltipTime(time, range) {
  if (!Number.isFinite(Number(time))) return '—';
  const date = new Date(Number(time) * 1000);
  const options = isIntraday(range)
    ? { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }
    : { month: 'short', day: 'numeric', year: 'numeric' };
  return new Intl.DateTimeFormat('en-US', options).format(date);
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

// EventSource-driven live updates. Tries the SSE feed first; if the
// stream is unavailable (older server, transport blocked), every
// incoming tick simply stops and the polling timer below keeps the UI
// fresh, so SSE is a strict upgrade — never a regression.
export function openQuoteStream(ticker, onTick) {
  if (typeof EventSource === 'undefined') return () => {};
  // Vercel serverless responses cannot keep this connection alive reliably.
  // Use the 5-second quote poll there; SSE stays opt-in for deployed hosts.
  const host = typeof window !== 'undefined' ? window.location.hostname : '';
  const isLocal = host === '127.0.0.1' || host === 'localhost';
  if (!isLocal && window.VIBES_SSE_ENABLED !== true) return () => {};
  let closed = false;
  // SSE must hit the API origin, not the static-host origin. EventSource
  // can not set cross-origin mode (it is always same-origin), so we
  // expand the URL through api.baseUrl() and fall back to a relative
  // path when the static host is also the API host.
  const base = (typeof window !== 'undefined' && api.baseUrl) ? api.baseUrl() : '';
  const url = `${base}/market/stream/${encodeURIComponent(ticker)}`;
  const es = new EventSource(url);
  es.addEventListener('tick', (ev) => {
    if (closed) return;
    try { onTick(JSON.parse(ev.data)); } catch (_) { /* malformed */ }
  });
  es.addEventListener('error', () => {
    // EventSource auto-reconnects; do nothing. If the server returns
    // a non-2xx status EventSource dispatches a final error and stops
    // retrying. We just fall back to polling — that's fine.
  });
  return () => {
    if (closed) return;
    closed = true;
    try { es.close(); } catch (_) { /* noop */ }
  };
}

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
  let markersApi = null;
  let markers = [];
  let lastTickTs = 0;
  let pollTimer = null;
  let staleTimer = null;
  let active = { ticker, range };
  let loadSeq = 0;
  let stopped = false;
  let candleData = [];
  let lastLiveCandle = null;

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
        vertLines: { color: 'rgba(255,255,255,0.08)' },
        horzLines: { color: 'rgba(255,255,255,0.08)' },
      },
      timeScale: {
        visible: true,
        timeVisible: isIntraday(range),
        secondsVisible: false,
        borderColor: 'rgba(255,255,255,0.18)',
        rightOffset: 2,
        fixLeftEdge: true,
        fixRightEdge: true,
        lockVisibleTimeRangeOnResize: true,
        rightBarStaysOnScroll: true,
        allowShiftVisibleRangeOnWhitespace: false,
      },
      rightPriceScale: {
        visible: true,
        borderColor: 'rgba(255,255,255,0.18)',
        entireTextOnly: true,
        scaleMargins: { top: 0.12, bottom: 0.18 },
      },
      handleScale: { axisPressedMouseMove: true, mouseWheel: true, pinch: true },
      handleScroll: { mouseWheel: true, pressedMouseMove: true, horzTouchDrag: true, vertTouchDrag: true },
      crosshair: {
        mode: 0,
        vertLine: {
          visible: true,
          width: 1,
          color: 'rgba(246,212,71,0.55)',
          style: 2,
          labelVisible: true,
          labelBackgroundColor: '#f6d447',
        },
        horzLine: {
          visible: true,
          width: 1,
          color: 'rgba(246,212,71,0.55)',
          style: 2,
          labelVisible: true,
          labelBackgroundColor: '#f6d447',
        },
      },
      autoSize: true,
    });
    const color = '#f6d447';
    series = chart.addSeries(LWC.CandlestickSeries, {
      upColor: color,
      downColor: '#9aa3b2',
      borderUpColor: color,
      borderDownColor: '#9aa3b2',
      wickUpColor: color,
      wickDownColor: '#9aa3b2',
      priceFormat: { type: 'price', precision: 2, minMove: 0.01 },
      lastValueVisible: true,
      priceLineVisible: true,
      priceLineColor: 'rgba(246,212,71,0.75)',
      priceLineWidth: 1,
    });
    if (typeof LWC.createSeriesMarkers === 'function') {
      markersApi = LWC.createSeriesMarkers(series, markers);
    }
    const tooltip = document.createElement('div');
    tooltip.className = 'vc-tooltip';
    tooltip.hidden = true;
    els.body.appendChild(tooltip);
    const renderTooltip = (param) => {
      if (!param || !param.time || !param.point || !param.seriesData) {
        tooltip.hidden = true;
        return;
      }
      const candle = param.seriesData.get(series);
      if (!candle) { tooltip.hidden = true; return; }
      tooltip.innerHTML = `<b>${formatTooltipTime(param.time, active.range)}</b><span>O ${fmtPrice(candle.open)}</span><span>H ${fmtPrice(candle.high)}</span><span>L ${fmtPrice(candle.low)}</span><span>C ${fmtPrice(candle.close)}</span>`;
      tooltip.hidden = false;
      const left = Math.max(6, Math.min(els.body.clientWidth - tooltip.offsetWidth - 6, param.point.x + 12));
      const top = Math.max(6, Math.min(els.body.clientHeight - tooltip.offsetHeight - 6, param.point.y + 12));
      tooltip.style.left = `${left}px`;
      tooltip.style.top = `${top}px`;
    };
    chart.subscribeCrosshairMove(renderTooltip);
  }

  function addMarker({ ticker = active.ticker, kind, price, ts = Date.now(), id } = {}) {
    if (!kind || ticker !== active.ticker || !Number.isFinite(Number(price))) return;
    const marker = {
      time: bucketTime(ts, active.range),
      position: /SELL|SHORT|CLOSE/.test(kind) ? 'aboveBar' : 'belowBar',
      color: '#f6d447',
      shape: /SELL|SHORT|CLOSE/.test(kind) ? 'arrowDown' : 'arrowUp',
      text: kind,
      id: id || `${kind}-${ts}`,
    };
    if (markers.some((m) => m.id === marker.id)) return;
    markers = [...markers, marker].slice(-40);
    try { markersApi?.setMarkers(markers); } catch (_) { /* optional plugin */ }
  }

  function markStatus(text, stale = false) {
    if (!els.status) return;
    els.status.textContent = text;
    els.status.classList.toggle('stale', !!stale);
  }

  function marketLabel(trading) {
    if (!trading || trading.isOpen !== false) return null;
    return `Market closed · regular session ${trading.hours || '09:30–16:00 ET'}`;
  }

  function applyHeader(quote) {
    const h = buildHeader(quote);
    setText(els.price, h.price);
    setText(els.change, h.change);
    document.querySelectorAll('[data-vc-price-label]').forEach((el) => { el.textContent = h.price; });
    document.querySelectorAll('[data-vc-ticker-label]').forEach((el) => { el.textContent = active.ticker; });
    if (els.change) {
      els.change.classList.remove('pos', 'neg');
      if (h.changeClass) els.change.classList.add(h.changeClass);
    }
  }

  async function loadCandles() {
    const requestId = ++loadSeq;
    const requestedTicker = active.ticker;
    const requestedRange = active.range;
    markStatus('loading…');
    try {
      const r = await fetchCandles(requestedTicker, requestedRange);
      if (stopped || requestId !== loadSeq || active.ticker !== requestedTicker || active.range !== requestedRange) return;
      if (!r || !Array.isArray(r.candles) || r.candles.length === 0) {
        markStatus('no data', true);
        return;
      }
      await ensureChart();
      if (!series || stopped || requestId !== loadSeq) return;
      candleData = buildSeriesData(r.candles);
      lastLiveCandle = candleData[candleData.length - 1] || null;
      series.setData(candleData);
      try { markersApi?.setMarkers(candleData.length ? markers.filter((m) => m.time >= candleData[0].time) : markers); } catch (_) { /* optional plugin */ }
      if (chart) {
        const scale = chart.timeScale();
        scale.applyOptions({ timeVisible: isIntraday(requestedRange), rightOffset: 2 });
        scale.fitContent();
      }
      markStatus(marketLabel(r.trading) || `updated ${new Date().toLocaleTimeString()}`);
    } catch (e) {
      markStatus('error: ' + (e && e.message || e), true);
    }
  }

  function applyLiveQuote(quote) {
    if (!quote || quote.price == null || !series) return;
    const next = mergeLiveCandle(lastLiveCandle, quote.price, quote.ts || Date.now(), active.range);
    if (!next || next === lastLiveCandle) return;
    lastLiveCandle = next;
    if (candleData.length && candleData[candleData.length - 1].time === next.time) {
      candleData[candleData.length - 1] = next;
    } else {
      candleData = [...candleData, next].slice(-600);
    }
    series.update(next);
  }

  async function pollOnce() {
      try {
        const q = await fetchQuote(active.ticker);
        if (q && q.price != null) {
          applyLiveQuote(q);
          applyHeader(q);
          lastTickTs = Date.now();
          markStatus(marketLabel(q.trading) || 'live');
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

    // SSE — when available, prefer it over polling. Polling remains as
    // the resilient fallback so older servers still get fresh quotes.
    let closeStream = () => {};
    function startStream() {
      if (typeof EventSource === 'undefined') return;
      closeStream = openQuoteStream(active.ticker, (tick) => {
        if (stopped || tick.symbol !== active.ticker) return;
        if (tick.price == null) {
          markStatus('awaiting market', true);
          setText(els.price, '—');
          setText(els.change, '—');
          return;
        }
        const t = tick.ts || Date.now();
        applyLiveQuote({ price: tick.price, ts: t });
        applyHeader({ price: tick.price, dp: null, status: tick.status });
        lastTickTs = Date.now();
        markStatus(marketLabel(tick.trading) || 'live');
        clearTimeout(staleTimer);
        staleTimer = setTimeout(() => { if (!stopped) markStatus('stale', true); }, STALE_AFTER_MS);
      });
    }
    function stopStream() {
      try { closeStream(); } catch (_) { /* noop */ }
      closeStream = () => {};
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
      // Show time (HH:MM) only for intraday ranges. Daily+ should be
      // a date label (Oct 6), which is LWC's default when timeVisible:false.
      if (chart) {
        try { chart.timeScale().applyOptions({ timeVisible: isIntraday(r) }); } catch (_) { /* noop */ }
      }
      loadCandles();
    }));

  // The ticker buttons live in the markup (AAPL, NVDA). This re-renders
  // them based on the player's unlocks. AAPL is always visible (it's the
  // default ticker). NVDA (and any future ticker) is visible only after
  // the unlock chain grants it. If the store has not loaded yet
  // (unlocks is undefined), show AAPL only.
  function refreshUnlockedTickers() {
    const unlocked = store.state.unlocks;
    for (const btn of els.tickerBtns) {
      const t = btn.dataset.vcTickerBtn;
      const visible = (t === 'AAPL') || (Array.isArray(unlocked) && unlocked.includes(t));
      btn.hidden = !visible;
    }
  }

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
            upColor: color,
            borderUpColor: color,
            wickUpColor: color,
          });
        } catch (_) { /* noop */ }
      }
      // SSE is bound to the URL — when the ticker changes we have to
      // close the old stream and open a new one. Polling keeps working
      // through the gap.
      stopStream();
      loadCandles();
      startStream();
    }

  loadCandles().then(() => {
      if (stopped) return;
      pollOnce();
      startPolling();
      startStream();
    });

  // React to store updates: when the player unlocks a new ticker (e.g.
  // NVDA after the AAPL chain), make its button visible.
  const unsubStore = store.subscribe(() => { if (!stopped) refreshUnlockedTickers(); });
  refreshUnlockedTickers();

  function unmount() {
      stopped = true;
      stopPolling();
      stopStream();
      try { unsubStore && unsubStore(); } catch (_) { /* noop */ }
      try { chart && chart.remove(); } catch (_) { /* noop */ }
      chart = null; series = null;
    }

  return { unmount, setTicker: setActiveTicker, setRange: (r) => { active.range = r; loadCandles(); }, addMarker, setMarkers: (next) => { markers = Array.isArray(next) ? next : []; try { markersApi?.setMarkers(markers); } catch (_) {} }, state: () => ({ ...active }) };
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
      window.__aim2stockChart = mountChart({ ticker: 'AAPL', range: '1D' });
    }
  });
}
