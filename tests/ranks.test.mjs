import assert from 'node:assert/strict';
import {
  AIM_RANK_MODES,
  AIM_SCORE_THRESHOLDS,
  BALANCE_THRESHOLDS_USD,
  KARATE_RANKS,
  QUALIFYING_SESSION_SECONDS,
  RANK_SCORE_SAMPLE,
  RANK_SCORE_WINDOW,
  aimRankFromScores,
  aimRankLevel,
  balanceRankLevel,
  overallDisplay,
  overallRating,
  qualifyingAimSession,
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
for (const mode of AIM_RANK_MODES) {
  assert.equal(AIM_SCORE_THRESHOLDS[mode].length, 8);
  assert.deepEqual([...AIM_SCORE_THRESHOLDS[mode]].sort((a, b) => a - b), [...AIM_SCORE_THRESHOLDS[mode]]);
}
assert.equal(BALANCE_THRESHOLDS_USD.length, 8);
assert.equal(BALANCE_THRESHOLDS_USD[0], 200);
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
assert.equal(aimRankLevel('gridshot', 5_000), 2);
assert.equal(aimRankLevel('gridshot', 24_000), 8);
assert.equal(aimRankFromScores('gridshot', [5_000, 5_000, 5_000]), 2);
assert.equal(aimRankFromScores('gridshot', [1, 2, 3], 5), 5);
assert.equal(balanceRankLevel(200), 1);
assert.equal(balanceRankLevel(5_000_000), 8);
assert.equal(balanceRankLevel(199), 1);

assert.equal(overallRating([1, 1, 1, 1], 1), 1);
assert.equal(overallRating([8, 8, 8, 8], 8), 8);
assert.equal(overallRating([4, 4, 4, 4], 8), 6);
const display = overallDisplay(5.75);
assert.equal(display.level, 5);
assert.equal(display.rank.name, 'Strike');
assert.equal(display.progress, 0.75);
assert.equal(overallDisplay(8).progress, 1);

assert.throws(() => { KARATE_RANKS.push({}); }, TypeError);
assert.throws(() => { KARATE_RANKS[0].name = 'Changed'; }, TypeError);
console.log('rank calibration and weighting: ALL PASS');
