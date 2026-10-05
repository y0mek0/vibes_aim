# PLAN — vibes_aim (working title: MARKET//AIM)

> Forward-looking plan. Source of truth for what we are doing next.
> Historical record of completed work lives in `CHANGELOG.md`. Failures live in `MISTAKES.md`. Active backlog lives in `TODO.md`.

## Goal

Browser game where aim hits farm simulated units of real-market assets, while a separate paper-trading terminal uses real stock charts and toy currencies. Aim and trading missions unlock weapons, upgrades, and new markets. No real money, no real ownership, no debt.

## Repo location

- `C:\Users\azi\Documents\prro_grams\vibes_aim`
- Working title: `vibes_aim` (final game name TBD, internal codename stays)

## Scope (MVP v0.1)

- Fork of `Pratilectron/valotrainer` (MIT) as the aim-engine base.
- One aim mode in UI: Gridshot. Code base keeps Flick for later.
- Two weapons: Sidearm (AAPL), Pulse Rifle (NVDA).
- Mini chart widget on the arena + full terminal on a separate tab.
- Real tickers: AAPL, NVDA, SPCX (real charts). Pre-IPO OPENAI, ANTHROPIC shown as "closed / awaiting market".
- Trading: market order, long, short, leverage up to 20x, liquidation preview, 24/7 with closed-market gate.
- 5–6 missions to unlock NVDA from AAPL.
- Guest mode (no login) + optional Gmail OAuth. Progress lives on server (Supabase) for logged-in users, localStorage for guests.
- Server-side verification of every hit. WebSocket real-time quotes via Finnhub (adapter isolated).
- Dark theme, English copy. No tutorial. No referral, no leaderboard, no season reset, no stop-loss.

## Out of scope (MVP v0.1)

- Mobile, PWA install, App Store.
- Real-money execution, broker integration, KYC, withdrawals.
- More than 3 real tickers in UI.
- 3D arenas beyond the valotrainer flat range.
- Custom logo / final name (placeholder `vibes_aim`).
- Achievements, referrals, leaderboard, season reset, stop-loss (UI placeholders only).

## Stage plan

Stages are small, each ends with evidence in `CHANGELOG.md` and (when relevant) a `MISTAKES.md` entry.

- Stage 0 — Repo skeleton + this 4-document log + skill. (DONE)
- Stage 1 — Clone valotrainer at pinned commit, strip brand markers, keep aim engine files. (DONE: code imported + tests green + static server 200. Brand pass deferred to Stage 2/4.)
- Stage 2 — Design system: `ui-ux-pro-max` query, `design-system/MASTER.md`, palette tokens (AAPL gray/silver, NVDA green neon), typography. (DONE: MASTER.md, host page DOM skeleton, brand override CSS, all 7 test suites green, smoke check passed.)
- Stage 3 — Server: Express + Supabase schema + market data adapter (Finnhub first) with provider-neutral interface.
- Stage 4 — Client state: player profile, balances, inventory, missions, unlocks, persistent localStorage + Supabase sync.
- Stage 5 — Aim integration: Gridshot mode wired, hit counter, weapon 1, hit → POST `/aim/hit` → server grants simulated AAPL.
- Stage 6 — Mini chart widget on the arena using TradingView Lightweight Charts.
- Stage 7 — Terminal tab: portfolio, buy/sell, long, short, leverage slider up to 20x, liquidation preview, P/L, closed-market gate.
- Stage 8 — Missions: 5–6 tasks to unlock NVDA. Pulse Rifle + Flick mode unlocked. NVDA chart wired.
- Stage 9 — Anti-cheat: hit rate limit, idempotency, sequence validation.
- Stage 10 — End-to-end visual check: open the running app, screenshot the arena + terminal, attach to CHANGELOG.

## Active stage

### Stage 11.11 — cross-platform visual-smoke launcher (DONE 2026-10-05)

