// server/src/routes/health.js
import { sendJson } from '../util/json.js';

export function healthRoute(r) {
  r.get('/health', async (_req, res) => {
    sendJson(res, 200, { ok: true, ts: Date.now() });
  });
}
