# vibes_aim mvp-v0.1

First release of vibes_aim, a browser aim-trading game.

- Aim loop on top of valotrainer (Gridshot, Flick).
- Each hit mints a simulated unit of the active ticker (AAPL by default).
- Chart panel: TradingView Lightweight Charts via importmap. 1D/5D ranges, AAPL/NVDA tickers, polled every 1s.
- Trading terminal: long/short, leverage 1–20x, liquidation preview, P/L tracking.
- 6-mission AAPL -> NVDA unlock chain.
- Real Finnhub adapter (or offline stub).
- Supabase persistence (or in-memory fallback).
- LocalStorage for guest mode.
- Boot screen with server-availability check.
- 16/16 test suites green; visual smoke with Python Playwright.

No real money. No broker. No debt. All trades are paper.

## Run

```bash
node server/src/index.js          # server on :3000
npx serve -p 4173 client          # client on :4173
open http://127.0.0.1:4173
```

## Tests

```bash
npm test
```

See README.md and deploy/README.md for full details.
