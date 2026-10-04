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

Stage 10 next: README, LICENSE, .nvmrc, deploy notes, release tag `mvp-v0.1`.

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
