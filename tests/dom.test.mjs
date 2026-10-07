// tests/dom.test.mjs — every id the engine queries via getElementById
// or via the `$('id')` shortcut must exist in the host page. This is the
// safety net against the "silent black screen" class of bug.
//
// Run: node tests/dom.test.mjs (from aim2stock/)

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = new URL('..', import.meta.url);
const enginePath = path.join(fileURLToPath(root), 'client/js/game.js');
const indexPath  = path.join(fileURLToPath(root), 'client/index.html');
const mainPath   = path.join(fileURLToPath(root), 'client/js/main.js');

let fails = 0;
const ok  = (label) => console.log(`ok   ${label}`);
const bad = (label, extra = '') => { fails++; console.error(`FAIL ${label} ${extra}`); };

const engine = fs.readFileSync(enginePath, 'utf8');
const index  = fs.readFileSync(indexPath, 'utf8');
const main   = fs.readFileSync(mainPath, 'utf8');

// We only want to catch actual element lookups: getElementById('x'),
// getElementById("x"), $('x'), $("x"). createElement('div'),
// querySelector('span'), tagName === 'DIV', and classList.add('open')
// are not id lookups and must not match.
const LOOKUP_PATTERNS = [
  /getElementById\(\s*'([a-zA-Z][\w-]*)'\s*\)/g,
  /getElementById\(\s*"([a-zA-Z][\w-]*)"\s*\)/g,
  /\$\(\s*'([a-zA-Z][\w-]*)'\s*\)/g,
  /\$\(\s*"([a-zA-Z][\w-]*)"\s*\)/g,
];

const ids = new Set();
for (const re of LOOKUP_PATTERNS) {
  for (const m of engine.matchAll(re)) ids.add(m[1]);
}
ok(`scanned engine; found ${ids.size} id lookups`);

// Collect every id="..." declared in the host page, plus any id
// lookups done by client/js/main.js (it's allowed to set up its own
// root ids).
const present = new Set();
for (const m of index.matchAll(/\bid\s*=\s*"([a-zA-Z][\w-]*)"/g)) present.add(m[1]);
for (const m of main.matchAll(/\bgetElementById\(\s*'([a-zA-Z][\w-]*)'\s*\)/g)) present.add(m[1]);

// Some engine ids are optional. The engine guards with `if (el) ...`
// or `?.addEventListener`. We still surface them, but they don't fail.
const OPTIONAL = new Set([
  'pwa-install', // engine checks `installBtn()` returns null first
]);

let missing = 0;
for (const id of ids) {
  if (present.has(id)) continue;
  if (OPTIONAL.has(id)) { ok(`optional id not present: ${id} (ok)`); continue; }
  bad(`engine queries id="${id}" but client/index.html does not define it`);
  missing++;
}

if (missing === 0) {
  console.log('ALL PASS');
} else {
  console.error(`${missing} FAILURES`);
  process.exit(1);
}
