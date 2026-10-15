# AIM2STOCK X Updates

This file is the memory and archive for public product updates. It is intentionally separate from the engineering changelog: `docs/CHANGELOG.md` records implementation history; this file stores the concise, user-facing posts and the exact coverage boundary used to prevent repetition.

## How to write the next update

1. Read this entire file before drafting.
2. Start from `Last covered commit` and inspect only newer commits, verified browser work, deploys, and user-visible fixes.
3. Do not repeat a feature, fix, or limitation already stated in an earlier post unless the new update changes its status or adds new evidence.
4. Keep one complete post, not a thread.
5. Use this order:
   - `NEW FEATURES`
   - `IMPROVEMENTS`
   - `BUG FIXES`
   - `VERIFIED`
   - `KNOWN LIMITATIONS` only when still relevant
6. Write public copy in natural English. Chat explanations remain Russian.
7. Never include credentials, tokens, private paths, internal IDs, or unverified claims.
8. After publishing or approving a post, update the coverage ledger below with the newest commit and date.

## Coverage ledger

- Current product: `AIM2STOCK`
- Next public update: `UPDATE 002`
- Last covered commit: `10f7f5905f1f6fe94301c11ad994ebd6c094befb`
- Last covered date: `2026-10-14`
- Covered commit range for Update 001: `b1b60eb..10f7f59`
- Last report: `UPDATE 001 — MARKET TERMINAL`

---

## AIM2STOCK UPDATE 001 — MARKET TERMINAL

AIM2STOCK's market layer received its first complete trading-terminal pass: usable candles, NVDA support, real paper execution flows, and a tighter Gridshot spawn field.

### NEW FEATURES

» Added NVDA as a visible paper-trading asset with the label `NVIDIA Corp.` and a dedicated quote/candle series.

» Added full NVDA terminal coverage for DEX spot trading and PERP positions, including Long, leverage, open, close, balance updates, and trade history.

» Replaced the decorative market area chart with an OHLC candlestick chart with price scale, time scale, range controls, crosshair, tooltip, zoom, pan, and live candle updates.

» Added a visible NVDA watchlist price that loads during terminal startup instead of waiting for the user to select NVDA first.

### IMPROVEMENTS

» Paper market execution now has an explicit 24/7 paper session, so the UI and API agree about when paper trades are available.

» Production quote transport now uses bounded REST polling instead of an unstable long-lived SSE connection on serverless hosting.

» DEX input semantics are now explicit: BUY accepts a USD amount, while SELL accepts asset units.

» Gridshot target spawning now uses a centered forward cone instead of the previous wide side-to-side range.

### BUG FIXES

» Fixed an issue where the terminal showed `Market sell ready` but the SELL request did not execute with the intended asset quantity.

» Fixed NVDA being present in market data but hidden or blocked in the watchlist and terminal selectors.

» Fixed the watchlist showing `-` for NVDA until manual selection.

» Fixed production chart streaming repeatedly reconnecting and producing serverless connection errors.

» Fixed Gridshot targets appearing too far to the sides on the first level.

### VERIFIED

» Full `npm run test` passed, including chart, server, terminal, NVDA BUY/SELL/PERP, and Gridshot geometry coverage.

» Production browser flow verified: NVDA BUY → read balance → SELL exact units → zero NVDA balance.

» Production browser flow verified: NVDA Long at 2x leverage → open position → close position → closed trade in history.

» Production browser flow verified: NVDA quote and candles return successfully, the chart switches to NVDA, and the watchlist displays a live price.

» Production Gridshot verified with three active targets inside the centered forward area rather than at the side edges.

### KNOWN LIMITATIONS

» Production currently uses the existing synthetic paper-market provider. Finnhub integration is implemented but requires a configured `FINNHUB_TOKEN` before switching to live market data.

» Limit-order execution and cancellation are not enabled yet.

---

## Future post template

```text
AIM2STOCK UPDATE NNN — CODENAME

One short sentence describing the user-visible result.

NEW FEATURES
» ...

IMPROVEMENTS
» ...

BUG FIXES
» Fixed an issue where...

VERIFIED
» ...

KNOWN LIMITATIONS
» ...
```