**Verified evidence:** `python -m py_compile tests/visual_smoke.py` exited 0. With `VIBES_VISUAL_CHROME=""`, direct `python tests/visual_smoke.py` exited 0 with empty console/page/request/API/static-host error arrays. Fresh full `npm test` exited 0 / `ALL PASS`.

**Scope:** make the existing browser smoke portable from the Windows developer Chrome path to a Playwright-provided Chromium binary on CI or Linux, without weakening strict browser checks. Prevent local Python bytecode artifacts from appearing as untracked files.

**Acceptance criteria:**

- `VIBES_VISUAL_CHROME` optionally selects a browser executable.
- When the Windows Chrome path is unavailable, the smoke falls back to `p.chromium.launch()` so `playwright install chromium` works on Linux CI.
- Existing Windows local Chrome behavior remains the default path; zero browser/network/static-host errors stay enforced.
- Python `__pycache__`, `.pyc`, and `.pyo` files are ignored.

**Out of scope:** adding a GitHub Actions visual-smoke job (the current GitHub credential lacks the required `workflow` scope), native Finnhub WebSocket integration, and browser asset changes.

### Stage 11.10 — server-sent events for live market ticks (DONE 2026-10-05)

**Verified evidence:** `node tests/stream.test.mjs` (6 pure assertions) and `node tests/stream-wire.test.mjs` (real HTTP, 11 wire assertions) exit 0. Full `npm test` exits 0 / `ALL PASS` including strict visual smoke (no console / network / static-host 4xx-5xx).

**Scope:** add a provider-neutral SSE feed of latest ticks so the client can move off 1Hz HTTP requests when the browser supports `EventSource`. The polling fallback stays so older servers and static-only hosts keep working. When Finnhub is wired in later, only the provider's `subscribe()` method needs to be implemented; the server and tests do not change.

**Acceptance criteria:**

- `GET /market/stream/:symbol` writes `event: tick` SSE frames, sends `Content-Type: text/event-stream`, and sends a 15s heartbeat comment.
- Unknown symbol returns 400 JSON; pre-IPO symbols still stream with `price: null, status: 'pre_ipo'`.
- The client `openQuoteStream(ticker, onTick)` resolves the API origin via `api.baseUrl()` so cross-origin static hosts route SSE correctly; polling remains as a strict fallback.
- A ticker change closes and reopens the SSE stream; `unmount` stops it cleanly.
- `npm test` stays green including the strict visual smoke.

**Out of scope:** native Finnhub WebSocket integration, third-party SSE libs, sticky-session scaling notes.

### Stage 11.9 — server Docker image (DONE 2026-10-05)

**Verified evidence:** `node --check server/src/index.js` exited 0; local `PORT=4174 node server/src/index.js` answered `GET /health` with `200 {"ok":true,"ts":...}`. Full `npm test` exited 0. The Docker image itself is not built locally because Docker is not installed on this machine; CI users can verify with `docker build -t vibes_aim-server ./server` and `docker run --rm -p 3000:3000 vibes_aim-server`.

**Scope:** add a minimal production Docker image for the pure-Node server, plus a test image, and document both in the deploy guide. The server has no npm dependencies, so the image only copies source and runs `node src/index.js`.

**Acceptance criteria:**

- `server/Dockerfile` builds a single-stage `node:20-alpine` image with non-root `node` user, `/health` health check, port `3000` exposed, and no `npm install` step.
- `server/Dockerfile.test` builds the same base and runs `npm test`.
- `.dockerignore` excludes `node_modules`, `.git`, screenshots, Python cache, and `.env*`.
- `deploy/README.md` documents both images and the exact `docker run` commands.
- `node --check server/src/index.js` and `npm test` remain green.

**Out of scope:** real Finnhub token, multi-stage builds, distroless variants, Compose stack, registry publishing.

**Verified evidence:** `node tests/client-bridge.test.mjs`, strict `node tests/visual.test.mjs`, and fresh full `npm test` exited 0. The rendered HUD states `ACTIVE AAPL` with `aria-label="Active farm ticker: AAPL"`; browser smoke found zero pre-IPO chart/terminal controls and no browser/network errors.

