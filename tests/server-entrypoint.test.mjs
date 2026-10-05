// tests/server-entrypoint.test.mjs — direct-start regression test.
// Docker runs `node src/index.js` from server/, so importing createApp() is not
// enough: this proves the ESM direct-run guard starts an actual listener.

import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SERVER_DIR = path.join(ROOT, 'server');

function getFreePort() {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const { port } = probe.address();
      probe.close((err) => err ? reject(err) : resolve(port));
    });
  });
}

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitForHealth(port, child) {
  const deadline = Date.now() + 5_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`server exited early with code ${child.exitCode}`);
    try {
      const response = await fetch(`http://127.0.0.1:${port}/health`);
      if (response.ok) return response.json();
    } catch (_) { /* not listening yet */ }
    await delay(100);
  }
  throw new Error('server did not answer /health within 5 seconds');
}

const port = await getFreePort();
const child = spawn(process.execPath, ['src/index.js'], {
  cwd: SERVER_DIR,
  env: { ...process.env, PORT: String(port), MARKET_PROVIDER: 'stub' },
  stdio: ['ignore', 'pipe', 'pipe'],
});

try {
  const health = await waitForHealth(port, child);
  assert.equal(health.ok, true);
  assert.equal(typeof health.ts, 'number');
  console.log('ok   node src/index.js starts a server and GET /health returns 200');
} finally {
  if (child.exitCode === null) {
    child.kill();
    await Promise.race([once(child, 'exit'), delay(2_000)]);
  }
}

console.log('ALL PASS');
