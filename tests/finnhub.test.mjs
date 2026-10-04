// tests/finnhub.test.mjs — mocked-fetch test for the Finnhub adapter.
// Stubs globalThis.fetch and asserts:
//   1) empty token -> all data methods throw HttpError(503, 'market_not_configured')
//   2) fake OK /quote response -> getQuote returns the expected shape
//   3) fake OK /stock/candle response -> getCandles maps fields correctly
//   4) bad upstream -> HttpError(502, 'market_provider_error')
//
// Run: node tests/finnhub.test.mjs (from vibes_aim/)

import assert from 'node:assert/strict';
import { createFinnhubProvider } from '../server/src/market/finnhub.js';

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

if (fails) {
  console.error(`${fails} FAILURES`);
  process.exit(1);
}
console.log('ALL PASS');
