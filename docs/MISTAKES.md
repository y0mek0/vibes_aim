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
- `tests/css.test.mjs` still FAILS on the valotrainer CSS (no `overflow-x: hidden` rule). The test was set up for the **upcoming** vibes_aim stylesheet in Stage 2. To make the failure visible, it is kept in `npm test` and reported here. Mitigation: Stage 2 will replace `client/css/style.css` and the rule will pass; until then this is a known expected failure.
- `client/index.html` was first written with a custom mode selector, then rewritten as a bare canvas-only page. Reason: `game.js boot()` reads `mode` from a local variable inside its closure and does not accept an external selector. The minimal-invasion fix is to keep boot's own menu (it works, it's tested) and replace the surrounding chrome in Stage 4 once we have our own CSS and DOM. Cost: about 5 minutes lost; would have been caught earlier by reading `game.js` line 76 before writing `index.html`. Lesson: **read the engine entry point before writing the host page**; that 30-second read would have saved a write+rewrite cycle.
