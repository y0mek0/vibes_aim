// tests/chart.test.mjs — chart panel tests.
//
// Two layers:
//   1) Pure-function tests for the helpers chart.js exports. No DOM,
//      no network, no chart library. We assert accentColor, fmtPrice,
//      fmtChange, buildSeriesData, buildStatus, buildHeader all produce
//      the right outputs for the inputs the live panel will see.
//   2) A small integration test: boot the server, run chart.js's
//      fetchCandles / fetchQuote through the same api wrapper the
//      browser uses, and assert the response shape matches what the
//      chart consumes.
//
// Run: node tests/chart.test.mjs (from vibes_aim/)

import http from 'node:http';
import assert from 'node:assert/strict';
import {
  accentColor, fmtPrice, fmtChange,
  buildSeriesData, buildStatus, buildHeader,
} from '../client/js/chart.js';

let fails = 0;
const ok  = (m) => console.log(`ok   ${m}`);
const bad = (m) => { fails++; console.error(`FAIL ${m}`); };

// ---------- Pure helpers ----------
{
  // accentColor: AAPL silver, NVDA green, SPCX amber, Pre-IPO dim, others silver.
  assert.equal(accentColor('AAPL'), '#c9ccd1');
  assert.equal(accentColor('NVDA'), '#7df9c5');
  assert.equal(accentColor('SPCX'), '#ffb347');
  assert.equal(accentColor('OPENAI'), '#9aa3b2');
  assert.equal(accentColor('ANTHROPIC'), '#9aa3b2');
  assert.equal(accentColor('NOPE'), '#c9ccd1');
  ok('accentColor returns the right palette per ticker');
}
{
  // fmtPrice
  assert.equal(fmtPrice(187.42), '187.42');
  assert.equal(fmtPrice(0), '0.00');
  assert.equal(fmtPrice(null), '—');
  assert.equal(fmtPrice(undefined), '—');
  assert.equal(fmtPrice(NaN), '—');
  ok('fmtPrice handles numbers, null, undefined, NaN');
}
{
  // fmtChange
  assert.equal(fmtChange(0.27), '+0.27%');
  assert.equal(fmtChange(-1.5), '-1.50%');
  assert.equal(fmtChange(0), '+0.00%');
  assert.equal(fmtChange(null), '—');
  ok('fmtChange signs and formats with two decimals');
}
{
  // buildSeriesData: ms timestamps -> seconds, fields preserved
  const out = buildSeriesData([
    { t: 1700000000000, o: 1, h: 2, l: 0.5, c: 1.5 },
    { t: 1700000060000, o: 1.5, h: 2.5, l: 1, c: 2 },
  ]);
  assert.equal(out.length, 2);
  assert.equal(out[0].time, 1700000000);
  assert.equal(out[0].close, 1.5);
  assert.equal(out[1].time, 1700000060);
  ok('buildSeriesData converts ms to seconds and preserves OHLC');
}
{
  // buildSeriesData: empty / undefined -> empty array
  assert.deepEqual(buildSeriesData(undefined), []);
  assert.deepEqual(buildSeriesData([]), []);
  ok('buildSeriesData handles empty input');
}
{
  // buildStatus
  let s = buildStatus({ isPreIpo: true });
  assert.equal(s.text, 'awaiting market');
  assert.equal(s.stale, true);
  s = buildStatus({ error: new Error('boom') });
  assert.equal(s.text, 'error: boom');
  assert.equal(s.stale, true);
  s = buildStatus({ marketStatus: 'stub' });
  assert.equal(s.text, 'offline stub');
  assert.equal(s.stale, false);
  s = buildStatus({});
  assert.equal(s.text, 'connecting…');
  s = buildStatus({ lastTickTs: Date.now() });
  assert.equal(s.text, 'live');
  ok('buildStatus covers pre-ipo, error, stub, connecting, live');
}
{
  // buildHeader
  let h = buildHeader({ price: 187.42, dp: 0.27 });
  assert.equal(h.price, '187.42');
  assert.equal(h.change, '+0.27%');
  assert.equal(h.changeClass, 'pos');
  h = buildHeader({ price: 100, dp: -1.5 });
  assert.equal(h.changeClass, 'neg');
  assert.equal(h.change, '-1.50%');
  h = buildHeader({ status: 'pre_ipo' });
  assert.equal(h.price, '—');
  assert.equal(h.change, '—');
  assert.equal(h.changeClass, '');
  h = buildHeader(null);
  assert.equal(h.price, '—');
  assert.equal(h.change, '—');
  ok('buildHeader signs, handles pre-ipo, null');
}

