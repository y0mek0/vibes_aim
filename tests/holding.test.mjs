import assert from 'node:assert/strict';
import {
  HOLDING_CAP,
  HOLDING_AMOUNT_TIERS,
  HOLDING_TIME_TIERS,
  getAmountTier,
  getTimeTier,
  getHoldingMultiplier,
  getHoldingMatrix,
} from '../client/js/data/holding.js';

assert.equal(getAmountTier(999_999).label, '< 1M');
assert.equal(getAmountTier(1_000_000).label, '1M');
assert.equal(getAmountTier(5_000_000).label, '5M');
assert.equal(getAmountTier(100_000_000).label, '100M');

assert.equal(getTimeTier(0).label, 'Now');
assert.equal(getTimeTier(3).label, '3 days');
assert.equal(getTimeTier(29.99).label, '14 days');
assert.equal(getTimeTier(30).label, '30 days');

assert.equal(getHoldingMultiplier(999_999, 30), 1);
assert.equal(getHoldingMultiplier(1_000_000, 0), 1.2);
assert.equal(getHoldingMultiplier(1_000_000, 3), 1.32);
assert.equal(getHoldingMultiplier(1_000_000, 7), 1.5);
assert.equal(getHoldingMultiplier(10_000_000, 14), 3.19);
assert.equal(getHoldingMultiplier(50_000_000, 30), 7.35);
assert.equal(getHoldingMultiplier(100_000_000, 30), 10);
assert.equal(HOLDING_CAP, 10);

const matrix = getHoldingMatrix();
assert.equal(matrix.length, HOLDING_AMOUNT_TIERS.length);
assert.equal(matrix[0].values.length, HOLDING_TIME_TIERS.length);
for (let row = 0; row < matrix.length; row += 1) {
  for (let col = 0; col < matrix[row].values.length; col += 1) {
    assert.ok(matrix[row].values[col] <= HOLDING_CAP);
    if (row > 0) assert.ok(matrix[row].values[col] >= matrix[row - 1].values[col]);
    if (col > 0) assert.ok(matrix[row].values[col] >= matrix[row].values[col - 1]);
  }
}

console.log('holding rules: ALL PASS');
