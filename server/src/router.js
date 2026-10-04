// server/src/router.js — minimal Express-shaped router using only Node's
// built-in `http`. Routes are registered as (method, pattern, handler).
// Pattern uses `:name` for path params. Handler receives (req, res, params, query, body).
//
// The router is intentionally tiny so we don't pull in any npm dependency.

import { sendJson, readJson, HttpError } from './util/json.js';

function compilePattern(pattern) {
  const keys = [];
  const re = new RegExp(
    '^' +
    pattern
      .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
      .replace(/:([A-Za-z_][A-Za-z0-9_]*)/g, (_, k) => { keys.push(k); return '([^/]+)'; }) +
    '/?$'
  );
  return { re, keys };
}

export function createRouter() {
  const routes = [];
  const use = (method, pattern, handler) => routes.push({ method: method.toUpperCase(), pattern, handler, compiled: compilePattern(pattern) });

  function match(method, pathname) {
    for (const r of routes) {
      if (r.method !== method) continue;
      const m = pathname.match(r.compiled.re);
      if (!m) continue;
      const params = {};
      r.compiled.keys.forEach((k, i) => { params[k] = decodeURIComponent(m[i + 1]); });
      return { handler: r.handler, params };
    }
    return null;
  }

  return {
    get: (p, h) => use('GET', p, h),
    post: (p, h) => use('POST', p, h),
    put: (p, h) => use('PUT', p, h),
    delete: (p, h) => use('DELETE', p, h),
    options: (p, h) => use('OPTIONS', p, h),
    handle: async (req, res, parsedUrl) => {
      const m = match(req.method, parsedUrl.pathname);
      if (!m) return false; // 404
      try {
        const query = Object.fromEntries(parsedUrl.searchParams.entries());
        const body = req.method === 'GET' || req.method === 'HEAD' ? {} : await readJson(req);
        await m.handler(req, res, m.params, query, body);
        return true;
      } catch (e) {
        if (e instanceof HttpError) { sendJson(res, e.status, { error: e.code, message: e.message }); return true; }
        console.error('[router] handler error:', e && e.stack ? e.stack : e);
        sendJson(res, 500, { error: 'internal' });
        return true;
      }
    },
  };
}