// ---------- Integration: chart.js helpers through real server ----------
async function integration() {
  // Boot the server in-process with the stub provider.
  const { createApp } = await import('../server/src/index.js');
  const { listen } = createApp();
  const server = listen(0);
  await new Promise((r) => server.once('listening', r));
  const port = server.address().port;

  // We have to point the api wrapper at this port. The api wrapper reads
  // window.VIBES_API_BASE or falls back to http://127.0.0.1:3000. We
  // don't have a window in Node, so we call the underlying fetch
  // directly. The wire contract is what we care about: chart.js's
  // fetchCandles calls api.get(/market/candles/X?range=R). Verify
  // that path returns the shape chart.js expects.
  const get = (path) => new Promise((resolve, reject) => {
    const req = http.request({ method: 'GET', host: '127.0.0.1', port, path }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8');
        try { resolve({ status: res.statusCode, body: JSON.parse(text) }); }
        catch { resolve({ status: res.statusCode, body: null, text }); }
      });
    });
    req.on('error', reject);
    req.end();
  });

  // 1. /market/candles/AAPL?range=1D returns the shape chart.js consumes
  const r1 = await get('/market/candles/AAPL?range=1D');
  assert.equal(r1.status, 200);
  assert.ok(r1.body);
  assert.equal(r1.body.symbol, 'AAPL');
  assert.equal(r1.body.range, '1D');
  assert.ok(Array.isArray(r1.body.candles));
  assert.ok(r1.body.candles.length > 0);
  // shape: { t, o, h, l, c }
  const c0 = r1.body.candles[0];
  for (const k of ['t', 'o', 'h', 'l', 'c']) {
    assert.ok(c0[k] != null, `candle missing ${k}`);
  }
  // run buildSeriesData on the response, assert no throw + valid output
  const series = buildSeriesData(r1.body.candles);
  assert.equal(series.length, r1.body.candles.length);
  assert.equal(series[0].time, Math.floor(c0.t / 1000));
  ok('GET /market/candles/AAPL shape matches buildSeriesData input');

  // 2. /market/quote/AAPL returns the shape buildHeader consumes
  const r2 = await get('/market/quote/AAPL');
  assert.equal(r2.status, 200);
  assert.equal(r2.body.symbol, 'AAPL');
  assert.ok(Number.isFinite(r2.body.price));
  const h2 = buildHeader(r2.body);
  assert.ok(/^[0-9]/.test(h2.price));
  assert.ok(h2.changeClass === 'pos' || h2.changeClass === 'neg' || h2.changeClass === '');
  ok('GET /market/quote/AAPL shape matches buildHeader input');

  // 3. /market/quote/OPENAI is pre-ipo -> buildHeader returns "—"
  const r3 = await get('/market/quote/OPENAI');
  assert.equal(r3.status, 200);
  assert.equal(r3.body.status, 'pre_ipo');
  const h3 = buildHeader(r3.body);
  assert.equal(h3.price, '—');
  assert.equal(h3.change, '—');
  ok('GET /market/quote/OPENAI pre-ipo -> buildHeader returns —');

  // 4. /market/candles/OPENAI returns empty array (no throw, no chart panic)
  const r4 = await get('/market/candles/OPENAI?range=1D');
  assert.equal(r4.status, 200);
  assert.ok(Array.isArray(r4.body.candles));
  assert.equal(r4.body.candles.length, 0);
  ok('GET /market/candles/OPENAI returns empty array (no throw)');

  // 5. /market/symbols lists AAPL and NVDA so the ticker buttons can be expanded
  const r5 = await get('/market/symbols');
  assert.equal(r5.status, 200);
  const tickers = r5.body.symbols.map((s) => s.symbol);
  assert.ok(tickers.includes('AAPL') && tickers.includes('NVDA'));
  ok('GET /market/symbols includes AAPL and NVDA');

  server.close();
}

await integration();

if (fails) { console.error(`${fails} FAILURES`); process.exit(1); }
console.log('ALL PASS');
