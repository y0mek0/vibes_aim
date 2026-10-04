# TODO — vibes_aim (working title: MARKET//AIM)

> Active backlog. One line per item, with stage number and acceptance criterion. Move to CHANGELOG only when actually done and verified.

## Stage 1 — Clone valotrainer and strip brand markers

- [ ] Pin the valotrainer commit we will base on, record SHA in CHANGELOG.
- [ ] Copy only the engine files we need (`core/ballistics`, `core/gunplay`, `core/crosshair`, `core/stats`, `core/stalker`, `modes/gridshot`, `modes/flick`).
- [ ] Remove or replace brand markers (mentions, links, original screenshots) without breaking the aim loop.
- [ ] Verify static server still serves the trimmed repo with no console errors (paste exit code in CHANGELOG).
- [ ] First commit on `main` with a clear message.

## Stage 2 — Design system

- [ ] Run `ui-ux-pro-max --design-system` for a trading-game aesthetic, persist to `design-system/MASTER.md`.
- [ ] Lock AAPL palette (gray/silver), NVDA palette (green neon), accent tokens, typography (Geist Mono for numbers, Geist Sans for UI).
- [ ] Verify tokens are referenced by at least one CSS rule and one component, paste `grep` output in CHANGELOG.

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
