// tests/stream-wire.test.mjs — exercise /market/stream over a real
// HTTP server backed by the stub provider. We open a raw socket so we
// can read SSE frames as they come back.

import assert from 'node:assert/strict';
import http from 'node:http';

import { createApp } from '../server/src/index.js';
import { createStubProvider } from '../server/src/market/stub.js';

let fails = 0;
const ok = (m) => console.log(`ok   ${m}`);
const bad = (m) => { fails++; console.error(`FAIL ${m}`); };

function listen(app) {
  return new Promise((resolve) => {
    // Match tests/server.test.mjs: no host arg means listen on all
    // interfaces and pick an ephemeral port.
    const server = app.listen(0);
    server.once('listening', () => resolve(server));
  });
}

function fetchText(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let buf = '';
      res.setEncoding('utf8');
      res.on('data', (c) => (buf += c));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: buf }));
    }).on('error', reject);
  });
}

async function collectFrames(url, ms = 1500) {
  return new Promise((resolve, reject) => {
    const req = http.get(url, (res) => {
      assert.equal(res.statusCode, 200);
      assert.match(res.headers['content-type'], /text\/event-stream/);
      let buf = '';
      const frames = [];
      res.setEncoding('utf8');
      res.on('data', (chunk) => {
        buf += chunk;
        let sep;
        while ((sep = buf.indexOf('\n\n')) !== -1) {
          const frame = buf.slice(0, sep);
          buf = buf.slice(sep + 2);
          if (frame.trim().length === 0) continue;
          if (frame.startsWith(':')) continue; // comment / heartbeat
          const ev = {};
          for (const line of frame.split('\n')) {
            if (line.startsWith('event: ')) ev.event = line.slice(7).trim();
            else if (line.startsWith('data: ')) ev.data = (ev.data || '') + line.slice(6);
          }
          if (ev.event || ev.data) frames.push(ev);
        }
      });
      setTimeout(() => {
        req.destroy();
        resolve(frames);
      }, ms);
    });
    req.on('error', reject);
  });
}

(async () => {
  // 1) GET /market/stream/AAPL emits tick frames over SSE
  {
    const app = createApp({ market: createStubProvider() });
    const server = await listen(app);
    try {
      const port = server.address().port;
      const frames = await collectFrames(`http://127.0.0.1:${port}/market/stream/AAPL`, 2000);
      const ticks = frames.filter((f) => f.event === 'tick');
      if (ticks.length >= 1) ok(`/market/stream/AAPL emitted ${ticks.length} tick frames`);
      else bad(`/market/stream/AAPL emitted no ticks`);
      const last = JSON.parse(ticks[ticks.length - 1].data);
      if (last.symbol === 'AAPL') ok('frame symbol is AAPL');
      else bad(`frame symbol is ${last.symbol}`);
      if (typeof last.price === 'number' && last.price > 0) ok(`frame price is positive: ${last.price}`);
      else bad(`frame price invalid: ${last.price}`);
      if (typeof last.ts === 'number') ok('frame ts is a number');
      else bad(`frame ts is ${typeof last.ts}`);
    } finally {
      // SSE keeps the connection open; close it explicitly so the
      // server can shut down cleanly.
      if (typeof server.closeAllConnections === 'function') server.closeAllConnections();
      server.close();
    }
  }

  // 2) GET /market/stream/NOTREAL returns 400 JSON
  {
    const app = createApp({ market: createStubProvider() });
    const server = await listen(app);
    try {
      const port = server.address().port;
      const r = await fetchText(`http://127.0.0.1:${port}/market/stream/NOTREAL`);
      if (r.status === 400) ok('unknown symbol returns 400');
      else bad(`unknown symbol returned ${r.status}`);
      try {
        const body = JSON.parse(r.body);
        if (body.error === 'unknown_symbol') ok('unknown symbol error code');
        else bad(`unknown symbol error code is ${body.error}`);
      } catch (e) { bad(`unknown symbol body is not JSON: ${r.body}`); }
    } finally {
      if (typeof server.closeAllConnections === 'function') server.closeAllConnections();
      server.close();
    }
  }

  // 3) GET /market/stream/OPENAI emits pre_ipo ticks with null price
  {
    const app = createApp({ market: createStubProvider() });
    const server = await listen(app);
    try {
      const port = server.address().port;
      const frames = await collectFrames(`http://127.0.0.1:${port}/market/stream/OPENAI`, 1500);
      const ticks = frames.filter((f) => f.event === 'tick');
      if (ticks.length >= 1) ok('/market/stream/OPENAI emitted tick frames');
      else bad('/market/stream/OPENAI emitted no ticks');
      const last = JSON.parse(ticks[ticks.length - 1].data);
      if (last.symbol === 'OPENAI') ok('pre-ipo symbol label correct');
      else bad(`pre-ipo symbol label is ${last.symbol}`);
      if (last.price === null) ok('pre-ipo price is null');
      else bad(`pre-ipo price is ${last.price}`);
      if (last.status === 'pre_ipo') ok('pre-ipo status code present');
      else bad(`pre-ipo status code is ${last.status}`);
    } finally {
      if (typeof server.closeAllConnections === 'function') server.closeAllConnections();
      server.close();
    }
  }

  if (fails) { console.error(`${fails} FAILURES`); process.exit(1); }
  console.log('ALL PASS');
  // SSE keepalive timers from the last server can hold Node open.
  // closeAllConnections handles active sockets but a defensive
  // process.exit guarantees CI does not hang.
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });