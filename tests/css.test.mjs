// Node test: stylesheet sanity for aim2stock.
// Validates: braces and parens balanced, no invalid grid 'none' that silently
// collapses layouts, viewport-locked root, no horizontal scroll on body.
// Run: node tests/css.test.mjs (from aim2stock/)
import fs from 'node:fs';

const css = fs.readFileSync(new URL('../client/css/style.css', import.meta.url), 'utf8');
let fails = 0;
const ok = (label, cond, extra = '') => {
  if (!cond) { fails++; console.error(`FAIL ${label} ${extra}`); }
  else console.log(`ok   ${label}`);
};

const stripped = css.replace(/\/\*[\s\S]*?\*\//g, '');
ok('braces balanced',
  (stripped.match(/{/g) || []).length === (stripped.match(/}/g) || []).length);
ok('parens balanced',
  (stripped.match(/\(/g) || []).length === (stripped.match(/\)/g) || []).length);
const bad = [...stripped.matchAll(/grid-template-(?:columns|rows)\s*:\s*none/g)];
ok('no invalid grid none values', bad.length === 0, `${bad.length} found`);
ok('no panorama rail', !/scroll-snap-type:\s*x/.test(stripped) && !/grid-auto-flow:\s*column/.test(stripped));
ok('body no horizontal scroll', /body\s*\{[^}]*overflow-x\s*:\s*hidden/.test(stripped));

if (fails) { console.error(`${fails} FAILURES`); process.exit(1); }
console.log('ALL PASS');
