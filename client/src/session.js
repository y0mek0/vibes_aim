// client/src/session.js — one sessionId per page load. Stored in
// sessionStorage so a hard refresh keeps the same id (helps the
// server's idempotency window) but a new tab starts fresh.

const KEY = 'vibes_aim.sessionId.v1';

export function getSessionId() {
  let id = null;
  try { id = sessionStorage.getItem(KEY); } catch { /* private mode */ }
  if (!id) {
    id = 's-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
    try { sessionStorage.setItem(KEY, id); } catch { /* ignore */ }
  }
  return id;
}

export function resetSessionId() {
  try { sessionStorage.removeItem(KEY); } catch { /* ignore */ }
  return getSessionId();
}
