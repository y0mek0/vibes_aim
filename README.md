# vibes_aim

A browser aim-trading game. Aim hits in a 3D arena farm simulated units of real-market tickers; a separate paper-trading terminal uses real charts and lets you buy, sell, long, short, and run positions up to 20x leverage. Every aim hit, every order, every P/L is server-validated. All money is play money.

This is the `mvp-v0.1` release. It is a fully playable single-player loop on top of a valotrainer aim engine. No real money, no broker, no debt, no withdrawals.

![initial menu](docs/screenshots/01-initial-menu.png)

## What it is

- **Aim loop**: Gridshot / Flick modes on top of a ported valotrainer engine. Each hit emits a `vibes:hit` event; a tiny client bridge POSTs it to the server; the server mints a simulated unit of the active ticker (default AAPL).
- **Chart widget**: top-right corner. TradingView Lightweight Charts via importmap (no `npm install`). 1D / 5D ranges, AAPL / NVDA tickers, polled every 1s, stale label after 5s. Tickers shown are the ones the player has actually unlocked.
- **Trading terminal**: full-height panel. Holdings, open positions, history, order ticket with leverage slider up to 20x, long/short, liquidation preview before confirmation.
- **Missions panel**: 6 missions on the AAPL chain. When all 6 are claimed, NVDA unlocks and the active ticker switches on next hit. `hold_60s` and `precise_session` are MVP shortcuts (1s, any winning trade) — real versions queued.
- **Guest mode**: works without login. Progress is in localStorage only. Real progress is in Supabase when the env is configured.

![terminal](docs/screenshots/02-terminal.png)

## Quick start

You need Node.js >= 20, a static file server for the client, and a single Node process for the server. The project ships with **no npm dependencies** — pure-Node http server, no Express.

```bash
# 1. Run the server (defaults to port 3000)
node server/src/index.js

# 2. In another terminal, serve the client on port 4173
npx --yes serve -p 4173 client

# 3. Open http://127.0.0.1:4173
```

The first paint shows a `vibes_aim` boot card. It pings `http://127.0.0.1:3000/health`. If reachable, the menu and the chart panel appear. If not, the boot card shows a one-line explanation and a `Skip` button so the player can still look at the menu.

The client reads the API base from `window.VIBES_API_BASE` or falls back to `http://127.0.0.1:3000`. To point at a different host, set it on the host page or via the boot card's `Skip` flow.

## Run the tests

```bash
npm test
```

Sixteen suites, no `npm install` required:

- Engine: `ballistics`, `gunplay`, `crosshair`, `stalker`, `themes`, `css`, `imports`.
- Server: `server`, `finnhub`, `supabase`, `dom`.
- Client: `client-bridge`, `chart`, `terminal`, `missions`, `visual`.

`visual` is a headless-Chrome smoke. It requires Python + Playwright + Chromium; if any is missing, the test is **skipped** and `npm test` stays green. See [docs/visual/README.md](docs/visual/README.md).

## Architecture

```
client/                          server/                       tests/
├── index.html                   ├── src/
├── src/                         │   ├── index.js              ├── *.test.mjs
│   ├── api.js                   │   ├── config.js             ├── visual_smoke.py
│   ├── store.js                 │   ├── router.js
│   ├── bootstrap.js             │   ├── util/json.js
│   ├── session.js               │   ├── market/
│   ├── persist.js               │   │   ├── provider.js
│   ├── terminal-core.js         │   │   ├── stub.js
│   ├── missions-core.js         │   │   ├── finnhub.js
│   └── chart.js (in js/)        │   │   └── index.js
├── js/                          │   ├── db/
│   ├── aim-bridge.js            │   │   ├── store.js (in-memory)
│   ├── chart.js                 │   │   └── supabase.js (PostgREST)
│   ├── terminal.js              │   └── routes/
│   ├── missions.js              │       ├── health.js
│   └── main.js (valotrainer)    │       ├── market.js
├── css/                          │       ├── aim.js
│   ├── upstream.css (valotrn)   │       ├── portfolio.js
│   └── style.css (vibes)        │       ├── missions.js
└──                              └── migrations/
                                     └── 0001_init.sql (Supabase)
```

