// server/src/index.js — HTTP server entry (pure Node, no external deps).
// createApp() is exported so tests can mount the app on a real port or
// call dispatch() in-process.

import http from 'node:http';
import { URL, fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { config } from './config.js';
import { createMarketProvider } from './market/index.js';
import { pickStore } from './db/supabase.js';
import { mountRoutes } from './routes/index.js';
import { sendJson, HttpError } from './util/json.js';

export function createApp(deps = {}) {
  const market = deps.market ?? createMarketProvider(config.market);
  const store = deps.store ?? pickStore(config.supabase);
  const router = mountRoutes({ market, store, config });

  // CORS preflight and headers for the configured origin.
  function setCors(res) {
    res.setHeader('Access-Control-Allow-Origin', config.origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Player-Id, X-Session-Id');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  }

  async function dispatch(req, res) {
    setCors(res);
    const url = new URL(req.url, `http://${req.headers.host || '127.0.0.1'}`);
    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }
    const handled = await router.handle(req, res, url);
    if (!handled) sendJson(res, 404, { error: 'not_found' });
  }

  return {
    app: { dispatch },
    market,
    store,
    listen(port = config.port) {
      const server = http.createServer(dispatch);
      server.on('clientError', (err, sock) => {
        try { sock.end('HTTP/1.1 400 Bad Request\r\n\r\n'); } catch (_) {}
      });
      server.listen(port, () => {
        console.log(`[server] vibes_aim on http://127.0.0.1:${port} (origin=${config.origin}, provider=${config.market.provider})`);
      });
      return server;
    },
  };
}

// Re-export the HttpError so route handlers can throw it.
export { HttpError };

// Run when invoked directly. `process.argv[1]` may be relative (`src/index.js`
// in the Docker CMD) or absolute, so compare normalized filesystem paths rather
// than constructing a file URL by hand.
const isMain = Boolean(process.argv[1])
  && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const { listen } = createApp();
  listen();
}
