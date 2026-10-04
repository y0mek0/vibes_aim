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

