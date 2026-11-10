import assert from 'node:assert/strict';
import {
  AIM_RANK_MODES,
  AIM_SCORE_THRESHOLDS,
  BALANCE_THRESHOLDS_USD,
  KARATE_RANKS,
  RANK_DIVISIONS,
  RANK_STAGES,
  TOTAL_RANK_POINTS,
  QUALIFYING_SESSION_SECONDS,
  RANK_SCORE_SAMPLE,
  RANK_SCORE_WINDOW,
  aimRankFromScores,
  aimRankLevel,
  balanceRankLevel,
  overallDisplay,
  overallRating,
  qualifyingAimSession,
  rankByPoint,
  topScores,
  topScoresAverage,
} from '../client/js/data/ranks.js';

assert.equal(KARATE_RANKS.length, 8);
assert.deepEqual(KARATE_RANKS.map((rank) => rank.name), [
  'Mark', 'Sight', 'Trace', 'Tempo', 'Strike', 'Drive', 'Prime', 'Apex',
]);
assert.deepEqual(KARATE_RANKS.map((rank) => rank.belt), [
  'White', 'Yellow', 'Orange', 'Green', 'Blue', 'Purple', 'Brown', 'Black',
]);
assert.equal(new Set(KARATE_RANKS.map((rank) => rank.color)).size, 8);
assert.deepEqual(AIM_RANK_MODES, ['gridshot', 'flick', 'tracking', 'bots']);
assert.deepEqual(RANK_DIVISIONS, ['I', 'II', 'III']);
assert.equal(TOTAL_RANK_POINTS, 24);
assert.equal(RANK_STAGES.length, TOTAL_RANK_POINTS);
assert.equal(RANK_STAGES[0].displayName, 'Mark I');
assert.equal(RANK_STAGES[2].displayName, 'Mark III');
assert.equal(RANK_STAGES[3].displayName, 'Sight I');
assert.equal(RANK_STAGES[23].displayName, 'Apex III');
for (const mode of AIM_RANK_MODES) {
  assert.equal(AIM_SCORE_THRESHOLDS[mode].length, TOTAL_RANK_POINTS);
  assert.deepEqual([...AIM_SCORE_THRESHOLDS[mode]].sort((a, b) => a - b), [...AIM_SCORE_THRESHOLDS[mode]]);
}
assert.equal(BALANCE_THRESHOLDS_USD.length, TOTAL_RANK_POINTS);
assert.equal(BALANCE_THRESHOLDS_USD[0], 200);
assert.equal(BALANCE_THRESHOLDS_USD[21], 5_000_000);
assert.equal(BALANCE_THRESHOLDS_USD[22], 10_000_000);
assert.equal(BALANCE_THRESHOLDS_USD[23], 20_000_000);
assert.equal(QUALIFYING_SESSION_SECONDS, 300);
assert.equal(RANK_SCORE_WINDOW, 100);
assert.equal(RANK_SCORE_SAMPLE, 3);

assert.equal(qualifyingAimSession({ mode: 'gridshot', durationSeconds: 300, completed: true }), true);
assert.equal(qualifyingAimSession({ mode: 'gridshot', durationSeconds: 180, completed: true }), false);
assert.equal(qualifyingAimSession({ mode: 'gridshot', durationSeconds: 300, completed: false }), false);
assert.equal(qualifyingAimSession({ mode: 'unknown', durationSeconds: 300, completed: true }), false);

const scores = Array.from({ length: 105 }, (_, i) => i + 1);
assert.deepEqual(topScores(scores), [105, 104, 103]);
assert.equal(topScoresAverage(scores), 104);
assert.equal(topScoresAverage([100, 90]), null);
assert.equal(aimRankLevel('gridshot', 5_000), 4);
assert.equal(aimRankLevel('gridshot', 24_000), 22);
assert.equal(aimRankFromScores('gridshot', [5_000, 5_000, 5_000]), 4);
assert.equal(aimRankFromScores('gridshot', [1, 2, 3], 13), 13);
assert.equal(balanceRankLevel(200), 1);
assert.equal(balanceRankLevel(5_000_000), 22);
assert.equal(balanceRankLevel(10_000_000), 23);
assert.equal(balanceRankLevel(20_000_000), 24);
assert.equal(balanceRankLevel(199), 1);
assert.equal(rankByPoint(14).displayName, 'Strike II');
assert.equal(rankByPoint(24).displayName, 'Apex III');

assert.equal(overallRating([1, 1, 1, 1], 1), 1);
assert.equal(overallRating([24, 24, 24, 24], 24), 24);
assert.equal(overallRating([10, 10, 10, 10], 24), 17);
const display = overallDisplay(14.42);
assert.equal(display.level, 14);
assert.equal(display.rank.displayName, 'Strike II');
assert.ok(Math.abs(display.progress - 0.42) < 1e-9);
assert.equal(overallDisplay(24).progress, 1);

assert.throws(() => { KARATE_RANKS.push({}); }, TypeError);
assert.throws(() => { KARATE_RANKS[0].name = 'Changed'; }, TypeError);
console.log('rank calibration and weighting: ALL PASS');
