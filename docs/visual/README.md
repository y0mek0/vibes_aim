# Visual smoke (Stage 9)

The visual smoke is what proves the page paints correctly. It is intentionally separate from the engine unit tests because it needs a real browser, a real server, and a real socket. In environments without these, the test is **skipped** so `npm test` stays green.

## What it produces

- `docs/screenshots/01-initial-menu.png` — boot state, engine menu, chart panel, aim-bridge HUD chip, terminal/missions open tabs.
- `docs/screenshots/02-terminal.png` — trading terminal with Stable = 1000.00 and an order ticket.
- `docs/screenshots/03-missions.png` — missions table with 6 rows, 0/6 claimed, unlock card hidden.
- `docs/screenshots/04-chart-nvda.png` — chart with AAPL ticker and NVDA button hidden (unlocks is empty at boot).

## Requirements

- Python 3.10+
- `playwright` (Python): `pip install playwright`
- Chromium: `playwright install chromium` (or point to a system Chrome via `executable_path` in `tests/visual_smoke.py`).
- The `vibes_aim` server (`server/src/index.js`) is **booted and torn down** by the smoke; no manual server needed.

## How to run

From the repo root:

```bash
# Just the visual smoke
python tests/visual_smoke.py

# As part of the full test chain
npm test
```

The Node-side runner `tests/visual.test.mjs` is what `npm test` invokes. It probes for `python -c 'import playwright'`; if Playwright is missing, the test is skipped with a single line of guidance.

## How to extend

Add new scenarios to `tests/visual_smoke.py`:

1. After the current steps, drive the desired action via `page.click(...)` or `page.evaluate(...)`.
2. Take a new screenshot into `docs/screenshots/`.
3. Append the new file to `summary["screenshots"]` and any new DOM values to `summary["dom"]`.
4. In `tests/visual.test.mjs`, add a corresponding `assert.equal(...)` and `ok(...)` line.

The smoke already covers boot, terminal open, missions open, and chart ticker switch. Adding a "post-unlock NVDA" scenario is the natural next step: drive `/aim/hit` 10 times via the server's API to claim `first_10_hits`, then click the now-visible `Switch to NVDA` button, then screenshot.

## Why the helper is Python

Node has no built-in Playwright; the `playwright` npm package would require a `npm install` which we deliberately avoid to keep the project dependency-free. Python Playwright is available in the `hermes-agent` venv on this machine. The Node-side runner keeps the test contract in JavaScript so the rest of the suite stays in one language.
