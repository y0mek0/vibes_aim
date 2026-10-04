// Node test: scenery theme table integrity.
// Run: node tests/themes.test.mjs (from valotrainer/)
import { THEMES, themeById, validateTheme } from '../client/js/data/themes.js';

let fails = 0;
const ok = (label, cond, extra = '') => {
  if (!cond) { fails++; console.error(`FAIL ${label} ${extra}`); }
  else console.log(`ok   ${label}`);
};

ok('nine themes', THEMES.length === 9, `got ${THEMES.length}`);
ok('unique ids', new Set(THEMES.map(t => t.id)).size === THEMES.length);
for (const t of THEMES) {
  const err = validateTheme(t);
  ok(`valid ${t.id}`, err === null, err || '');
}
const SKIES = ['none', 'day', 'snow', 'dusk', 'garden', 'stars', 'pink'];
const EXTRA = ['pillars', 'racks', 'jumbo', 'sign', 'shafts', 'crates', 'mountains', 'sun', 'clouds',
  'cypress', 'woodcrates', 'stripes', 'snowpines', 'icespikes', 'frostcrates', 'lowsun', 'lights',
  'bamboo', 'lanterns', 'fireflies', 'stonecrates', 'earth', 'grayhills', 'techcrates', 'portholes',
  'rays', 'blossom', 'torii', 'petals'];
for (const t of THEMES) {
  ok(`${t.id} known sky`, SKIES.includes(t.sky));
  for (const e of t.extras) ok(`${t.id} known extra ${e}`, EXTRA.includes(e));
}
ok('fallback unknown id', themeById('nope').id === 'protocol');
ok('indoor mix', THEMES.some(t => t.indoor) && THEMES.some(t => !t.indoor));

if (fails) { console.error(`${fails} FAILURES`); process.exit(1); }
console.log('ALL PASS');
