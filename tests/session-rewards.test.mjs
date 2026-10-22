import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import { createApp } from '../server/src/index.js';

const game = fs.readFileSync(new URL('../client/js/game.js', import.meta.url), 'utf8');
const bridge = fs.readFileSync(new URL('../client/js/aim-bridge.js', import.meta.url), 'utf8');
const index = fs.readFileSync(new URL('../client/index.html', import.meta.url), 'utf8');

// Report totals must diff the balance captured at session start, after all
// outstanding reward writes have settled. A report with 80 kills cannot read 0.
assert.match(game, /let runStartTicker = 'AAPL';/);
assert.match(game, /let runStartBalances = \{\};/);
assert.match(game, /runStartTicker = getActiveTicker\(\);/);
assert.match(game, /runStartBalances = \{ \.\.\.\(window\.store\?\.state\?\.balances \|\| \{\}\) \};/);
assert.match(game, /await waitForAimRewards\(\)/);
assert.match(game, /const runTicker = runStartTicker \|\| getActiveTicker\(\);/);
assert.match(game, /const beforeRunTicker = runStartBalances\[runTicker\] \?\? 0;/);
assert.match(bridge, /export async function waitForAimRewards\(\)/);
assert.match(index, /js\/aim-bridge\.js\?v=20261023-5/);

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
  for (const mode of ['gridshot', 'flick', 'tracking', 'bots']) {
    for (const ticker of ['AAPL', 'NVDA']) {
      const playerId = `reward-matrix-${mode}-${ticker}`;
      const headers = { 'x-player-id': playerId, 'x-session-id': `session-${mode}-${ticker}` };
      const hit = await request(port, 'POST', '/aim/hit', {
        hitId: `hit-${mode}-${ticker}`,
        ticker,
        accuracy: 0.8,
        streak: 1,
        gunId: 'usp',
        mode,
      }, headers);
      assert.equal(hit.status, 200, `${mode}/${ticker} hit must mint`);
      assert.equal(hit.body.ticker, ticker, `${mode}/${ticker} must retain the selected ticker`);
      assert.ok(hit.body.unit > 0, `${mode}/${ticker} must mint a positive unit`);
      const portfolio = await request(port, 'GET', '/portfolio', null, headers);
      assert.equal(portfolio.status, 200, `${mode}/${ticker} portfolio must load`);
      assert.equal(portfolio.body.balances[ticker], hit.body.balance, `${mode}/${ticker} balance must persist`);
      console.log(`ok   ${mode}/${ticker}: +${hit.body.unit}`);
    }
  }
  console.log('Session earning report and 4x2 reward matrix: ALL PASS');
} finally {
  await new Promise((resolve) => server.close(resolve));
}
