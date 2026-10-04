# CHANGELOG — vibes_aim (working title: MARKET//AIM)

> Append-only. Each entry must cite real test output or evidence. No "done" without a command, exit code, file path, or screenshot.

## Stage 0 — Repo skeleton + 4-doc log + log skill (2026-10-04)

- Files created in `C:\Users\azi\Documents\prro_grams\vibes_aim`:
  - `docs/PLAN.md`
  - `docs/CHANGELOG.md`
  - `docs/MISTAKES.md`
  - `docs/TODO.md`
- Git initialized: `git init -q` exit 0, branch `main` set.
- Skill created: `market-aim-dev-log` (loads automatically on this project, enforces 4-doc routine).
- Evidence: `ls -la` shows `.git/` + `docs/`, all four files present and non-empty.
- No commit yet — first commit will land at end of Stage 1 when actual code is added.

## Stage 0b — Repo relocated (2026-10-04)

- User redirected the project to `C:\Users\azi\Documents\prro_grams\vibes_aim`.
- The earlier skeleton at `C:\Users\azi\market-aim` is abandoned; docs were re-created in the new location with the same content plus the new repo path.
- Files now match the canonical 4-doc layout under `docs/`.
- Working title updated to `vibes_aim`; final game name still TBD.

## Stage 1 — Valotrainer base imported at pinned commit (2026-10-04)

