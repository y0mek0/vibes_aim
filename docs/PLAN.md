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
- Stage 2 — Design system: `ui-ux-pro-max` query, `design-system/MASTER.md`, palette tokens (AAPL gray/silver, NVDA green neon), typography.
- Stage 3 — Server: Express + Supabase schema + market data adapter (Finnhub first) with provider-neutral interface.
- Stage 4 — Client state: player profile, balances, inventory, missions, unlocks, persistent localStorage + Supabase sync.
- Stage 5 — Aim integration: Gridshot mode wired, hit counter, weapon 1, hit → POST `/aim/hit` → server grants simulated AAPL.
- Stage 6 — Mini chart widget on the arena using TradingView Lightweight Charts.
- Stage 7 — Terminal tab: portfolio, buy/sell, long, short, leverage slider up to 20x, liquidation preview, P/L, closed-market gate.
- Stage 8 — Missions: 5–6 tasks to unlock NVDA. Pulse Rifle + Flick mode unlocked. NVDA chart wired.
- Stage 9 — Anti-cheat: hit rate limit, idempotency, sequence validation.
- Stage 10 — End-to-end visual check: open the running app, screenshot the arena + terminal, attach to CHANGELOG.

## Active stage

Stage 2 — Design system: tokens, palette, typography, real `client/css/style.css`.

## Milestones

- M1 (after Stage 2): visual direction frozen, brand colors locked, fonts locked.
- M2 (after Stage 4): client and server communicate, persistence works.
- M3 (after Stage 6): aim → AAPL farming visible on the arena with a live chart.
- M4 (after Stage 7): first full paper-trade round trip works (buy → price move → sell).
- M5 (after Stage 8): unlock chain AAPL → NVDA reachable in ~40 minutes of play.
- M6 (after Stage 10): no unverified claims in CHANGELOG, every stage has evidence.
