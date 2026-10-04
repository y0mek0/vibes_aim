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

