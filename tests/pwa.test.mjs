// Node test: PWA shell integrity — manifest parses, icons exist, SW precache
// list matches files on disk (catches stale cache entries on deploy).
// Run: node tests/pwa.test.mjs (from valotrainer/)
import fs from 'node:fs';
import path from 'node:path';

const root = new URL('..', import.meta.url);
const at = p => new URL(p, root);
let fails = 0;
const ok = (label, cond, extra = '') => {
  if (!cond) { fails++; console.error(`FAIL ${label} ${extra}`); }
  else console.log(`ok   ${label}`);
};

// manifest
let manifest;
try {
  manifest = JSON.parse(fs.readFileSync(at('manifest.webmanifest'), 'utf8'));
  ok('manifest parses', true);
} catch (e) { ok('manifest parses', false, e.message); }
if (manifest) {
  eq('manifest name', !!manifest.name, true);
  eq('standalone', manifest.display, 'standalone');
  for (const ic of manifest.icons || []) {
    ok(`icon ${ic.src}`, fs.existsSync(at(ic.src)));
  }
}
function eq(l, a, b) { ok(l, Object.is(a, b), `got ${a}, want ${b}`); }

// service worker precache
const sw = fs.readFileSync(at('sw.js'), 'utf8');
const m = sw.match(/const ASSETS = \[([\s\S]*?)\];/);
ok('sw assets list found', !!m);
if (m) {
  const files = [...m[1].matchAll(/'([^']+)'/g)].map(x => x[1]);
  ok('sw precache non-empty', files.length > 10, `${files.length} entries`);
  for (const f of files) {
    const target = f === './' ? '' : f;
    ok(`cached: ${f}`, fs.existsSync(at(target)));
  }
  ok('sw versioned cache', /const CACHE = 'valotrainer-v\d+'/.test(sw));
}

if (fails) { console.error(`${fails} FAILURES`); process.exit(1); }
console.log('ALL PASS');
