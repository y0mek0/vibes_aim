// client/src/api.js — fetch wrapper. Adds X-Player-Id and X-Session-Id,
// normalizes errors, exposes a tiny request helper. No retries on POSTs
// (idempotency lives server-side via hitId).

import { getSessionId } from './session.js';

let playerIdCache = null;

export function setPlayerId(id) {
  playerIdCache = id;
  try { localStorage.setItem('aim2stock.playerId.v1', id); } catch { /* ignore */ }
}

export function getPlayerId() {
  if (playerIdCache) return playerIdCache;
  // Try localStorage first
  try {
    const saved = localStorage.getItem('aim2stock.playerId.v1');
    if (saved) { playerIdCache = saved; return saved; }
  } catch { /* ignore */ }
  // Otherwise mint a guest id
  const id = 'guest-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
  setPlayerId(id);
  return id;
}

// Resolve the server base URL once. Default points at the local server
// on the documented port. Production: set window.VIBES_API_BASE in index.html.
//
// The fallback order is:
//   1) window.VIBES_API_BASE if explicitly set
//   2) Same origin as the page but on the API port (so a deployed
//      reverse-proxy on one host still works)
//   3) http://127.0.0.1:4174 (the documented local dev port)
//   4) http://127.0.0.1:3000 (legacy local dev port)
function defaultBaseUrl() {
  if (typeof window === 'undefined') return 'http://127.0.0.1:3000';
  const { protocol, hostname } = window.location;
  // If the user is on the dev static port, assume the dev API port.
  if (hostname === '127.0.0.1' || hostname === 'localhost') {
    return `${protocol}//${hostname}:4174`;
  }
  // Deployed: API is on the same origin under /api or the same host.
  return `${protocol}//${window.location.host}`;
}

function baseUrl() {
  if (typeof window !== 'undefined' && window.VIBES_API_BASE) return window.VIBES_API_BASE;
  return defaultBaseUrl();
}

export class ApiError extends Error {
  constructor(status, code, message) {
    super(message || code);
    this.status = status;
    this.code = code;
  }
}

async function request(method, path, { body, query, headers } = {}) {
  let url = baseUrl() + path;
  if (query) {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(query)) if (v != null) sp.set(k, String(v));
    const s = sp.toString();
    if (s) url += (url.includes('?') ? '&' : '?') + s;
  }
  const finalHeaders = {
    'Content-Type': 'application/json',
    'X-Player-Id': getPlayerId(),
    'X-Session-Id': getSessionId(),
    ...(headers || {}),
  };
  const res = await fetch(url, {
    method,
    headers: finalHeaders,
    body: body == null ? undefined : JSON.stringify(body),
    mode: 'cors',
  });
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { /* keep raw text */ }
  if (!res.ok) {
    const code = (json && json.error) || `http_${res.status}`;
    const message = (json && json.message) || res.statusText;
    throw new ApiError(res.status, code, message);
  }
  return json;
}

export const api = {
  get:    (path, opts) => request('GET', path, opts),
  post:   (path, body, opts) => request('POST', path, { ...(opts || {}), body }),
  put:    (path, body, opts) => request('PUT', path, { ...(opts || {}), body }),
  delete: (path, opts) => request('DELETE', path, opts),
  baseUrl,
};