**Scope:** document and regress-prove that pre-IPO tickers are not selectable in the chart/terminal UI; make the existing aim HUD's current ticker explicit and accessible.

**Acceptance criteria:**

- Browser smoke proves `OPENAI` and `ANTHROPIC` have no selectable ticker control at boot.
- HUD visibly and accessibly names the active AAPL farm ticker, and its label follows a ticker switch.
- Existing unlock behavior (AAPL shown; NVDA hidden until unlocked) and browser-clean checks remain green.

**Out of scope:** adding pre-IPO instruments, changing unlock policy, redesigning chart/terminal layouts, or provider changes.

### Stage 11.7 — README truth pass (DONE 2026-10-05)

**Verified evidence:** README stale-claim scan found zero removed mission shortcuts/1000-Stable references; checked screenshots and migration paths exist; fresh `npm test` exited 0, including strict visual smoke.

**Scope:** align public README claims with shipped game behavior: real mission requirements, 200 Stable start, server-side progression and margin rules, live-market session gate, slow-test command, and Supabase migration sequence.

**Acceptance criteria:**

- No README claim describes a removed 1-second/any-profit mission shortcut or a 1000 Stable default.
- Trading, unlock, persistence, market-session, and test descriptions match the current code and tests.
- README links/assets remain valid and the unchanged code test suite stays green.

**Out of scope:** new gameplay, market-provider credentials, deployment configuration, and UI redesign.

### Stage 11.6 — visual smoke clean-console investigation (DONE 2026-10-05)

**Verified evidence:** direct `python tests/visual_smoke.py`, strict `node tests/visual.test.mjs`, and full `npm test` all exited 0 with empty console/page/request/API/static-host error arrays.

**Scope:** locate and remove the exact source of the two Chrome 404 console warnings in the real visual smoke. Do not suppress generic errors or whitelist an unknown URL.

**Acceptance criteria:**

- The smoke evidence identifies the failed script/resource URL and originating page location.
- The root cause is corrected at its source, or an external browser artifact is proven with an isolated reproduction.
- Direct `python tests/visual_smoke.py` and `npm test` both report zero unexpected console errors, page errors, request failures, and 4xx/5xx app responses.

**Out of scope:** UI redesign and unrelated market functionality.

### Stage 11.5 — live-market order gate (DONE 2026-10-05)

**Verified evidence:** `node tests/finnhub.test.mjs`, `node tests/server.test.mjs`, `node tests/missions.test.mjs`, and the full `npm test` all exited 0.

**Scope:** prevent new paper positions from opening when a live US-equity market provider reports a closed session. The offline `stub` stays explicitly tradeable for local play and deterministic tests. Preview and closing an existing position remain available.

**Acceptance criteria:**

- Market providers expose a normalized trading-session result (`isOpen`, provider/session context).
- `/portfolio/order` returns a clear `409 market_closed` before it debits Stable or creates a trade when the provider says the market is closed.
- An open session permits orders; stub keeps allowing orders; `/portfolio/close` remains callable regardless of open/closed status.
- Focused provider/server tests plus the full `npm test` chain pass.

**Out of scope:** chart UI message, holiday-calendar UX, WebSocket quotes, Pre-IPO UI hiding, and README wording (separate stages).

### Stage 11.3–11.4 — market unlock enforcement and margin consistency (DONE 2026-10-05)

**Verified evidence:** `node tests/server.test.mjs`, `node tests/terminal.test.mjs`, and `npm test` all exited 0. `npm run test:slow` held a real position for 60020 ms and exited 0. Visual smoke passed three consecutive isolated runs after its server-concurrency repair.

**Scope:** enforce the AAPL → NVDA progression gate for minting/trading and make client preview, server order debit, and server close refund use one leverage formula: `margin = position notional / leverage`.

**Acceptance criteria:**

