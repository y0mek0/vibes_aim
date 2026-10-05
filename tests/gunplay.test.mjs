// Node test: firing cadence, burst timing, movement physics.
// Run: node tests/gunplay.test.mjs (from valotrainer/)
import { gunById } from '../client/js/data/guns.js';
import { effectiveRpm } from '../client/js/core/ballistics.js';
import { deadzone, stanceSpeed, moveForSpeed, frictionSpeed, timeToDeadzone,
  jumpAirTime, minGap, burstTiming, bloomDecay, shotReady,
  slotForClass, cycleSlot, spawnDist, SPAWN_BANDS, orbScale, ORB_SIZES,
  spawnIntro, easeOutBack } from '../client/js/core/gunplay.js';

let fails = 0;
const eq = (label, got, want) => {
  const ok = Object.is(got, want);
  if (!ok) { fails++; console.error(`FAIL ${label}: got ${got}, want ${want}`); }
  else console.log(`ok   ${label} = ${got}`);
};
const near = (label, got, want, tol) => {
  const ok = Math.abs(got - want) <= tol;
  if (!ok) { fails++; console.error(`FAIL ${label}: got ${got}, want ~${want}`); }
  else console.log(`ok   ${label} = ${got.toFixed(4)}`);
};
const vandal = gunById('vandal');

// --- rate caps: semi guns CANNOT exceed their rpm (the "too fast" bug) ---
eq('sheriff min gap', minGap(gunById('sheriff'), {}), 0.25);
near('marshal min gap', minGap(gunById('marshal'), {}), 1 / 1.5, 1e-9);
near('vandal interval', minGap(vandal, {}), 1 / 9.75, 1e-9);
near('vandal ads interval', minGap(vandal, { ads: true }), 1 / 8.32, 1e-9);
near('stinger sustained ads', effectiveRpm(gunById('stinger'), { ads: true }), 4 * 2.118, 1e-9);
near('bulldog sustained ads', effectiveRpm(gunById('bulldog'), { ads: true }), 3 * 2.105, 1e-6);
eq('classic alt rate', gunById('classic').alt.rpm, 2.22);
eq('classic alt pellets', gunById('classic').alt.pellets, 3);

// --- burst timing: fast pops, slow cooldown ---
{
  const b = burstTiming(gunById('bulldog').alt);
  near('bulldog intra gap', b.intraGap, 1 / 13.333, 1e-6);
  near('bulldog inter gap', b.interGap, 1 / 2.105, 1e-6);
  const s = burstTiming(gunById('stinger').alt);
  near('stinger intra gap', s.intraGap, 1 / 18, 1e-9);
  near('stinger inter gap', s.interGap, 1 / 2.118, 1e-6);
}

// --- movement: deadzone, walk, crouch, friction vs Riot's 0.104 s ---
near('deadzone vandal', deadzone(vandal), 0.275 * 5.4, 1e-9);
near('walk speed vandal', stanceSpeed(vandal, 'walk'), 0.61 * 5.4, 1e-9);
eq('standstill category', moveForSpeed(0.5, vandal, false), 'still');
eq('walk category', moveForSpeed(2.5, vandal, false), 'walk');
eq('run category', moveForSpeed(5.0, vandal, false), 'run');
eq('air category', moveForSpeed(0, vandal, true), 'air');
{
  const v = frictionSpeed(5.4, 0.104);
  console.log(`info  speed after 0.104 s release = ${v.toFixed(3)} (deadzone 1.485)`);
  if (v >= 1.485) { fails++; console.error('FAIL friction: still above deadzone at Riot 0.104 s'); }
  else console.log('ok   friction beats deadzone by 0.104 s');
  near('full stop time', (() => { let v = 5.4, t = 0; while (v > 0 && t < 1) { v = frictionSpeed(v, 0.004); t += 0.004; } return t; })(), 0.13, 0.03);
  near('timeToDeadzone', timeToDeadzone(5.4, vandal), 0.10, 0.02);
}
near('jump air time', jumpAirTime(), 2 * 7.098 / 21, 1e-9);

// --- bloom recovery ---
near('bloom 1 tau', bloomDecay(1, 0.4, 0.4 / 3), Math.exp(-1), 1e-9);
eq('bloom zero stays', bloomDecay(0, 0.4, 1), 0);

// --- THE firing gate: clocks are ms, rps is per-second. A mixup here once
// made every gun fire every frame (60/s instead of 9.75). Never again. ---
eq('gate blocks early shot', shotReady(1000, 950, 9.75), false);
eq('gate passes on-time shot', shotReady(1000, 800, 9.75), true);
{
  // hold Vandal trigger 1 s @60fps -> ~9.75 shots, NOT 60
  let last = -1e9, n = 0;
  for (let f = 0; f <= 60; f++) { const now = (f * 1000) / 60; if (shotReady(now, last, 9.75)) { last = now; n++; } }
  eq('vandal 1s hold cadence', n, 9);
}
{
  // mash Sheriff as fast as 100 ms clicks -> hard cap 4/s wins
  let last = -1e9, n = 0;
  for (let c = 0; c < 10; c++) { const now = c * 100; if (shotReady(now, last, 4)) { last = now; n++; } }
  eq('sheriff 10 fast clicks', n, 4);
}

// --- spawn distance bands ---
eq('close band viable', SPAWN_BANDS.close[1] <= 9, true);
eq('spawnDist deterministic', spawnDist('long', 0.5), 27.5);
eq('spawnDist in band', spawnDist('close', 0.999) < 9 && spawnDist('close', 0) >= 4, true);
eq('spawnDist fallback', spawnDist('nope', 0), 10);

// --- orb sizes: XS matches a real head radius (0.26 * 0.6 = 0.156) ---
near('xs head-size', ORB_SIZES.xs * 0.26, 0.156, 1e-9);
eq('orbScale xs', orbScale('xs'), 0.6);
eq('orbScale default', orbScale('nope'), 1);
eq('orbScale xl', orbScale('xl'), 1.7);

// --- spawn intro: starts small, overshoots, settles at 1 ---
near('intro starts at 0.3', spawnIntro(0), 0.3, 1e-9);
eq('intro overshoots', spawnIntro(120) > 1, true);
near('intro settles', spawnIntro(500), 1, 1e-9);
eq('easeOutBack clamps', easeOutBack(5), easeOutBack(1));

// --- loadout slots: primary and secondary only ---
eq('sidearm slot', slotForClass('Sidearm'), 2);
eq('rifle slot', slotForClass('Rifle'), 1);
eq('sniper slot', slotForClass('Sniper'), 1);
eq('cycle fwd', cycleSlot(2, 1), 1);
eq('cycle back', cycleSlot(1, -1), 2);
eq('cycle mid', cycleSlot(1, 1), 2);

if (fails) { console.error(`${fails} FAILURES`); process.exit(1); }
console.log('ALL PASS');
