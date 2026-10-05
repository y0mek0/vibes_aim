// tests/finnhub.test.mjs — mocked-fetch test for the Finnhub adapter.
// Stubs globalThis.fetch and asserts:
//   1) empty token -> all data methods throw HttpError(503, 'market_not_configured')
//   2) fake OK /quote response -> getQuote returns the expected shape
//   3) fake OK /stock/candle response -> getCandles maps fields correctly
//   4) bad upstream -> HttpError(502, 'market_provider_error')
//
// Run: node tests/finnhub.test.mjs (from vibes_aim/)

import assert from 'node:assert/strict';
import { createFinnhubProvider, parseFinnhubTradeMessage } from '../server/src/market/finnhub.js';

let fails = 0;
const ok  = (m) => console.log(`ok   ${m}`);
const bad = (m) => { fails++; console.error(`FAIL ${m}`); };

// 1. no token
{
  const p = createFinnhubProvider({ token: '' });
  try {
    await p.getQuote('AAPL');
    bad('no-token getQuote should throw');
  } catch (e) {
    if (e.status === 503 && e.code === 'market_not_configured') ok('no-token getQuote -> 503 market_not_configured');
    else bad(`no-token getQuote wrong error: ${e.status}/${e.code}`);
  }
}

// 2. fake OK quote
{
  const calls = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), init });
    return new Response(JSON.stringify({ c: 187.42, d: 0.5, dp: 0.27, h: 188, l: 186, o: 187, pc: 186.92, t: 1700000000 }), {
      status: 200, headers: { 'content-type': 'application/json' },
    });
  };
  try {
    const p = createFinnhubProvider({ token: 'fake-token' });
    const q = await p.getQuote('AAPL');
    assert.equal(q.symbol, 'AAPL');
    assert.equal(q.price, 187.42);
    assert.equal(q.currency, 'USD');
    assert.ok(q.ts > 0);
    assert.equal(calls.length, 1);
    assert.ok(calls[0].url.includes('/api/v1/quote'), `url=${calls[0].url}`);
    assert.equal(calls[0].init.headers['X-Finnhub-Token'], 'fake-token');
    ok('getQuote happy path returns shape and calls /quote with token header');
  } finally {
    globalThis.fetch = realFetch;
  }
}

// 3. pre-IPO returns null price without calling fetch
{
  let called = 0;
  const realFetch = globalThis.fetch;
  globalThis.fetch = async () => { called++; return new Response('{}'); };
  try {
    const p = createFinnhubProvider({ token: 'fake-token' });
    const q = await p.getQuote('OPENAI');
    assert.equal(q.symbol, 'OPENAI');
    assert.equal(q.price, null);
    assert.equal(q.status, 'pre_ipo');
    assert.equal(called, 0, 'pre-IPO should not call fetch');
    ok('getQuote OPENAI pre-ipo returns null without hitting the network');
  } finally {
    globalThis.fetch = realFetch;
  }
}

// 4. fake OK candles
{
  const calls = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    calls.push(String(url));
    return new Response(JSON.stringify({
      s: 'ok', t: [100, 200, 300], o: [10, 11, 12], h: [11, 12, 13], l: [9, 10, 11], c: [10.5, 11.5, 12.5], v: [0, 0, 0],
    }), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  try {
    const p = createFinnhubProvider({ token: 'fake-token' });
    const r = await p.getCandles('NVDA', '1D');
    assert.equal(r.symbol, 'NVDA');
    assert.equal(r.range, '1D');
    assert.equal(r.candles.length, 3);
    assert.equal(r.candles[0].t, 100000);
    assert.equal(r.candles[2].c, 12.5);
    assert.ok(calls[0].includes('resolution=1'), `expected resolution=1 in ${calls[0]}`);
    ok('getCandles 1D returns 3 candles with ms timestamps');
  } finally {
    globalThis.fetch = realFetch;
  }
}

// 5. bad upstream -> 502
{
  const realFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response('forbidden', { status: 403 });
  try {
    const p = createFinnhubProvider({ token: 'fake-token' });
    try {
      await p.getQuote('AAPL');
      bad('upstream 403 should throw');
    } catch (e) {
      if (e.status === 502 && e.code === 'market_provider_error') ok('upstream 403 -> 502 market_provider_error');
      else bad(`upstream 403 wrong error: ${e.status}/${e.code}`);
    }
  } finally {
    globalThis.fetch = realFetch;
  }
}

// 6. unknown symbol
{
  const p = createFinnhubProvider({ token: 'fake-token' });
  try {
    await p.getQuote('NOPE');
    bad('unknown symbol should throw');
  } catch (e) {
    if (e.status === 400 && e.code === 'unknown_symbol') ok('unknown symbol -> 400 unknown_symbol');
    else bad(`unknown symbol wrong error: ${e.status}/${e.code}`);
  }
}

// 7. getStatus
{
  const p1 = createFinnhubProvider({ token: '' });
  const s1 = await p1.getStatus();
  assert.equal(s1.provider, 'finnhub');
  assert.equal(s1.status, 'unconfigured');
  const p2 = createFinnhubProvider({ token: 'x' });
  const s2 = await p2.getStatus();
  assert.equal(s2.status, 'live');
  ok('getStatus reports unconfigured when token empty, live when set');
}

// 8. getTradingStatus maps Finnhub US session state
{
  const calls = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    calls.push(String(url));
    return new Response(JSON.stringify({ isOpen: false, session: 'post', holiday: 'Independence Day' }), {
      status: 200, headers: { 'content-type': 'application/json' },
    });
  };
  try {
    const p = createFinnhubProvider({ token: 'fake-token' });
    const status = await p.getTradingStatus('AAPL');
    assert.equal(status.provider, 'finnhub');
    assert.equal(status.isOpen, false);
    assert.equal(status.session, 'post');
    assert.equal(status.holiday, 'Independence Day');
    assert.ok(calls[0].includes('/api/v1/stock/market-status'), `url=${calls[0]}`);
    assert.ok(calls[0].includes('exchange=US'), `url=${calls[0]}`);
    ok('getTradingStatus maps the Finnhub US market session');
  } finally {
    globalThis.fetch = realFetch;
  }
}

