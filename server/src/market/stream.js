// server/src/market/stream.js — Server-Sent Events feed of provider quotes.
//
// The stream is provider-neutral:
//   - If the provider implements subscribe(symbol, listener) we use it
//     (real upstream feeds will plug their native stream in here).
//   - Otherwise we poll getQuote() on a fixed interval. This guarantees
//     SSE works for every provider, including the deterministic stub.
//
// Each open connection owns its own interval and listener. On client
// disconnect we unsubscribe and clear the timer — no global state.

const POLL_INTERVAL_MS = 1000;
const MAX_FRAME_INTERVAL_MS = 15_000; // heartbeat keeps proxies from killing the connection
const KNOWN_SYMBOLS = new Set([
  'AAPL', 'NVDA', 'MSFT', 'TSLA', 'AMZN', 'SPY', 'SPCX', 'OPENAI', 'ANTHROPIC',
]);

function isKnownSymbol(symbol) {
  return KNOWN_SYMBOLS.has(symbol);
}

function writeSseEvent(res, event, payload) {
  // SSE framing: optional event name, then one or more `data:` lines,
  // then a blank line. UTF-8 JSON on a single line keeps parse trivial.
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
}

function openStream(res) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-store',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.write(': connected\n\n');
}

export function streamSymbol(market, symbol, res) {
  if (!isKnownSymbol(symbol)) {
    res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ error: 'unknown_symbol', message: `unknown symbol: ${symbol}` }));
    return null;
  }
  openStream(res);
  let stopped = false;

  const onTick = (tick) => {
    if (stopped) return;
    try {
      writeSseEvent(res, 'tick', {
        symbol: tick.symbol || symbol,
        price: tick.price ?? null,
        ts: tick.ts || Date.now(),
        status: tick.status || null,
        provider: market.name || 'unknown',
      });
    } catch (_) { /* socket closed mid-write */ }
  };

  // Heartbeat: a comment line every 15s keeps middleboxes from
  // closing the connection and lets the client detect a dead link.
  const heartbeat = setInterval(() => {
    if (stopped) return;
    try { res.write(`: hb ${Date.now()}\n\n`); } catch (_) { stopped = true; }
  }, MAX_FRAME_INTERVAL_MS);

  let unsubscribe = () => {};
  if (typeof market.subscribe === 'function') {
    try {
      const sub = market.subscribe(symbol, onTick);
      if (sub && typeof sub.unsubscribe === 'function') {
        unsubscribe = () => sub.unsubscribe();
      }
    } catch (e) {
      // Fall through to polling fallback below.
    }
  }

  // Polling fallback: send the first snapshot immediately, then every
  // POLL_INTERVAL_MS. We keep both branches alive when subscribe is
  // present so a missing native event still produces ticks.
  let lastSentTs = 0;
  const poll = async () => {
    if (stopped) return;
    try {
      const q = await market.getQuote(symbol);
      if (q && q.ts !== lastSentTs) {
        lastSentTs = q.ts;
        onTick(q);
      }
    } catch (_) { /* keep stream alive */ }
  };
  poll();
  const pollTimer = setInterval(poll, POLL_INTERVAL_MS);

  function stop() {
    if (stopped) return;
    stopped = true;
    clearInterval(pollTimer);
    clearInterval(heartbeat);
    try { unsubscribe(); } catch (_) { /* noop */ }
    try { res.end(); } catch (_) { /* already closed */ }
  }
  res.on('close', stop);
  res.on('error', stop);

  return { stop };
}

export const STREAM_INTERVAL_MS = POLL_INTERVAL_MS;