- `POST /aim/hit`, `/portfolio/preview`, and `/portfolio/order` return `400 ticker_locked` for locked market tickers, while AAPL remains available to a fresh player.
- Pre-IPO ticker orders retain the explicit `400 no_price` result rather than being mislabeled as a lock.
- Client order preview, server preview, server debit, and server close refund agree on margin.
- Targeted server and terminal tests plus the full `npm test` chain pass without DEBUG output.

**Out of scope for this stage:** market-hours gate, chart/UI polish, active-ticker hint, README changes, CI changes.

Stage 4 — Client state + persistence. Sub-steps (DONE 2026-10-04, 10/10 test suites green, 4 documents updated, committed):

- 4.1 `client/src/store.js` — DONE.
- 4.2 `client/src/persist.js` — DONE.
- 4.3 `client/src/api.js` — DONE.
- 4.4 `server/src/db/supabase.js` (store-compatible) — DONE, not exercised by tests until Stage 5.
- 4.5 `tests/dom.test.mjs` — DONE (59 id lookups, all present).
- 4.6 Visual screenshot smoke — deferred; no headless browser in env.
- 4.7 `tests/finnhub.test.mjs` — DONE (7 mocked-fetch assertions).

Stage 5 — Aim bridge. Sub-steps (DONE 2026-10-04, 12/12 test suites green, 4 documents updated, committed):

- 5.1 1-line patch in `markHit` + `client/js/aim-bridge.js` — DONE.
- 5.2 Boot screen with `/health` probe and Skip button — DONE.
- 5.3 `tests/client-bridge.test.mjs` — DONE (8 assertions).
- 5.4 `tests/supabase.test.mjs` with in-process PostgREST emulator — DONE (9 assertions). Bug fix: `rpc()` now serialises body to JSON before `fetch`.
- 5.5 Visual screenshot smoke — DEFERRED (no headless browser).

Stage 6 — Mini chart widget. Sub-steps (DONE 2026-10-04, 13/13 test suites green, 4 documents updated, committed):

- 6.1 `client/js/chart.js` with TV Lightweight Charts via importmap — DONE.
- 6.2 Polling `/quote` every 1s + stale label after 5s — DONE.
- 6.3 AAPL/NVDA ticker switcher, 1D/5D range switcher, pre-IPO handling — DONE.
- 6.4 `tests/chart.test.mjs` — DONE (12 assertions, 7 pure + 5 wire).
- 6.5 Bug fix: chart.js + aim-bridge.js had wrong relative import paths (`./src/api.js` instead of `../src/api.js`). Caught by Node's strict ESM resolver.

Stage 7 — Trading terminal. Sub-steps (DONE 2026-10-04, 14/14 test suites green, 4 documents updated, committed):

- 7.1 `client/src/terminal-core.js` — pure helpers (clamp, round, computeOrder, computeClosePreview, computeLiquidationPrice, portfolioValue, formatPnl, sortTradesNewest) — DONE.
- 7.2 `client/js/terminal.js` — thin UI over store + terminal-core — DONE.
- 7.3 Terminal panel in `index.html` + CSS — DONE.
- 7.4 `tests/terminal.test.mjs` — 23 assertions (15 pure + 8 wire) — DONE.
- 7.5 Bug fixes: `formatPnl` now always renders two decimals with explicit sign; `round8` test values adjusted to avoid floating-point boundary.

Stage 8 — Missions + AAPL → NVDA unlock chain. Sub-steps (DONE 2026-10-04, 15/15 test suites green, 4 documents updated, committed):

- 8.1 `client/src/missions-core.js` — pure helpers (missionProgress, allMissionsClaimed, describeUnlocks, formatProgress) — DONE.
- 8.2 `client/js/missions.js` — UI panel over store, claim buttons, unlock card with auto-switch to NVDA — DONE.
- 8.3 Missions panel in `index.html` + CSS with unlock animation — DONE.
- 8.4 Auto-switch active ticker to NVDA on unlock (via aim-bridge.setActiveTicker) — DONE.
- 8.5 `tests/missions.test.mjs` — 21 assertions (12 pure + 9 wire) — DONE.
- 8.6 Bug fixes: `first_trade`/`hold_60s` test boundary values, AIM_HIT_RPS env must be set before import, stub provider per-5s tick drift for `first_profit` to be achievable in tests.

