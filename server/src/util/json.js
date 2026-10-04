// server/src/util/json.js — tiny helpers (parse JSON, send JSON, clamp, etc.).
// Pure stdlib, no dependencies.

export function readJson(req, limit = 64 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > limit) {
        reject(Object.assign(new Error('payload too large'), { status: 413, code: 'payload_too_large' }));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => {
      if (chunks.length === 0) return resolve({});
      const raw = Buffer.concat(chunks).toString('utf8');
      try { resolve(JSON.parse(raw)); }
      catch { reject(Object.assign(new Error('invalid json'), { status: 400, code: 'invalid_json' })); }
    });
    req.on('error', (e) => reject(Object.assign(e, { status: 400, code: 'bad_request' })));
  });
}

export function sendJson(res, status, body) {
  const data = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(data),
    'Cache-Control': 'no-store',
  });
  res.end(data);
}

export function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n));
}

export function round(n, decimals = 6) {
  const f = 10 ** decimals;
  return Math.round(n * f) / f;
}

export class HttpError extends Error {
  constructor(status, code, message) {
    super(message || code);
    this.status = status;
    this.code = code;
  }
}
