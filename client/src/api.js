// client/src/api.js — fetch wrapper. Adds X-Player-Id and X-Session-Id,
// normalizes errors, exposes a tiny request helper. No retries on POSTs
// (idempotency lives server-side via hitId).

import { getSessionId } from './session.js';

let playerIdCache = null;

export function setPlayerId(id) {
  playerIdCache = id;
  try { localStorage.setItem('vibes_aim.playerId.v1', id); } catch { /* ignore */ }
}

export function getPlayerId() {
  if (playerIdCache) return playerIdCache;
  // Try localStorage first
  try {
    const saved = localStorage.getItem('vibes_aim.playerId.v1');
    if (saved) { playerIdCache = saved; return saved; }
  } catch { /* ignore */ }
  // Otherwise mint a guest id
  const id = 'guest-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
  setPlayerId(id);
  return id;
}

// Resolve the server base URL once. Default points at the local server
// on the documented port. Production: set window.VIBES_API_BASE in index.html.
function baseUrl() {
  if (typeof window !== 'undefined' && window.VIBES_API_BASE) return window.VIBES_API_BASE;
  return 'http://127.0.0.1:3000';
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
