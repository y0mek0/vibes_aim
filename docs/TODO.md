# TODO — vibes_aim (working title: MARKET//AIM)

> Active backlog. One line per item, with stage number and acceptance criterion. Move to CHANGELOG only when actually done and verified.

## Stage 1 — Clone valotrainer and strip brand markers

- [x] Pin the valotrainer commit we will base on, record SHA in CHANGELOG. → `ded498f5eb54867bd3d55648774984f6e3a90004`
- [x] Copy only the engine files we need → under `client/js/{core,data,three,ui,fx}` + main/game/build
- [ ] Remove or replace brand markers (mentions, links, original screenshots) without breaking the aim loop. → deferred to Stage 2 (CSS) and Stage 4 (HTML menu/HUD).
- [x] Verify static server still serves the trimmed repo with no console errors. → all 19 paths return 200; `node --check` exit 0 for all 17 engine modules. Visual check deferred to Stage 10.
- [x] First commit on `main` with a clear message. → about to commit Stage 1.

## Stage 2 — Design system

- [x] Run `ui-ux-pro-max --design-system` for a trading-game aesthetic, persist to `design-system/MASTER.md`. → skipped script (not installed); used `ui-ux-pro-max` priority table + documented defaults directly per the skill's own fallback clause.
- [x] Lock AAPL palette (gray/silver), NVDA palette (green neon), accent tokens, typography (Geist Mono for numbers, Geist Sans for UI). → recorded in `design-system/MASTER.md` and applied via `:root` overrides in `client/css/style.css`.
- [x] Replace `client/css/style.css` with a real vibes_aim stylesheet; verify `tests/css.test.mjs` passes. → `npm test` exit 0; css suite `ALL PASS`.
- [x] Verify tokens are referenced by at least one CSS rule and one component, paste `grep` output in CHANGELOG. → `grep -RE "#[0-9a-fA-F]{6}" client/css/style.css | grep -v ":root"` returns 0 matches; recorded in CHANGELOG.

## Stage 3 — Server

- [ ] Express scaffold in `server/` with `npm test` and a healthcheck route.
- [ ] Provider-neutral market adapter interface; implement Finnhub adapter first behind env var.
- [ ] Supabase schema: `players` and `trades`. Migration script committed.
- [ ] Smoke test: `curl localhost:3000/health` returns 200; recorded in CHANGELOG.
- [ ] Confirm no API keys in client bundle via `grep -R <key> client/`; if any leak, record in MISTAKES.

## Stage 4 — Client state + persistence

- [ ] Player profile model (id, stable, balances per ticker, missions, unlocks).
- [ ] localStorage persistence for guest mode.
- [ ] Supabase sync for logged-in users; merge strategy documented in PLAN.
- [ ] **NEW (from Stage 2 MISTAKE):** `tests/dom.test.mjs` that scans `client/js/game.js` for `$('...')` calls and asserts each id exists in `client/index.html`. Prevents the silent-black-screen class of bugs.
- [ ] **NEW (from Stage 2 MISTAKE):** visual screenshot smoke check. Open `http://127.0.0.1:<port>/` and capture at least one PNG per stage that adds visible chrome. Saved to `docs/screenshots/`, referenced from CHANGELOG.

## Stage 5 — Aim integration

- [ ] Gridshot mode wired to the new shell.
- [ ] Each hit POSTs to `/aim/hit`; server grants a fractional AAPL unit.
- [ ] Server-side rate limit and idempotency test passes; record test output.

## Stage 6 — Mini chart widget

- [ ] TradingView Lightweight Charts in a corner panel on the arena.
- [ ] Live updates from the WebSocket adapter; stale label after N seconds without a tick.

## Stage 7 — Terminal

- [ ] Portfolio, buy/sell, long, short, leverage slider up to 20x.
- [ ] Liquidation preview shown before confirmation.
- [ ] Closed-market gate prevents trades outside market hours.

## Stage 8 — Missions + NVDA unlock

- [ ] 5–6 missions, expected ~40 minutes of play to unlock.
- [ ] Pulse Rifle and Flick mode unlocked together with NVDA.

## Stage 9 — Anti-cheat

- [ ] Hit rate limit, sequence validation, session-bound idempotency.
- [ ] Tests for the rate limit pass; recorded in CHANGELOG.

## Stage 10 — End-to-end visual check

- [ ] Open the running app, take screenshots of arena + terminal, attach to CHANGELOG.
- [ ] Confirm AAPL → NVDA unlock chain works in a manual run.
- [ ] Final commit, tag `mvp-v0.1`.