// 9. native WebSocket subscribe: handshake, symbol filtering and cleanup
{
  const sockets = [];
  class FakeWebSocket {
    constructor(url) { this.url = url; this.listeners = new Map(); this.sent = []; this.closed = false; sockets.push(this); }
    addEventListener(event, listener) { this.listeners.set(event, listener); }
    emit(event, payload = {}) { this.listeners.get(event)?.(payload); }
    send(payload) { this.sent.push(payload); }
    close() { this.closed = true; }
  }
  const p = createFinnhubProvider({ token: 'fake token', WebSocketImpl: FakeWebSocket });
  const ticks = [];
  const sub = p.subscribe('AAPL', (tick) => ticks.push(tick));
  assert.equal(sockets.length, 1);
  assert.equal(sockets[0].url, 'wss://ws.finnhub.io?token=fake%20token');
  sockets[0].emit('open');
  assert.deepEqual(JSON.parse(sockets[0].sent[0]), { type: 'subscribe', symbol: 'AAPL' });
  sockets[0].emit('message', { data: JSON.stringify({ type: 'trade', data: [
    { s: 'AAPL', p: 201.5, t: 1700000000123 },
    { s: 'NVDA', p: 900, t: 1700000000999 },
  ] }) });
  assert.deepEqual(ticks, [{ symbol: 'AAPL', price: 201.5, ts: 1700000000123, currency: 'USD' }]);
  sub.unsubscribe();
  assert.equal(sockets[0].closed, true);
  sockets[0].emit('message', { data: JSON.stringify({ type: 'trade', data: [{ s: 'AAPL', p: 202, t: 1 }] }) });
  assert.equal(ticks.length, 1, 'unsubscribed socket must not emit ticks');
  ok('subscribe opens Finnhub WebSocket, filters trades and closes cleanly');
}

// 10. parser ignores malformed/unrelated payloads and keeps valid symbols
{
  assert.deepEqual(parseFinnhubTradeMessage('{bad', 'AAPL'), []);
  assert.deepEqual(parseFinnhubTradeMessage({ data: JSON.stringify({ type: 'ping' }) }, 'AAPL'), []);
  const ticks = parseFinnhubTradeMessage({ type: 'trade', data: [{ s: 'AAPL', p: '201.1', t: '42' }, { s: 'AAPL', p: 'oops', t: 43 }] }, 'AAPL');
  assert.deepEqual(ticks, [{ symbol: 'AAPL', price: 201.1, ts: 42, currency: 'USD' }]);
  ok('trade parser safely ignores malformed and unrelated upstream events');
}

// 11. environments without a native WebSocket use the existing REST fallback
{
  const p = createFinnhubProvider({ token: 'fake-token', WebSocketImpl: null });
  assert.equal(p.subscribe('AAPL', () => {}), null);
  ok('subscribe returns null without WebSocket so SSE uses REST polling');
}

// 12. no token is still rejected before an upstream socket can open
{
  const p = createFinnhubProvider({ token: '', WebSocketImpl: class {} });
  assert.throws(() => p.subscribe('AAPL', () => {}), (e) => e?.status === 503 && e?.code === 'market_not_configured');
  ok('no-token subscribe -> 503 market_not_configured');
}

if (fails) {
  console.error(`${fails} FAILURES`);
  process.exit(1);
}
console.log('ALL PASS');
