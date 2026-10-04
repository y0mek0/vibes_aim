# MISTAKES — vibes_aim (working title: MARKET//AIM)

> Append-only. Honest record of what was tried, what actually happened, and what to do next time. Failures belong here, not in CHANGELOG.

## Stage 0 — Repo skeleton (2026-10-04)

- First attempt to install the `market-aim-dev-log` skill description in 129 chars was rejected by the skill loader. Corrected to a 60-char summary in the description, detail moved into the body, then accepted.
- Lesson: skill `description` is capped at 60 chars; long detail belongs in the body, not the description.

## Stage 0b — Repo relocation (2026-10-04)

- Started the skeleton at the wrong path (`C:\Users\azi\market-aim`) because I picked a default project root instead of asking. The user corrected the path on the next turn.
- Lesson: when the user has not specified a project root and the project will be revisited across sessions, ask before initializing. The earlier skeleton was small (4 markdown files) so the cost was minor; in a larger project this would have meant a re-clone and re-import.
- Mitigation: the new path is now the only source of truth; the old path is left empty and ignored.

## Stage 1 — Imports and test refit (2026-10-04)

- `tests/css.test.mjs` originally looked for valotrainer-specific class names (`.glitch`, `clip-path`, `halftone`, `--plate`, comic-shadow rules, masonry grid areas, mode child grid rows). All of these are valotrainer's visual language, not ours. Replaced the rules with our own sanity checks (balanced braces, balanced parens, no invalid grid `none`, no horizontal scroll, no panorama rail). The old rules are not "lost" — they simply don't apply to a non-fan-project.
- `tests/imports.test.mjs` referenced `js/...` paths; the engine now lives under `client/js/...`. Updated the file list and the dynamic import of `guns.js`.
- Four other tests (`ballistics`, `gunplay`, `crosshair`, `stalker`, `themes`) imported from `'../js/...`. Patched to `'../client/js/...`. None of their assertions were changed.
- `tests/pwa.test.mjs` is excluded from `npm test` because PWA is out of MVP scope. The file remains in the tree for future use; it will be re-enabled when a real `manifest.webmanifest` and `sw.js` exist in this repo.
- `tests/css.test.mjs` was set up in Stage 1 to validate the upcoming vibes_aim stylesheet. It was initially red against the valotrainer CSS. Stage 2 replaced `client/css/style.css` with our token-driven stylesheet; the test now passes (ALL PASS). Closed.
- `client/index.html` was first written with a custom mode selector, then rewritten as a bare canvas-only page. Reason: `game.js boot()` reads `mode` from a local variable inside its closure and does not accept an external selector. The minimal-invasion fix is to keep boot's own menu (it works, it's tested) and replace the surrounding chrome in Stage 4 once we have our own CSS and DOM. Cost: about 5 minutes lost; would have been caught earlier by reading `game.js` line 76 before writing `index.html`. Lesson: **read the engine entry point before writing the host page**; that 30-second read would have saved a write+rewrite cycle.

## Stage 2 — Host page needed more DOM than I thought (2026-10-04)

- I assumed in Stage 1 that `game.js boot()` would create its own DOM (menus, HUD, modals). It does not. It only calls `getElementById('menu')`, `getElementById('topbar')`, etc. on elements it expects to already exist. When I wrote the bare `index.html`, every `$('...')` in the engine would have returned `null` and crashed.
- Fix: in Stage 2 I rebuilt `client/index.html` with the **full** engine DOM skeleton (every id the engine queries), and replaced the visible brand text only (title, hero kicker, hero sub, road label, settings labels, deskblock copy). The CSS-driven visual chrome (`.btn`, `.hero`, `.board`, tiles) stays where the engine expects it.
- Lesson: the Stage 1 mistake cost only a follow-up rewrite in the same session, but if I had not caught it now, the page would have loaded with a silent black screen — tests would still be green because they don't exercise DOM. From now on, **any page or component that talks to the engine must verify the engine's expected DOM ids before declaring the work done**. Adding a small `tests/dom.test.mjs` that scans `client/js/game.js` for `\$\('[a-z-]+'\)` calls and asserts each id exists in `client/index.html` is the right discipline; added to TODO for Stage 4.
- Also in Stage 2: I deliberately did **not** delete `client/css/upstream.css` (the unmodified valotrainer CSS) because the engine's grid/panel rules depend on it. Our `client/css/style.css` overrides its `:root` variables so the engine paints in our palette. Deleting upstream.css would break the menu grid and the panel layout. This is documented in CHANGELOG so it is not mistaken for our work.
