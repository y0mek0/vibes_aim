// server/src/market/provider.js — provider-neutral interface.
//
// All provider implementations must satisfy:
//   async getQuote(symbol)              -> { symbol, price, ts, currency }
//   async getCandles(symbol, range)     -> { symbol, range, candles: [{ t, o, h, l, c }] }
//   async getStatus()                   -> { provider, status: 'live'|'delayed'|'closed'|'stale', lastTickTs }
//   async getTradingStatus(symbol)      -> { provider, isOpen, session, ... }
//   async getSymbols()                  -> [{ symbol, name, market }]
//
// Optional streaming API (used by the SSE /market/stream endpoint):
//   subscribe(symbol, listener) -> { unsubscribe() }
//     listener({ symbol, price, ts, currency, status? }) is called for
//     every new tick the provider can produce. Providers without a real
//     upstream feed (e.g. stub) may synthesize ticks from getQuote().
//     If subscribe is missing the server falls back to polling the
//     provider's getQuote() on its own interval, so SSE is always
//     available regardless of provider implementation.
//
// Ranges supported by the in-game chart:
//   '15m' = 1-minute candles, 15 minutes
//   '1H'  = 1-minute candles, 1 hour
//   '4H'  = 5-minute candles, 4 hours
//   '1D'  = 1-minute candles, 24h
//   '5D'  = 5-minute candles, 5 days
//   '1M'  = 1-hour candles, 30 days
//   '3M'  = daily candles, 90 days
//
// Adapters are isolated. The router never imports a provider directly;
// it uses the factory in market/index.js.

export const RANGES = ['15m', '1H', '4H', '1D', '5D', '1M', '3M'];

/** Throws HttpError(503) if the provider is not configured. */
export function assertProviderReady(provider, name) {
  if (!provider) throw new Error(`market provider not configured: ${name}`);
}
