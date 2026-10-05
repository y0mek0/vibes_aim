// tests/stream.test.mjs — pure unit tests for the SSE stream module.
// We don't open real sockets here; we exercise the framing helper
// directly and the polling path with a fake provider and a fake res.

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { streamSymbol, STREAM_INTERVAL_MS } from '../server/src/market/stream.js';

function makeRes() {
  const res = {
    headers: {},
    body: '',
    events: [],
    closed: false,
    listeners: {},
    writeHead(status, headers) { this.status = status; this.headers = headers; },
    write(chunk) { this.body += chunk; },
    end(payload) {
      if (payload != null) this.body += String(payload);
      this.closed = true;
      this.emit('close');
    },
    on(name, fn) { (this.listeners[name] ||= []).push(fn); },
    emit(name, ...args) { (this.listeners[name] || []).forEach((fn) => fn(...args)); },
  };
  return res;
}

function makeFakeProvider(opts = {}) {
  const ticks = opts.ticks || [];
  let polls = 0;
  return {
    name: 'fake',
    async getQuote(symbol) {
      polls++;
      const idx = polls - 1;
      if (idx < ticks.length) {
        return { symbol, price: ticks[idx], ts: 1700000000000 + idx * 1000, currency: 'USD' };
      }
      // Hold the last known price so the stream does not flap.
      const last = ticks[ticks.length - 1] ?? 100;
      return { symbol, price: last, ts: 1700000000000 + idx * 1000, currency: 'USD' };
    },
    get polls() { return polls; },
  };
}

test('streamSymbol writes SSE headers and a connected comment', () => {
  const provider = makeFakeProvider({ ticks: [100] });
  const res = makeRes();
  const handle = streamSymbol(provider, 'AAPL', res);
  assert.ok(handle, 'handle returned');
  assert.equal(res.status, 200);
  assert.match(res.headers['Content-Type'], /text\/event-stream/);
  assert.match(res.body, /^: connected/);
  handle && handle.stop();
});

test('streamSymbol emits tick events with provider name and ts', async () => {
  const provider = makeFakeProvider({ ticks: [100.5, 101.25] });
  const res = makeRes();
  const handle = streamSymbol(provider, 'AAPL', res);
  // Give the immediate first poll a tick to flush.
  await new Promise((r) => setImmediate(r));
  await new Promise((r) => setImmediate(r));
  // Body should contain at least one event: tick line.
  assert.match(res.body, /event: tick/);
  assert.match(res.body, /"symbol":"AAPL"/);
  assert.match(res.body, /"provider":"fake"/);
  handle && handle.stop();
});

test('streamSymbol rejects unknown symbols with 400 JSON', () => {
  const provider = makeFakeProvider();
  const res = makeRes();
  const handle = streamSymbol(provider, 'NOTREAL', res);
  assert.equal(handle, null);
  assert.equal(res.status, 400);
  assert.match(res.headers['Content-Type'], /application\/json/);
  assert.match(res.body, /unknown_symbol/);
});

test('streamSymbol uses provider subscribe when present', async () => {
  const events = [];
  const provider = {
    name: 'sub',
    subscribe(symbol, listener) {
      queueMicrotask(() => listener({ symbol, price: 42.0, ts: 1700000000000 }));
      return { unsubscribe() { events.push('unsub'); } };
    },
  };
  const res = makeRes();
  const handle = streamSymbol(provider, 'AAPL', res);
  await new Promise((r) => setImmediate(r));
  await new Promise((r) => setImmediate(r));
  assert.match(res.body, /"price":42/);
  handle && handle.stop();
  assert.deepEqual(events, ['unsub']);
});

test('streamSymbol stop() clears timers and closes the response', async () => {
  const provider = makeFakeProvider({ ticks: [50] });
  const res = makeRes();
  const handle = streamSymbol(provider, 'AAPL', res);
  assert.ok(handle);
  handle.stop();
  assert.equal(res.closed, true);
});

test('POLL interval is short enough for sub-second UI updates', () => {
  assert.ok(STREAM_INTERVAL_MS <= 1000, `expected <=1000ms polling, got ${STREAM_INTERVAL_MS}`);
});