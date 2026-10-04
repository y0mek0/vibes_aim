// Node test: stalker stays in bounds, never teleports, stops, varies by tier.
// Run: node tests/stalker.test.mjs (from valotrainer/)
import { createStalker, TRACK_DIFFS } from '../client/js/core/stalker.js';

let fails = 0;
const ok = (label, cond) => {
  if (!cond) { fails++; console.error(`FAIL ${label}`); }
  else console.log(`ok   ${label}`);
};

function sim(difficulty, seed, secs = 45) {
  const st = createStalker({ difficulty, seed });
  const dt = 1 / 60;
  let maxStep = 0, minAbsV = 1e9, flips = 0, stops = 0, crouchMax = 0, lastDir = st.state.dir;
  let out = 0;
  const n = Math.floor(secs / dt);
  for (let i = 0; i < n; i++) {
    const prevX = st.state.x;
    const s = st.update(dt);
    if (Math.abs(s.x) > 6.001) out++;
    maxStep = Math.max(maxStep, Math.abs(s.x - prevX));
    minAbsV = Math.min(minAbsV, Math.abs(s.vx));
    if (s.dir !== lastDir) { flips++; lastDir = s.dir; }
    if (s.phase === 'stop') stops++;
    crouchMax = Math.max(crouchMax, s.crouchK);
  }
  return { maxStep, minAbsV, flips, stops, crouchMax, out };
}

for (const d of ['easy', 'medium', 'hard']) {
  const r = sim(d, 1234);
  const stepCap = (5.4 * (1 + TRACK_DIFFS[d].jitter / 2)) / 60 + 1e-6; // jitter scales top speed
  ok(`${d} in bounds`, r.out === 0);
  ok(`${d} no teleport (maxStep ${r.maxStep.toFixed(3)} <= ${stepCap.toFixed(3)})`, r.maxStep <= stepCap);
  ok(`${d} stops (min|v| ${r.minAbsV.toFixed(2)})`, minAbsVCheck(r));
  console.log(`info ${d}: flips=${r.flips} stopFrames=${r.stops} crouchMax=${r.crouchMax.toFixed(2)}`);
}
function minAbsVCheck(r) { return r.minAbsV < 0.5; }

// determinism: same seed, same path
{
  const a = sim('medium', 777), b = sim('medium', 777);
  ok('deterministic', a.flips === b.flips && a.stops === b.stops && Math.abs(a.maxStep - b.maxStep) < 1e-12);
}
// difficulty = complexity, not just speed
{
  const e = sim('easy', 4242), h = sim('hard', 4242);
  ok('hard flips more than easy', h.flips > e.flips);
  ok('easy never crouches', sim('easy', 99).crouchMax === 0);
  ok('hard crouches', sim('hard', 99).crouchMax > 0.5);
}
// presets exist and differ
ok('three tiers', Object.keys(TRACK_DIFFS).join(',') === 'easy,medium,hard');

if (fails) { console.error(`${fails} FAILURES`); process.exit(1); }
console.log('ALL PASS');