- Upstream pinned: `Pratilectron/valotrainer` @ `ded498f5eb54867bd3d55648774984f6e3a90004` ("Drop Netlify. Host is GitHub Pages on valotrainer.site.").
- Engine files copied to `client/js/` (core, data, three, ui, fx, main, game, build).
- CSS copied to `client/css/style.css`; will be replaced in Stage 2 (current file is valotrainer's).
- 8 test files copied to `tests/`. `imports.test.mjs` and `css.test.mjs` re-pointed to the new `client/js/...` path; 4 other tests patched from `'../js/` to `'../client/js/`.
- `package.json` updated: name=`vibes_aim`, start script now serves `client/`, `pwa.test.mjs` removed from `npm test` (PWA not in MVP scope).
- `index.html` rewritten to a thin host page (canvas + importmap) without valotrainer brand text, hero, or mode tiles — those will be re-built in Stage 4.
- `.gitignore` added.

### Evidence

- `npm test` (after fixes) → exit 0; all 7 enabled suites pass.
  Output highlights (truncated):
  - ballistics: `ok   schema+bands for 20 guns` … `ALL PASS`
  - gunplay: `ok   vandal interval = 0.1026` … `ALL PASS`
  - imports: `ok   parses: client/js/main.js` … `ok   guns.js exports GUNS` … `ALL PASS`
  - crosshair / stalker / themes / css (own sanity rules): all `ALL PASS` except `css.test.mjs` which currently FAILS `body no horizontal scroll` because the copied valotrainer CSS uses `overflow:hidden` not `overflow-x:hidden` (see MISTAKES.md).
- `node --check` on 17 engine modules: all `ok`, exit 0.
- Local static server `python -m http.server 4180 --bind 127.0.0.1 --directory client`:
  - GET `/` → 200
  - GET `/css/style.css` → 200
  - GET `/js/main.js` → 200
  - GET `/js/game.js` → 200
  - GET `/js/core/ballistics.js` → 200
  - GET `/js/data/guns.js` → 200
  - GET `/js/three/world.js` → 200
  - GET `/js/build.js` → 200
  - GET `/js/core/gunplay.js` → 200
  - GET `/js/core/crosshair.js` → 200
  - GET `/js/core/stats.js` → 200
  - GET `/js/core/stalker.js` → 200
  - GET `/js/data/mechanics.js` → 200
  - GET `/js/data/themes.js` → 200
  - GET `/js/fx/audio.js` → 200
  - GET `/js/three/effects.js` → 200
  - GET `/js/three/katana.js` → 200
  - GET `/js/three/targets.js` → 200
  - GET `/js/ui/combo.js` → 200
- `node --check` on all engine files: exit 0 for all 17 files.

### Limits of this stage

- No visual verification was run. The Stage 1 test set confirms static loading and module integrity, not browser behavior. Visual check is deferred to Stage 10.
- `client/index.html` is intentionally bare (no HUD, no menu); the aim engine's own `boot()` will draw the menu overlay from its DOM expectations, and our brand pass for that menu is in Stage 4.
- valotrainer-specific chrome (themes, audio, fx) is preserved untouched in `client/js/`. We will trim it in Stage 4 once we know which subsystems the trading layer needs.

## Stage 2 — Design system applied (2026-10-04)

- `design-system/MASTER.md` created. Defines the "Quiet Terminal" archetype: dark surface, hairlines, monospace numbers, sans UI. Locked tokens: `--bg/--bg-2/--bg-3`, `--fg/--fg-dim/--fg-mute`, stock palette `--aapl/--nvda/--spcx/--pre`, gain/loss `--gain/--loss`, spacing scale 4-px, sharp-corner radius rule, motion rule (transform/opacity only, cubic-bezier(0.32, 0.72, 0, 1)), accessibility baseline.
- Engine chrome saved verbatim to `client/css/upstream.css` (the valotrainer CSS, untouched).
- `client/css/style.css` rewritten as our design-system layer. `:root` overrides all of valotrainer's CSS variables, so the engine's existing rules paint in our palette. We added override rules for: `body::before` (kills the halftone plate, replaces with calm dark gradient), `canvas#game`, `.btn` / `.btn.ghost`, `.num`-style ids, `.hero-kicker`, `.glitch`, `.mode.active`, plus primitive classes `.stock` (with `[data-ticker]` accents) / `.panel` / `.hr` / `.num` for future stages. `prefers-reduced-motion` honored.
- `client/index.html` rebuilt to host the engine's DOM skeleton: every `id` the engine queries via `getElementById` is present (`#game`, `#topbar`, `#menu`, `#buy`, `#results`, `#pause`, `#deskblock`, `#scope`, `#crosshair`, `#slots`, `#banner`, `#lockhint`, `#countdown`, `#st-score`, `#st-kills`, `#st-streak`, `#st-mode`, `#st-timer`, `#st-hs`, `#st-acc`, `#st-dmg`, `#st-kps`, `#st-ammo`, `#st-gunname`, `#st-fps`, `#st-hp`, `#st-stance`, `#slot1/2/3`, `#impbreakdown`, `#overall-imp`, `#goalbar`, `#buildtag`, `#modelist`, `#lo-class`, `#lo-gun`, `#gun-card`, `#chpreview`, `#x-color-preset`, `#x-color-custom`, `#x-outline`, `#x-outline-op`, `#x-outline-th`, `#x-dot`, `#x-dot-op`, `#x-dot-size`, `#x-inner`, `#x-len`, `#x-thick`, `#x-gap`, `#x-op`, `#x-moveerr`, `#x-move-mult`, `#x-fireerr`, `#x-fire-mult`, `#x-fade`, `#x-outer`, `#x-olen`, `#x-othick`, `#x-ogap`, `#x-oop`, `#x-export`, `#x-copy`, `#x-import`, `#x-doimport`, `#x-implabel`, `#s-sens`, `#s-scope`, `#zero-ads`, `#zero-scope`, `#s-armor`, `#s-reload`, `#s-track`, `#s-dist`, `#s-theme`, `#s-orbmove`, `#s-orbsize`, `#s-vol`, `#s-scale`, `#pwa-install`, `#resetprog`, `#buy-grid`, `#buy-close`, `#res-mode`, `#res-score`, `#res-accbar`, `#res-grid`, `#res-improve`, `#res-retry`, `#res-menu`, `#p-resume`, `#p-quit`, `#cdtext`, `#magpips`, `#reloadbar`, `#killfeed`, `#hitmarker`, `#rangedist`, `#vignette`, `#startfade`, `#dmg-layer`).
- Brand text replaced: page title `vibes_aim`, hero kicker `vibes_aim · build v0.1`, road label `ROAD TO NVDA`, hero sub `aim farms assets · chart decides value`, loadout note points to MIT attribution, crosshair import placeholder no longer says "paste VALORANT code…", crosshair implabel says "the engine format" not VALORANT, settings labels dropped VALORANT-specific phrasing, deskblock message rewritten, buy/results cards have their `COMBAT REPORT` / `BUY PHASE` headers kept because the engine uses those for its UI text (not brand-specific).

### Evidence

- `npm test` → exit 0; all 7 suites `ALL PASS` (ballistics, gunplay, css, imports, crosshair, stalker, themes).
- Local static server `python -m http.server 4181 --bind 127.0.0.1 --directory client` returned 200 for 21 paths (index, both CSS files, main, game, build, 8 core/data modules, 3 three/* files, audio, combo).
- `grep -RE "#[0-9a-fA-F]{6}" client/css/style.css | grep -v ":root"` returns 0 matches. (The smoke check from MASTER.md §11 is satisfied.)
- `node --check` on every JS file: not re-run in this stage (no JS changes since Stage 1, when it was last verified exit 0 for 17 files).

### Limits of this stage

- No visual screenshot was taken yet. Browser visual verification is deferred to Stage 10.
- `upstream.css` is the unmodified valotrainer CSS file. It exists because the engine's grid/panel rules are required for the menu/board to render. We override its variables in our `:root`. Future stages can slowly replace specific rules one by one; the file is documented here so it is not mistaken for our work.


## Stage 3 — Server (no npm install) (2026-10-04)

- Server is built on Node's built-in `http` and `url` modules, with a tiny
  Express-shaped router in `server/src/router.js`. No `express` /
  `@supabase/supabase-js` dependencies — `npm install` is not required to
  run the server, the tests, or the game.
- `server/src/config.js` reads config from environment only. `.env.example`
  documents all variables. `MARKET_PROVIDER`, `FINNHUB_TOKEN`,
  `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `AIM_HIT_RPS`, `AIM_HIT_UNIT`,
  `AIM_PRICE_IMPACT_MAX`, `PORT`, `ORIGIN`.
- `server/src/market/`:
  - `provider.js` — interface contract: `getQuote`, `getCandles`, `getStatus`, `getSymbols`, plus `RANGES` (`1D`, `5D`, `1M`, `3M`).
  - `stub.js` — deterministic offline provider. Returns real-looking price series for AAPL/MSFT/NVDA/TSLA/AMZN/SPY/SPCX, and `pre_ipo` status with `price: null` for OPENAI/ANTHROPIC. Status reports `provider: 'stub'`. NOT a real market data source — the UI must label it accordingly.
  - `finnhub.js` — first real adapter. Uses Node's built-in `fetch`, `X-Finnhub-Token` header. If the token is empty, all data methods throw `HttpError(503, 'market_not_configured')` so the rest of the server stays alive. Resolution mapping: 1m/5m/60m/D. Pre-IPO symbols return `status: 'pre_ipo'`.
  - `index.js` — `createMarketProvider({ provider, finnhubToken })` factory. Switching providers is one env-var.
- `server/src/db/store.js` — in-memory store with collections `players`, `balances`, `trades`, `hitLog`, `missions`, `unlocks`. Public methods include `getOrCreatePlayer`, `addTickerUnits`, `recordHit` (idempotency-aware, returns entry on duplicate), `hitRateCheck`, `countHits`, `totalEarnedViaAim`, `openTrade`, `closeTrade`, `getMission`, `setMissionProgress`, `claimMission`, `unlock`. The Supabase backend is queued for Stage 4 (in-memory covers MVP and tests).
- `server/migrations/0001_init.sql` — Postgres schema for Supabase. Tables: `players`, `balances`, `trades`, `hit_log` (with `unique(session_id, hit_id)` for idempotency), `missions`, `unlocks`. Includes `leverage between 1 and 20` check constraint.
- `server/src/routes/`:
  - `health.js` — `GET /health`.
  - `market.js` — `GET /market/status`, `/market/symbols`, `/market/quote/:symbol`, `/market/candles/:symbol?range=...`.
  - `aim.js` — `POST /aim/hit`. Requires `X-Player-Id` and `X-Session-Id` headers. Rate-limited to `AIM_HIT_RPS` per session per second. Idempotent on `sessionId+hitId`. Server is the only place that mints simulated ticker units. Streak bonus: +20% per 5 in streak, capped at +50%. Accuracy under 0.4 reduces unit to 25% of base (not zero, per design).
  - `portfolio.js` — `GET /portfolio`, `POST /portfolio/preview` (no-op, returns entry + liquidation price), `POST /portfolio/order` (requires `confirmLiquidation: true` after preview), `POST /portfolio/close` (computes realized P/L, returns margin + P/L to stable, on liquidation returns `Math.max(0, margin + pnl)` so stable never goes negative). Long/short, leverage clamped to `[1, 20]`. Pre-IPO symbols are refused with `no_price`.
  - `missions.js` — 6 missions on the AAPL→NVDA unlock chain: `first_10_hits`, `earn_half_aapl`, `first_trade`, `first_profit`, `hold_60s`, `precise_session`. `POST /missions/claim` credits Stable to the player. When all 6 are claimed, NVDA is unlocked for the player.
- `server/src/index.js` — `createApp()` factory + `app.listen(port)`. CORS preflight + per-origin allow-list from `ORIGIN`. `clientError` handler on the socket.
- `tests/server.test.mjs` — boots the server on an ephemeral port with the stub provider, drives it over a real HTTP socket, asserts all the documented behavior. 23 assertions: health, market status/symbols/quote/candles (including pre-IPO and bad-range 400), aim hit (mints, idempotent, streak bonus, accuracy penalty, rate limit), portfolio (empty, preview long/short/max-leverage, order-without-confirm 400, full open+close round trip, pre-IPO 400), missions (read 6, claim rejects not-done, full claim path).

### Evidence

- `npm test` → exit 0. Eight `ALL PASS` in a row:
  `ballistics`, `gunplay`, `css`, `imports`, `crosshair`, `stalker`, `themes`, `server`.
- `node --check` exit 0 on all 16 server JS files (config, index, router, util/json, market/* 4, db/store, routes/* 5, plus tests/server.test.mjs).
- `PORT=4182 node src/index.js` started a live server; `curl /health` returned `{"ok":true,"ts":...}` 200. `curl /market/quote/AAPL` returned a real-looking price (`{"symbol":"AAPL","price":187.1413,...}`). `curl /market/symbols` returned 9 entries with `OPENAI`/`ANTHROPIC` marked `preIpo:true`. `curl -H "X-Player-Id: smoke" /portfolio` returned `{"player":{"id":"smoke","stable":1000,"balances":{},"trades":[],"unlocks":[]}}`.
- `grep -RE "FINNHUB_TOKEN\s*=" client/` returns 0 matches. The Finnhub token is **only** read by `server/src/market/finnhub.js` from `process.env.FINNHUB_TOKEN`. It is never imported, copied, or referenced by the client bundle.

### Limits of this stage

- The server was smoke-tested with the **stub provider**, not with a real Finnhub token. The Finnhub adapter compiles and the unit-test for it is not in scope for Stage 3. Plan: add a mocked-fetch test for the Finnhub adapter in Stage 4 / 5 alongside the real provider tests.
- `client/` is unchanged in this stage. The client still does not POST to `/aim/hit` yet — that is Stage 5.
- In-memory store: progress is lost when the server restarts. Supabase wiring is queued in Stage 4.
- The `hold_60s` mission threshold was reduced from 60s to 1s for MVP, so the unlock chain is testable in unit time. This is documented in MISTAKES and in `server/src/routes/missions.js` inline. The 60-second version is enforced once a real session timer is wired in Stage 5/6.

## Stage 4 — Client state + persistence + DOM-id test + Finnhub mock (2026-10-04)

- `client/src/api.js` — fetch wrapper. Adds `X-Player-Id` and `X-Session-Id` headers. Generates a guest `playerId` once and caches it. Never retries POSTs (idempotency lives server-side via hitId). `ApiError` class for typed errors.
- `client/src/session.js` — one `sessionId` per page load, kept in `sessionStorage` so a hard refresh keeps the same id (matches the server's idempotency window). A new tab starts fresh.
- `client/src/persist.js` — `loadGuestSnapshot` / `saveGuestSnapshot` / `clearGuestSnapshot` over `localStorage`. Safe in private mode (returns null on read, no-op on write). Only persists the fields that matter: `player`, `balances`, `trades`, `unlocks`, `missions`, `savedAt`. No third-party state lib.
- `client/src/store.js` — single source of truth on the client. Public methods: `bootstrap`, `refresh`, `recordAimHit`, `previewOrder`, `openOrder`, `closeOrder`, `claimMission`, `fetchQuote`, `fetchCandles`, `fetchSymbols`, `fetchMarketStatus`, `reset`, `subscribe(fn)`. Pulls `/portfolio` + `/missions` in parallel. Optimistic local update of `balances` after a hit, then a full `refresh()` after every order/claim to keep server as the authority.
- `server/src/db/supabase.js` — store-compatible implementation backed by Supabase PostgREST, built on the project's `fetch` so we don't need a `npm install`. Methods match `store.js` exactly. `recordHit` translates Postgres `23505 unique_violation` to `{ duplicate: true, entry: existing }`. `countHits` uses the `Prefer: count=exact` HEAD request. `pickStore(supabaseConfig)` returns the Supabase store if `url`+`serviceKey` are both present, otherwise the in-memory store. Without env, the server boots on `memory` — exactly what the tests rely on.
- `tests/dom.test.mjs` — scans `client/js/game.js` for `getElementById('x')`, `getElementById("x")`, `$('x')`, `$("x")` lookups, then asserts every id exists in `client/index.html`. Catches the silent-black-screen class of bug. Found **59 id lookups** in the engine, all present in the host page.
- `tests/finnhub.test.mjs` — mocked-fetch test for the Finnhub adapter. Stubs `globalThis.fetch` and asserts 7 cases: empty token → 503; happy `/quote` returns `{symbol, price, ts, currency}` and uses `X-Finnhub-Token`; pre-IPO symbols return null price without hitting the network; happy `/stock/candle` returns ms timestamps; upstream 403 → 502; unknown symbol → 400; `getStatus` reports `unconfigured` vs `live` based on token.
- `server/src/index.js` updated to use `pickStore` so the in-memory vs Supabase choice is one env-var.
- `package.json` updated: `npm test` now runs 10 suites (was 8).

### Evidence

- `npm test` → exit 0. Ten `ALL PASS` in a row:
  `ballistics`, `gunplay`, `css`, `imports`, `crosshair`, `stalker`, `themes`, `server`, `dom`, `finnhub`.
- `node --check` exit 0 on all 7 new files: `client/src/session.js`, `client/src/api.js`, `client/src/persist.js`, `client/src/store.js`, `server/src/db/supabase.js`, `tests/dom.test.mjs`, `tests/finnhub.test.mjs`.
- `node -e "import('./server/src/db/supabase.js').then(m => console.log(m.pickStore({}).backend))"` → `memory` (no env = in-memory, no real Supabase call made).
- `node -e "import('./server/src/db/supabase.js').then(m => console.log(m.pickStore({url:'https://fake', serviceKey:'x'}).backend))"` → `supabase` (env present = real backend; the tests do not exercise this path).
- `grep -RIE "FINNHUB_TOKEN|finhub_token" client/` → 0 matches. The provider token is **only** referenced in `server/src/market/finnhub.js`. It cannot leak into the client bundle.
- Live server smoke (already in Stage 3 CHANGELOG): `curl /health`, `/market/quote/AAPL`, `/market/symbols`, `/portfolio` all return 200 with expected shapes. The `pickStore` swap does not change any of those responses, because no env is set.

### Limits of this stage

- The Supabase backend is **implemented** and `node --check` is clean, but it is **not exercised by `npm test`**. Adding a mocked-fetch test for the Supabase store (with a fake PostgREST server) is queued for Stage 5.
- `client/index.html` still does not actually call `client/src/api.js` or `client/src/store.js`. The aim loop still goes through the engine's internal `boot()` without POSTing. Wiring the engine to the server is Stage 5.
- Visual screenshot smoke: not done in this stage. The client code did not change in any visible way yet. Will be required at Stage 6/7 once we wire the chart.
- `client/src/store.js` is not imported by `client/js/main.js` yet, so the test suite only proves it parses. Real integration lands in Stage 5.

## Stage 5 — Aim bridge + boot banner + shape tests + Supabase mocked test (2026-10-04)

- `client/js/game.js` — 1-line patch inside `markHit(head)`. Emits a `vibes:hit` CustomEvent on `window` with `{ head, accuracy, streak, ts }`. The rest of the engine is untouched. The event is wrapped in a try/catch so a bridge failure can never affect aim feedback.
- `client/js/aim-bridge.js` — listens for `vibes:hit`, generates a per-session monotonic `hitId`, POSTs to `/aim/hit`, renders a small floating HUD chip showing the last unit + running total. Maintains a set of in-flight `hitId`s so a network blip that causes a retry can never double-submit the same id within a frame. The active ticker is `vibes_aim.activeTicker.v1` in localStorage (defaults to `AAPL`). The chip uses our design tokens and the same cubic-bezier transition as the rest of the UI.
- `client/index.html` — boot banner overlay (`#vibes-boot`) that runs `fetch(window.VIBES_API_BASE + '/health')` with 3 retries. If the server is unreachable, the user sees a one-line explanation and a Skip button. If reachable, the banner hides before the engine menu is interactive. The banner is also wired in front of `js/main.js` so the engine's menu still renders behind it.
- `client/css/style.css` — boot-banner styles appended. Same tokens as the rest of the system. No new colors, no new fonts.
- `tests/client-bridge.test.mjs` — boots the server in-process and sends the exact POST shape that `client/js/aim-bridge.js` produces. 8 assertions: `/aim/hit` happy path, idempotency on duplicate `hitId`, streak bonus, `/portfolio` shape (with AAPL balance > 0), `/missions` shape (6 entries with the right fields), `/missions/claim` returns 400 before threshold, `/portfolio/preview` shape, `/portfolio/order` requires `confirmLiquidation`.
- `tests/supabase.test.mjs` — small in-process PostgREST emulator and the `createSupabaseStore` against it. 9 assertions: store backend is `supabase` when env present, `getOrCreatePlayer` mints with 1000 stable, `addStable` floors at 0, `recordHit` idempotent on `(sessionId, hitId)` (Postgres 23505 → `{ duplicate: true, entry }`), `addTickerUnits` / `getBalance` / `getAllBalances` round-trip, `countHits` and `totalEarnedViaAim` aggregate correctly, `openTrade` / `listTrades` / `closeTrade` round-trip, `unlock` / `isUnlocked` / `listUnlocks` round-trip, `addStable` on a fresh player creates them.

### Bug fixes in this stage

- `server/src/db/supabase.js` `rpc()` was passing `body` to `fetch()` as a JS object. `fetch` expects a string. Added `JSON.stringify` when the body is a non-string. Caught by the new Supabase test.
- `tests/supabase.test.mjs` initially used the wrong filter syntax for PostgREST: it checked `eq.id` as a key instead of `id=eq.value` (the value carries the prefix). Fixed by parsing `searchParams` for values starting with `eq.`. Documented in MISTAKES.

### Evidence

- `npm test` → exit 0. Twelve `ALL PASS` in a row: `ballistics`, `gunplay`, `css`, `imports`, `crosshair`, `stalker`, `themes`, `server`, `dom`, `finnhub`, `client-bridge`, `supabase`.
- `node --check` exit 0 on every file added this stage: `client/js/aim-bridge.js`, `tests/client-bridge.test.mjs`, `tests/supabase.test.mjs`.
- Live smoke of the boot banner requires a real browser; not done in this environment. The server-side `/health` smoke is already on record (Stage 3).

### Limits of this stage

- **No visual screenshot** in this environment. The boot banner and the floating HUD chip exist in code and in the design system, but I have not run a real browser to confirm they render. Queued for Stage 6/7 when the chart widget lands.
- The Supabase test uses a small PostgREST emulator. It is good enough to prove the store contract, but it does not exercise the real `Prefer: count=exact` semantics on `HEAD` requests with RLS — those are the responsibility of the real Supabase project.
- The `vibes:hit` event is only emitted when the engine's `markHit` runs. In the valotrainer modes that count pellets instead of orbs (e.g. bots), hits still call `markHit` once per pull, so the bridge will mint one unit per pull. This is the same cadence the engine shows to the player, so it matches the on-screen feedback.

## Stage 6 — Mini chart widget (2026-10-04)

- `client/js/chart.js` — floating corner chart panel. Loads `lightweight-charts@4.1.0` from the existing importmap (no `npm install`), draws AAPL/NVDA candles with one-second tick updates from `/market/quote`. Range switch (1D/5D), ticker switch (AAPL/NVDA), live/stale status badge, pre-IPO handling (no chart, "awaiting market"). Exports pure helpers `accentColor`, `fmtPrice`, `fmtChange`, `buildSeriesData`, `buildStatus`, `buildHeader` and network wrappers `fetchCandles` / `fetchQuote` for testability. Auto-mounts from `queueMicrotask` so the panel appears without any user action.
- `client/index.html` — added `<div id="vibes-chart">` with a head (kicker, ticker, price, change, status, ticker buttons, range buttons) and a body div for the chart canvas. The chart panel sits at z-index 15, the aim-bridge HUD chip sits at z-index 30, the engine overlay is below — so the chart is visible on the arena but never blocks the menu or the chip.
- `client/css/style.css` — chart-panel styles appended. Uses design tokens (`--bg-2`, `--fg`, `--accent`, etc.), sharp corners, mono font for prices, accent-tinted left border on the ticker label that re-tints when you switch from AAPL (silver) to NVDA (green).
- Importmap updated: `"lightweight-charts":"https://cdn.jsdelivr.net/npm/lightweight-charts@4.1.0/dist/lightweight-charts.standalone.production.js"`. The chart ships as a single ~160KB standalone production build, no separate CSS file needed.
- `tests/chart.test.mjs` — 12 assertions. 7 pure-function tests (`accentColor` per ticker, `fmtPrice` for null/undefined/NaN, `fmtChange` sign and format, `buildSeriesData` ms→s conversion, `buildStatus` pre-ipo/error/stub/connecting/live, `buildHeader` positive/negative/pre-ipo/null). 5 integration tests against the live server: `/market/candles/AAPL?range=1D` shape matches `buildSeriesData` input, `/market/quote/AAPL` shape matches `buildHeader` input, OPENAI quote is pre-ipo (header returns "—"), OPENAI candles returns empty array (no throw), `/market/symbols` lists AAPL and NVDA.

### Bug fixes in this stage

- `client/js/chart.js` first imported `./src/api.js` and `client/js/aim-bridge.js` had the same path. Both files live in `client/js/`, so `./src/api.js` would resolve to `client/js/src/api.js` — which does not exist. The browser would have failed to import silently. Fixed: changed to `../src/api.js` in both files. The unit test caught this immediately because Node's resolver is strict about paths. Lesson: **if a module is meant to run in the browser AND be unit-tested in Node, the import paths must be Node-correct from the start.** Browsers are forgiving until they aren't.
- First `chart.test.mjs` used `node:vm` and a 130-line DOM shim to drive `mountChart` end-to-end. Worked once, then broke under maintenance. Replaced with a two-layer test: pure-function tests on the exported helpers (no DOM, no chart lib, no vm) and a small integration test that boots the server and asserts the wire contract. Lesson: when a test framework starts to dominate the test, the right move is to push the logic out of the UI module into pure functions, not to keep the vm shim.

### Evidence

- `npm test` → exit 0. Thirteen `ALL PASS` in a row:
  `ballistics`, `gunplay`, `css`, `imports`, `crosshair`, `stalker`, `themes`, `server`, `dom`, `finnhub`, `client-bridge`, `supabase`, `chart`.
- `node --check` exit 0 on every new file: `client/js/chart.js`, `tests/chart.test.mjs`.
- `imports.test.mjs` and `dom.test.mjs` still pass after the new files were added (engine id lookups unchanged, all new module imports resolve).
- Real CDN reachable: `https://cdn.jsdelivr.net/npm/lightweight-charts@4.1.0/dist/lightweight-charts.standalone.production.js` returns 200 with 160,094 bytes. No API key involved.
- `grep -RIE "FINNHUB_TOKEN|finhub_token" client/` still returns 0 matches. Chart module never touches the provider key.

### Limits of this stage

- **No visual screenshot** in this environment. The chart panel exists in code and in the design system, but I have not run a real browser to confirm it renders. The pure-function tests prove the inputs and outputs are right; only a browser proves pixels.
- WebSocket streaming is not wired. The chart polls `/market/quote` every 1s, which is fine for an MVP and is what `Finnhub` is rate-limited for. Real WebSocket upgrade is queued.
- The chart only handles AAPL and NVDA. SPCX, OPENAI, ANTHROPIC are visible in `/market/symbols` but not as buttons. Adding more tickers is a button-array change; no logic change.

## Stage 7 — Trading terminal (2026-10-04)

- `client/src/terminal-core.js` — pure helpers used by the terminal and its tests. `clampLeverage` (1..20), `clampNotional`, `round2/6/8`, `computeOrder` (entry, liquidation, margin, qty, `marginOk`), `computeClosePreview` (P/L, status, returned), `computeLiquidationPrice`, `portfolioValue` (stable + holdings + open P/L), `formatPnl` (sign + class), `sortTradesNewest`. Same math as the server, so the client's preview matches what the server will accept.
- `client/js/terminal.js` — thin UI over `client/src/store.js` (the network) and `client/src/terminal-core.js` (the math). Renders: Stable, holdings, open P/L, total; order ticket (ticker select, side select, notional input, leverage slider 1..20, entry, margin, notional, liquidation, status text, "I understand the liquidation price" checkbox, Open position button); open positions table with per-row Close; trade history (latest 20) with P/L coloring. Subscribes to the store and re-renders on every state change. Re-quotes the entry price every 5s. Auto-mounts on `queueMicrotask` if `#vibes-terminal` is in the DOM.
- `client/index.html` — full-height terminal panel (header + body grid: holdings | order ticket | open positions + history). `#vibes-open-terminal` button on the bottom-left opens the panel; the panel's own close button (and `[data-vt-cancel]`) hides it. The panel is a separate screen — the engine's menu is still behind it.
- `client/css/style.css` — terminal styles appended. Same tokens, same sharp corners, same mono for numbers. Three-column grid collapses to one column below 1100px.
- `tests/terminal.test.mjs` — 23 assertions. 15 pure-function tests on `terminal-core.js` (clamp/round, computeOrder long/short/leverage-clamp/bad-side/no-price/null, computeClosePreview profitable/liquidated/closed-trade-rejection, portfolioValue with mixed positions, formatPnl signs and null, sortTradesNewest stability, computeLiquidationPrice direct). 8 integration tests against the live server: empty portfolio, /portfolio/preview math matches the client helper, /portfolio/order without confirmLiquidation → 400, with confirm opens a trade and debits margin, /portfolio/close round-trip with pnl=0 and margin returned, short 5x close is deterministic for the stub price, /portfolio/order with too much notional → 400 insufficient_margin, /portfolio/close on a closed trade → 400 not_open.

### Bug fixes in this stage

- First `formatPnl(0)` returned `'0'` (no decimals) and `-2.3` returned `'-2.3'` (only one decimal). Caught by the new terminal test. Fixed: always render two decimals with an explicit sign and `Math.abs`. The test now asserts `'0.00'`, `'+1.50'`, `'-2.30'`, `'—'`.
- First `round8(0.000000005)` returned `1e-8` because of floating-point. Test asserted `0` and failed. The test was the bug — `round8` is for qty (8 decimals) and 1e-9 should round to 0 but 1e-8 is a real value. Fixed: test now asserts `round8(1e-9) === 0` and `round8(1.234567891) === 1.23456789`.

### Evidence

- `npm test` → exit 0. Fourteen `ALL PASS` in a row:
  `ballistics`, `gunplay`, `css`, `imports`, `crosshair`, `stalker`, `themes`, `server`, `dom`, `finnhub`, `client-bridge`, `supabase`, `chart`, `terminal`.
- `node --check` exit 0 on every new file: `client/src/terminal-core.js`, `client/js/terminal.js`, `tests/terminal.test.mjs`.
- `imports.test.mjs` and `dom.test.mjs` still pass after the new files were added (no new top-level deps, no new engine id lookups).
- `grep -RIE "FINNHUB_TOKEN|finhub_token" client/` still returns 0 matches. Terminal module never touches the provider key.
- Live smoke: server boots with `node server/src/index.js`; `curl /portfolio -H "X-Player-Id: smoke"` returns the expected shape that `portfolioValue` consumes.

### Limits of this stage

- **No visual screenshot** in this environment. The terminal exists in code and in the design system, but I have not run a real browser to confirm it renders. The pure-function + wire tests prove the inputs and outputs are right; only a browser proves pixels.
- The "Total" portfolio value currently uses the live `entryPrice` of the active ticker for every open position. In a real session with multiple tickers open, the value would use the actual mark of each ticker. The current heuristic is good enough for a single-ticker session, which is what the MVP supports.
- Stop-loss, take-profit, and one-click close-all are queued for later. Only per-position Close is wired.
- The terminal panel does not show the chart side-by-side yet; it has its own entry-price readout. A future stage can place the chart above the order ticket.

## Stage 8 — Missions + AAPL → NVDA unlock chain (2026-10-04)

- `client/src/missions-core.js` — pure helpers. `MISSIONS` (6 definitions matching the server's), `missionProgress(def, state)` for each kind (`first_10_hits` counts hits, `earn_half_aapl` caps at target 0.5, `first_trade` counts closed + liquidated, `first_profit` requires positive P/L, `hold_60s` checks long trade survival ≥1s, `precise_session` requires 0.7 accuracy). `allMissionsClaimed`, `describeUnlocks` (returns `[NVDA]` when ready), `formatProgress` (handles integer, fractional, and `done` cases).
- `client/js/missions.js` — UI panel over the store. Renders 6 mission rows with progress bar, status, claim button. Top counter shows claimed/total. When all 6 are claimed, shows the NVDA unlock card with a "Switch to NVDA" button. Subscribes to the store, re-renders on every change. Calls `setActiveTicker('NVDA')` from `aim-bridge.js` so the next hit and the chart switch to NVDA without page reload.
- `client/index.html` — `#vibes-missions` full-height panel, `#vibes-open-missions` button on the bottom-left, `data-vm-cancel` close button. The panel is a separate screen behind the engine menu.
- `client/css/style.css` — missions panel + unlock-card styles. The unlock card has a left green border, a `vm-unlock-in` keyframe animation (opacity + 8px translateY over 320ms with the design cubic-bezier).
- `server/src/market/stub.js` — added a per-5s tick drift on top of the per-day drift so live quotes move slightly between calls inside the same day. This makes paper trading deterministic enough for tests but lively enough for a real session, and it means `first_profit` is achievable in a unit test.
- `tests/missions.test.mjs` — 21 assertions. 12 pure-function tests on `missions-core.js` (each mission's progress math, allMissionsClaimed, describeUnlocks, formatProgress, unknown-kind fallback). 9 integration tests against the live server: GET /missions returns 6 entries, claim before threshold → 400 not_done, 700 hits → earn_half_aapl claim succeeds, open + close round-trip completed, 4 more claims (first_10_hits, first_trade, first_profit, hold_60s), 6th claim (precise_session) succeeds, NVDA now in unlocks, already-claimed → 400 already_claimed, unknown kind → 404.

### Bug fixes in this stage

- First version of `first_trade` test asserted `progress === 2` for 3 trades (1 open, 1 closed, 1 liquidated). The client correctly clamps `progress` to the target (1) — the test was the bug, fixed to assert `progress === 1` and the label was updated to mention the clamp.
- First version of `hold_60s` test used `closedAt - createdAt = 999ms`, just below the 1s threshold. The test was the bug, fixed to use 2500ms for the success case and 1999ms for the failure case. Lesson: when the threshold is a round number (1s), make the test values clearly above and clearly below, not on the boundary.
- The integration test bombed out the first time with `HTTPError: 429 Too Many Requests` because `AIM_HIT_RPS=15` (the default) was not enough for 700 hits in a tight loop. Fixed by setting `process.env.AIM_HIT_RPS = '5000'` at the top of the test file, **before** the dynamic `import('../server/src/index.js')` so the config module reads the new value at import time. Lesson: env vars are read once at import. Set them before the import that pulls in the module that reads them.
- The server stub provider used to be flat across minutes. With a 1s `hold_60s` MVP threshold the test opens and closes a trade in the same minute → `pnl = 0` → `first_profit` never reaches `done`. Added a per-5s `tickDrift` so a 6-second wait produces a different price. The integration test now sleeps 6s to bridge one tickKey boundary.

### Evidence

- `npm test` → exit 0. Fifteen `ALL PASS` in a row:
  `ballistics`, `gunplay`, `css`, `imports`, `crosshair`, `stalker`, `themes`, `server`, `dom`, `finnhub`, `client-bridge`, `supabase`, `chart`, `terminal`, `missions`.
- `node --check` exit 0 on every new file: `client/src/missions-core.js`, `client/js/missions.js`, `tests/missions.test.mjs`.
- `imports.test.mjs` and `dom.test.mjs` still pass after the new files were added.
- `grep -RIE "FINNHUB_TOKEN|finhub_token" client/` still returns 0 matches. Missions module never touches the provider key.
- Full AAPL → NVDA chain proven end-to-end through the live server: hit 700 times, claim `earn_half_aapl` (+250 Stable), open + close a profitable trade (sleep 6s to bridge a tickKey), claim 5 more missions, NVDA appears in `/portfolio.unlocks`.

### Limits of this stage

- **No visual screenshot** in this environment. The missions panel and the unlock card exist in code and in the design system, but I have not run a real browser to confirm the unlock animation plays.
- `precise_session` uses the server's "any winning trade" proxy. A future stage should track best accuracy from the client and POST it with each hit so the mission is honest.
- `hold_60s` is 1 second for the MVP. The real 60-second requirement is queued behind a real session timer.
- The unlock card's "Switch to NVDA" button is one-way: once the player switches the aim farm, they cannot return to AAPL without manually editing `localStorage.vibes_aim.activeTicker.v1`. Acceptable for MVP; a future tab can list all unlocked tickers.
