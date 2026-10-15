# AIM2STOCK / PUBLIC UPDATES

A working archive for copy-ready product news. It tracks what has already been reported so new updates cover only verified changes and do not repeat old ones.

## Writing rules

- Read this file before drafting.
- Start at `Last covered commit` and inspect only newer commits, verified browser flows, test runs, deploy results, and user-visible changes.
- Report shipped behavior, not intentions, stubs, or plans.
- Keep one complete post. Do not split it into a thread unless explicitly requested.
- Use this order when a section has content: `NEW FEATURES`, `IMPROVEMENTS`, `BUG FIXES`, `VERIFIED`, `KNOWN LIMITATIONS`.
- Remove a section when it has nothing useful to say.
- Do not repeat an older item unless its status changed or new evidence materially changes the story.
- Public copy is English. Explanations in chat are Russian.
- Never include credentials, tokens, private paths, internal IDs, or unsupported claims.
- Apply the `marketing-copy` and `stop-slop` review passes before delivery.

## Coverage ledger

| Field | Value |
|---|---|
| Product | `AIM2STOCK` |
| Next public update | `UPDATE 002` |
| Last covered commit | `10f7f5905f1f6fe94301c11ad994ebd6c094befb` |
| Last covered date | `2026-10-14` |
| Update 001 range | `b1b60eb..10f7f59` |
| Last published update | `UPDATE 001 / MARKET TERMINAL` |

---

## UPDATE 001 / MARKET TERMINAL

**Published copy**

```text
AIM2STOCK UPDATE 001 / MARKET TERMINAL

The market terminal now has a usable paper-trading loop: NVDA, real BUY/SELL flows, leveraged PERPs, readable candles, and a tighter Gridshot field.

NEW FEATURES
- Added NVDA with its own quote and candle series.
- Added NVDA coverage across DEX spot trading and PERP Long positions, including leverage, open, close, balances, and trade history.
- Replaced the decorative area chart with an OHLC candlestick chart with scales, range controls, crosshair, tooltip, zoom, pan, and live candle updates.

IMPROVEMENTS
- Paper trading now runs as an explicit 24/7 paper session, keeping the UI and API in sync.
- Production quote updates use bounded polling instead of unstable serverless SSE reconnects.
- DEX inputs are explicit: BUY takes a USD amount; SELL takes asset units.
- Gridshot targets now spawn inside a centered forward cone instead of the old wide side range.

BUG FIXES
- Fixed SELL requests that showed as ready but did not execute the intended asset quantity.
- Fixed NVDA being hidden or blocked in watchlist and terminal selectors.
- Fixed the NVDA watchlist price staying empty until manual selection.
- Fixed production chart reconnect errors.
- Fixed first-level Gridshot targets appearing too far to the sides.

VERIFIED
- Full test suite passed.
- Production NVDA BUY → exact-unit SELL returned the asset balance to zero.
- Production NVDA 2x Long opened, closed, and appeared as a closed trade in history.
- Production quote, candles, watchlist price, chart switching, and first-level Gridshot geometry were browser-verified.

KNOWN LIMITATIONS
- Production still uses synthetic paper-market data. Finnhub integration exists but is not enabled without the required configuration.
- Limit-order execution and cancellation are not enabled yet.
```

### Evidence boundary

Update 001 covers commits `b1b60eb` through `10f7f59`. Its claims were based on the repository test suite, production browser flows, chart checks, Gridshot screenshots, and deploy verification available at the time of writing.

---

## Next-update workflow

1. Read the coverage ledger.
2. Inspect `git log` and diffs after the last covered commit.
3. Check relevant tests and browser or production evidence.
4. Build a short list of genuinely new user-visible changes.
5. Remove anything already covered above.
6. Draft one copy-ready post using the structure below.
7. Run the `marketing-copy` and `stop-slop` passes.
8. After the post is approved or published, update the ledger and add the new report below it.

## Copy-ready template

```text
AIM2STOCK UPDATE NNN / CODENAME

One sentence explaining the user-visible result.

NEW FEATURES
- ...

IMPROVEMENTS
- ...

BUG FIXES
- Fixed an issue where...

VERIFIED
- ...

KNOWN LIMITATIONS
- ...
```

The template is a starting point, not a requirement to fill every section.
