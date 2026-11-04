import assert from 'node:assert/strict';
import http from 'node:http';
import { createApp } from '../server/src/index.js';

const EXPECTED = Object.freeze({
  AAPL: { unit: 0.0008, minUsd: 0.14, maxUsd: 0.16 },
  NVDA: { unit: 0.0008, minUsd: 0.09, maxUsd: 0.10 },
  TSLA: { unit: 0.0005, minUsd: 0.12, maxUsd: 0.13 },
  MSFT: { unit: 0.0003, minUsd: 0.12, maxUsd: 0.13 },
});

function request(port, method, path, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const data = body == null ? null : JSON.stringify(body);
    const req = http.request({
      host: '127.0.0.1', port, method, path,
      headers: {
        ...(data ? { 'content-type': 'application/json', 'content-length': Buffer.byteLength(data) } : {}),
        ...headers,
      },
    }, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8');
        resolve({ status: res.statusCode, body: text ? JSON.parse(text) : null });
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

process.env.SUPABASE_URL = '';
process.env.SUPABASE_SERVICE_KEY = '';
const app = createApp();
const server = app.listen(0);
await new Promise((resolve) => server.once('listening', resolve));
const port = server.address().port;

try {
  for (const [ticker, expected] of Object.entries(EXPECTED)) {
    const playerId = `economy-${ticker}`;
    const headers = { 'x-player-id': playerId, 'x-session-id': `economy-session-${ticker}` };
    const payload = { hitId: `economy-hit-${ticker}`, ticker, accuracy: 0.8, streak: 0, gunId: 'usp', ts: 1 };

    const hit = await request(port, 'POST', '/aim/hit', payload, headers);
    assert.equal(hit.status, 200, `${ticker} base hit must mint`);
    assert.equal(hit.body.ticker, ticker);
    assert.equal(hit.body.unit, expected.unit, `${ticker} must use its approved base unit`);

    const duplicate = await request(port, 'POST', '/aim/hit', payload, headers);
    assert.equal(duplicate.status, 200, `${ticker} duplicate must resolve cleanly`);
    assert.equal(duplicate.body.duplicate, true, `${ticker} retry must be idempotent`);
    assert.equal(duplicate.body.unit, expected.unit, `${ticker} retry must return the originally minted unit`);

    const converted = await request(port, 'POST', '/portfolio/convert', { ticker, units: expected.unit }, { 'x-player-id': playerId });
    assert.equal(converted.status, 200, `${ticker} earned unit must convert to Stable`);
    assert.equal(converted.body.balance, 0, `${ticker} balance must reach zero after exact conversion`);
    assert.ok(converted.body.usd >= expected.minUsd && converted.body.usd <= expected.maxUsd,
      `${ticker} conversion ${converted.body.usd} must stay in its approved Stable range`);
    console.log(`ok   ${ticker}: ${expected.unit} -> $${converted.body.usd}`);
  }
  console.log('Four-ticker base-hit economics and conversion: ALL PASS');
} finally {
  await new Promise((resolve) => server.close(resolve));
}
