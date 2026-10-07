// Import/export consistency gate: every named import must resolve to a real
// export in the target module. Catches "X is not defined" crashes at test time.
// Run: node tests/imports.test.mjs (from aim2stock/)
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const root = new URL('..', import.meta.url);
const files = ['client/js/main.js', 'client/js/game.js', 'client/js/build.js', 'client/js/ui/combo.js', 'client/js/core/stats.js', 'client/js/core/ballistics.js',
  'client/js/core/gunplay.js', 'client/js/core/stalker.js', 'client/js/core/crosshair.js', 'client/js/data/themes.js',
  'client/js/fx/audio.js', 'client/js/three/world.js', 'client/js/three/targets.js', 'client/js/three/effects.js',
  'client/js/data/guns.js', 'client/js/data/mechanics.js'];

let fails = 0;
const fail = m => { fails++; console.error('FAIL ' + m); };

// 1. all files parse (node --check = real parser, no execution)
for (const f of files) {
  try {
    execFileSync(process.execPath, ['--check', fileURLToPath(new URL(f, root))], { stdio: 'pipe' });
    console.log('ok   parses: ' + f);
  } catch (e) { fail('parse ' + f); }
}

// 2. every `import {a, b} from './x.js'` name must be exported by x.js
const exportNames = src => {
  const names = new Set();
  for (const m of src.matchAll(/export\s+(?:function|const|let|class)\s+([A-Za-z_$][\w$]*)/g)) names.add(m[1]);
  for (const m of src.matchAll(/export\s*\{([^}]+)\}/g))
    m[1].split(',').forEach(p => { const n = p.trim().split(/\s+as\s+/).pop().trim(); if (n) names.add(n); });
  if (/export\s*\*\s*from/.test(src)) names.add('*');
  return names;
};
for (const f of files) {
  const src = fs.readFileSync(new URL(f, root), 'utf8');
  const dir = path.posix.dirname('/' + f);
  for (const m of src.matchAll(/import\s*\{([^}]+)\}\s*from\s*['"]([^'"]+)['"]/g)) {
    let target = m[2];
    if (target === 'three') continue;
    const resolved = path.posix.normalize(path.posix.join(dir, target));
    let tsrc;
    try { tsrc = fs.readFileSync(new URL('.' + resolved, root), 'utf8'); }
    catch (e) { fail(`${f} imports missing file ${target}`); continue; }
    const ex = exportNames(tsrc);
    if (ex.has('*')) continue;
    m[1].split(',').forEach(p => {
      const n = p.trim().split(/\s+as\s+/).pop().trim();
      if (n && !ex.has(n)) fail(`${f} imports '${n}' from ${target} — not exported`);
      else if (n) console.log(`ok   ${f} <- '${n}' from ${target}`);
    });
  }
}

// 3. data modules must export the arsenal API the game needs
const guns = await import(new URL('../client/js/data/guns.js', import.meta.url));
for (const n of ['GUNS', 'gunById', 'GUN_CLASSES'])
  if (guns[n] === undefined) fail('guns.js missing export ' + n);
  else console.log('ok   guns.js exports ' + n);

if (fails) { console.error(fails + ' FAILURES'); process.exit(1); }
console.log('ALL PASS');