The aim engine is `valotrainer @ ded498f5` (MIT) — modes, weapons, ballistics, crosshair editor, sensitivity sync, the works. We added one line to its `markHit` to emit `vibes:hit` on `window`; everything else is the upstream engine.

The server is pure-Node `http` + a tiny Express-shaped router. No Express, no Koa, no Fastify. The only env vars it reads are `PORT`, `ORIGIN`, `MARKET_PROVIDER`, `FINNHUB_TOKEN`, `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `AIM_HIT_RPS`, `AIM_HIT_UNIT`, `AIM_PRICE_IMPACT_MAX`. See `server/.env.example`.

The market data adapter is provider-neutral. `createMarketProvider({ provider, finnhubToken })` returns either a `stub` (deterministic offline) or a `finnhub` (real, requires token). Switching providers is one env-var.

The persistence layer is also backend-agnostic. `pickStore(supabaseConfig)` returns a Supabase-backed store if both `url` and `serviceKey` are present, otherwise the in-memory store. The Supabase adapter is built on the project's `fetch` (no `@supabase/supabase-js` dependency) and uses PostgREST directly.

The client store (`client/src/store.js`) is a thin layer over `fetch` that mirrors the server's state. It uses `localStorage` for guest persistence and falls back to server state on every page load.

## How the aim → ticker → trade loop works

```
engine markHit(head)        [valotrainer]
        |
        v
window 'vibes:hit'         [client/js/game.js, 1 line added]
        |
        v
client/js/aim-bridge.js    [listens, generates hitId, POST /aim/hit]
        |
        v
server/src/routes/aim.js   [rate-limit, idempotency, mint unit, credit balance]
        |
        v
server/src/db/store.js     [in-memory or Supabase PostgREST]
        |
        v
client/src/store.js        [refreshes, re-renders HUD chip + chart + terminal]
        |
        v
chart.js + terminal.js     [re-render with new state]
```

Server is the **only** place that mints simulated units. A client cannot fake a hit; the server checks `sessionId + hitId` for idempotency and rate-limits per session.

## Real money, real markets

- No. All money is play money. There is no broker integration, no withdrawal, no deposit. The chart shows real prices for visual realism, but the trades you make are entirely on a paper ledger.
- Pre-IPO tickers (OPENAI, ANTHROPIC) are listed as `pre_ipo: true` with `price: null`. The terminal refuses to open positions on them with a clear 400 response.
- Leverage is clamped to `[1, 20]`. Liquidation is computed at `entry * (1 ± 1/leverage)`. On liquidation the position closes and the margin is fully lost; stable is never negative.

## Deploy notes

The server is a single Node process. It reads `PORT` (default 3000). For a real deploy:

- **Render free tier**: `node server/src/index.js` as the start command, `PORT` is set by Render, `ORIGIN` should match the static client's URL.
- **Vercel** can host the `client/` as a static site. The server can run on Vercel as a Serverless Function with the `api/` shim, but the no-dep policy means writing that shim is on you.
- **Supabase** is the recommended persistence backend. Run `server/migrations/0001_init.sql` in the Supabase SQL editor, set `SUPABASE_URL` and `SUPABASE_SERVICE_KEY`, and the store automatically switches to Supabase. Otherwise the in-memory store keeps everything in a `Map` for the lifetime of the process.

See `server/.env.example` for the full env-var list.

## License

MIT. See [LICENSE](LICENSE).

The aim engine is `valotrainer @ ded498f5` (MIT) by Pratilectron. We use it as a base and add a single `window.dispatchEvent` line inside `markHit` to bridge engine hits to the rest of the game.

## Acknowledgements

- valotrainer — the aim engine. https://github.com/Pratilectron/valotrainer
- TradingView Lightweight Charts — the chart widget. https://github.com/tradingview/lightweight-charts
- Finnhub — the real-market data provider. https://finnhub.io
- Supabase — the production persistence backend. https://supabase.io