Stage 9 — End-to-end visual review + unlocked tickers list. Sub-steps (DONE 2026-10-04, 16/16 test suites green, 4 documents updated, committed):

- 9.1 `tests/visual_smoke.py` (Python Playwright) + `tests/visual.test.mjs` (Node runner) — DONE. 4 PNG screenshots in `docs/screenshots/`, 13 assertions.
- 9.2 Auto-show bug in `mountMissions` / `mountTerminal` — FIXED. Panels now stay hidden until the user opens them.
- 9.3 `.vm-unlock[hidden]` CSS specificity bug — FIXED. Unlock card hidden until all 6 are claimed.
- 9.4 `client/src/bootstrap.js` warms the store before any UI mounts — DONE.
- 9.5 `chart.js` unlocked tickers list — DONE. NVDA button only visible after the AAPL chain unlocks it.
- 9.6 Documents — DONE.

Stage 10 — Polish, release tag. Sub-steps (DONE 2026-10-04, 16/16 test suites green, 4 documents updated, committed, tagged `mvp-v0.1`):

- 10.1 README.md — DONE.
- 10.2 LICENSE (MIT) + .nvmrc + .gitattributes — DONE.
- 10.3 `client/vercel.json` + `Procfile` + `deploy/README.md` — DONE.
- 10.4 Tag `mvp-v0.1` — DONE.

`mvp-v0.1` is the first release. The repo is a complete, testable, deployable single-player aim-trading game. No real money, no broker, no debt. 16 test suites, 16/16 green. 4 PNG screenshots in `docs/screenshots/`.

- 4.1 `client/src/store.js` — mirror of server state (player, balances, trades, unlocks, missions). Pulls via `fetch` from `/portfolio` and `/missions`. Single source of truth on the client. No third-party state lib.
- 4.2 `client/src/persist.js` — localStorage adapter for guest mode. Clears on logout. Logs the merge strategy in code: local first, then server on login.
- 4.3 `client/src/api.js` — fetch wrapper. Adds `X-Player-Id` and `X-Session-Id` headers. Generates `sessionId` once per page load. Retries idempotent GETs once; never retries POSTs.
- 4.4 `server/src/db/supabase.js` — implementation of the same store interface using `@supabase/supabase-js`. Used when `SUPABASE_URL` and `SUPABASE_SERVICE_KEY` are set. Otherwise the in-memory store is used. Tested with a stub `@supabase/supabase-js` returning canned data.
- 4.5 `tests/dom.test.mjs` — scans `client/js/game.js` for `$('id')` calls and asserts every `id` exists in `client/index.html`. Closes the silent-black-screen gap.
- 4.6 Visual screenshot smoke test. Boot the client on a local port, capture one PNG, attach path to CHANGELOG. (For Windows-native capture this needs a small helper; deferred to first stage that actually changes visible chrome — Stage 5/6.)
- 4.7 Mocked-fetch test for the Finnhub adapter. Stub `globalThis.fetch`, verify 503 when token missing, and verify the expected quote/candle shape for a fake OK response.

## Milestones

- M1 (after Stage 2): visual direction frozen, brand colors locked, fonts locked.
- M2 (after Stage 4): client and server communicate, persistence works.
- M3 (after Stage 6): aim → AAPL farming visible on the arena with a live chart.
- M4 (after Stage 7): first full paper-trade round trip works (buy → price move → sell).
- M5 (after Stage 8): unlock chain AAPL → NVDA reachable in ~40 minutes of play.
- M6 (after Stage 10): no unverified claims in CHANGELOG, every stage has evidence.
