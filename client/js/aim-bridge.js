// client/js/aim-bridge.js — listens for the `vibes:hit` CustomEvent emitted
// by the engine's markHit() and POSTs each hit to the server. The server
// is the only place that mints simulated ticker units.
//
// Hit ids are generated client-side and embedded in the request. The
// server uses (sessionId, hitId) for idempotency, so a network blip that
// causes a retry will not double-mint.

import { api } from '../src/api.js?v=20261006-7';
import { getSessionId } from '../src/session.js?v=20261006-7';

const ACTIVE_TICKER_KEY = 'vibes_aim.activeTicker.v1';
const DEFAULT_TICKER = 'AAPL';

function readStoredTicker() {
  try { return localStorage.getItem(ACTIVE_TICKER_KEY); } catch { return null; }
}

export function activeTickerLabel(ticker) {
  return `Active farm ticker: ${ticker}`;
}

let counter = 0;
let inFlight = new Set();
let chipEl = null;
let tickerEl = null;
let activeTicker = readStoredTicker() || DEFAULT_TICKER;

export function getActiveTicker() { return activeTicker; }
export function setActiveTicker(t) {
  activeTicker = t;
  try { localStorage.setItem(ACTIVE_TICKER_KEY, t); } catch { /* ignore */ }
  if (tickerEl) tickerEl.textContent = t;
  if (typeof document !== 'undefined') document.querySelectorAll('[data-dashboard-ticker]').forEach((el) => { el.textContent = t; });
  if (chipEl) chipEl.wrap.setAttribute('aria-label', activeTickerLabel(t));
}

function ensureChip() {
  if (chipEl) return;
  // Tiny floating HUD chip showing the last minted unit. Lives in the body
  // so it cannot interfere with the engine's overlays.
  const wrap = document.createElement('div');
  wrap.id = 'vibes-aim-bridge';
  wrap.setAttribute('data-bridge', '1');
  wrap.setAttribute('aria-label', activeTickerLabel(activeTicker));
  wrap.style.cssText = [
    'position:fixed', 'right:14px', 'bottom:14px', 'z-index:30',
    'font-family:JetBrains Mono,ui-monospace,monospace',
    'background:#0b0d12', 'color:#e6e8ee',
    'border:1px solid rgba(246,212,71,0.4)', 'border-radius:4px',
    'padding:8px 12px', 'display:flex', 'gap:10px', 'align-items:center',
    'pointer-events:none', 'transition:opacity 220ms cubic-bezier(0.32,0.72,0,1)'
  ].join(';');
  const tag = document.createElement('span');
  tag.style.cssText = 'color:#8a91a0;font-size:10px;letter-spacing:0.18em;text-transform:uppercase';
  tag.textContent = 'active';
  tickerEl = document.createElement('span');
  tickerEl.style.cssText = 'color:#f6d447;font-size:12px;letter-spacing:0.18em';
  tickerEl.textContent = activeTicker;
  const val = document.createElement('span');
  val.style.cssText = 'color:#e6e8ee;font-size:12px';
  val.textContent = '0.0000';
  const tot = document.createElement('span');
  tot.style.cssText = 'color:#8a91a0;font-size:10px;margin-left:6px';
  tot.textContent = '| total 0.0000';
  wrap.appendChild(tag);
  wrap.appendChild(tickerEl);
  wrap.appendChild(val);
  wrap.appendChild(tot);
  document.body.appendChild(wrap);
  chipEl = { wrap, val, tot };
}

let lastUnit = 0;
let total = 0;
function flashChip(unit) {
  lastUnit = unit;
  total += unit;
  if (typeof document !== 'undefined') {
    document.querySelectorAll('[data-game-earned]').forEach((el) => { el.textContent = total.toFixed(4); });
    document.querySelectorAll('[data-game-earned-ticker]').forEach((el) => { el.textContent = activeTicker; });
    document.querySelectorAll('[data-dashboard-session-units], [data-recent-earned]').forEach((el) => { el.textContent = `+${total.toFixed(4)} ${activeTicker}`; });
    document.querySelectorAll('[data-dashboard-today]').forEach((el) => { el.textContent = `+${total.toFixed(4)}`; });
    document.querySelectorAll('[data-dashboard-ticker]').forEach((el) => { el.textContent = activeTicker; });
  }
}

function onHit(ev) {
  if (!ev || !ev.detail) return;
  const d = ev.detail;
  // Generate a hitId that is unique within this session. sessionId already
  // disambiguates across sessions.
  counter = (counter + 1) >>> 0;
  const hitId = `h-${Date.now().toString(36)}-${counter.toString(36)}`;
  // Do not send duplicates that we know are in flight.
  if (inFlight.has(hitId)) return;
  inFlight.add(hitId);
  api.post('/aim/hit', {
    hitId,
    ticker: activeTicker,
    accuracy: Number(d.accuracy) || 0,
    streak: Number(d.streak) || 0,
    ts: Number(d.ts) || Date.now(),
    // Server applies earn multiplier from this gunId. Unknown ids
    // (e.g. legacy pre-rename) fall back to 1.0x on the server.
    gunId: typeof d.gunId === 'string' ? d.gunId : null,
  }).then((r) => {
    if (r && typeof r.unit === 'number') flashChip(r.unit);
  }).catch(() => { /* swallow; engine visuals still play. */ })
    .finally(() => { inFlight.delete(hitId); });
}

// Boot when the engine is ready. We attach the listener immediately; the
// engine is only loaded after `boot()` returns, so any events fired before
// we attach are simply lost (the session just started, no hits yet).
export function startAimBridge() {
  if (typeof window === 'undefined') return;
  window.addEventListener('vibes:hit', onHit);
  // sessionId is in sessionStorage; reading it once warms any browser that
  // delays first access. Not strictly required.
  getSessionId();
}

if (typeof window !== 'undefined') {
  // Auto-start when loaded as a plain script. The engine's main.js imports
  // this module, so by the time it executes, the listener is attached.
  startAimBridge();
}
