// Node smoke test: node tests/ballistics.test.mjs (run from valotrainer/)
import { GUNS, gunById } from '../client/js/data/guns.js';
import { damageAtRange, shotsToKill, ttk, spreadDeg, effectiveRpm, zoomOf, lethalOnHit } from '../client/js/core/ballistics.js';

let fails = 0;
const eq = (label, got, want) => {
  const ok = Object.is(got, want);
  if (!ok) { fails++; console.error(`FAIL ${label}: got ${got}, want ${want}`); }
  else console.log(`ok   ${label} = ${got}`);
};

// --- data integrity: every gun has full schema, bands ascending, H>=B>=L ---
for (const g of GUNS) {
  for (const f of ['id','name','cls','mag','reload','equip','run','rpm','bands','pen','spread','recoil'])
    if (g[f] === undefined) { fails++; console.error(`FAIL schema ${g.id} missing ${f}`); }
  let prev = -1;
  for (const [r, h, b, l] of g.bands) {
    if (!(r > prev)) { fails++; console.error(`FAIL bands order ${g.id}`); }
    if (!(h >= b && b >= l)) { fails++; console.error(`FAIL H>=B>=L ${g.id} @${r}m`); }
    prev = r;
  }
}
console.log(`ok   schema+bands for ${GUNS.length} guns`);

// --- damage model spot checks (researched values) ---
eq('vandal head 40m', damageAtRange(gunById('vandal'), 40, 'head'), 160);
eq('vandal body 40m', damageAtRange(gunById('vandal'), 40, 'body'), 40);
eq('phantom head 10m', damageAtRange(gunById('phantom'), 10, 'head'), 156);
eq('phantom head 25m', damageAtRange(gunById('phantom'), 25, 'head'), 140);
eq('phantom body 25m', damageAtRange(gunById('phantom'), 25, 'body'), 35);
eq('sheriff head 20m', damageAtRange(gunById('sheriff'), 20, 'head'), 159);
eq('sheriff head 40m', damageAtRange(gunById('sheriff'), 40, 'head'), 145);
eq('bucky pellet 5m', damageAtRange(gunById('bucky'), 5, 'body'), 20);
eq('bucky pellet 10m', damageAtRange(gunById('bucky'), 10, 'body'), 13);
eq('operator body', damageAtRange(gunById('operator'), 45, 'body'), 150);
eq('marshal leg', damageAtRange(gunById('marshal'), 30, 'leg'), 85);
eq('guardian head', damageAtRange(gunById('guardian'), 49, 'head'), 195);
eq('ghost head 35m', damageAtRange(gunById('ghost'), 35, 'head'), 87);
eq('classic body 35m', damageAtRange(gunById('classic'), 35, 'body'), 22);
eq('outlaw body', damageAtRange(gunById('outlaw'), 25, 'body'), 140);
eq('shorty pellet 5m', damageAtRange(gunById('shorty'), 5, 'body'), 12);
eq('odin body 35m', damageAtRange(gunById('odin'), 35, 'body'), 31);

// --- STK / TTK ---
eq('vandal head STK heavy', shotsToKill(gunById('vandal'), 40, 'head', 150), 1);
eq('vandal body STK heavy', shotsToKill(gunById('vandal'), 40, 'body', 150), 4);
eq('phantom head 25m STK heavy', shotsToKill(gunById('phantom'), 25, 'head', 150), 2);
eq('phantom body 10m STK heavy', shotsToKill(gunById('phantom'), 10, 'body', 150), 4);
eq('judge 5m body STK heavy', shotsToKill(gunById('judge'), 5, 'body', 150), 1); // 12x17=204
eq('judge 12m body STK heavy', shotsToKill(gunById('judge'), 12, 'body', 150), 2); // 12x10=120
eq('operator body STK heavy', shotsToKill(gunById('operator'), 40, 'body', 150), 1);
eq('marshal body STK heavy', shotsToKill(gunById('marshal'), 40, 'body', 150), 2);
eq('vandal body TTK heavy', ttk(gunById('vandal'), 10, 'body', 150).toFixed(3), (3 / 9.75).toFixed(3));

// --- spread / rpm / zoom ---
eq('phantom hip spread', spreadDeg(gunById('phantom'), {}), 0.2);
eq('phantom ads spread', spreadDeg(gunById('phantom'), { ads: true }), 0.11);
eq('phantom run spread', spreadDeg(gunById('phantom'), { move: 'run' }), 0.9); // capped at max
eq('marshal scoped spread', spreadDeg(gunById('marshal'), { scoped: true }), 0);
eq('operator hip spread', spreadDeg(gunById('operator'), {}), 5.0);
eq('vandal ads rpm', effectiveRpm(gunById('vandal'), { ads: true }), 8.32);
eq('ares spooled rpm', effectiveRpm(gunById('ares'), { spool: 1 }), 13);
eq('ares unspooled rpm', effectiveRpm(gunById('ares'), { spool: 0 }), 10);
eq('bulldog ads burst rpm', effectiveRpm(gunById('bulldog'), { ads: true }), 3 * 2.105);
eq('operator scope zoom', zoomOf(gunById('operator'), { ads: true, scopeIdx: 1 }), 5);
eq('vandal ads zoom', zoomOf(gunById('vandal'), { ads: true }), 1.25);
eq('sheriff zoom', zoomOf(gunById('sheriff'), { ads: true }), 1);
eq('gridshot one-shot', lethalOnHit('gridshot'), true);
eq('flick one-shot', lethalOnHit('flick'), true);
eq('bots full damage', lethalOnHit('bots'), false);
eq('tracking full damage', lethalOnHit('tracking'), false);

if (fails) { console.error(`${fails} FAILURES`); process.exit(1); }
console.log('ALL PASS');
