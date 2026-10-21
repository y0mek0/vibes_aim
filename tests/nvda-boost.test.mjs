import assert from 'node:assert/strict';
import { GUNS } from '../client/js/data/guns.js';
import { getNvdaBoostGunIds, getNvdaBoostRotationKey } from '../client/js/data/nvda-boost.js';

const date = new Date('2026-10-21T12:00:00Z');
const idsA = getNvdaBoostGunIds(GUNS, date);
const idsB = getNvdaBoostGunIds(GUNS, date);
assert.equal(idsA.length, 3);
assert.deepEqual(idsA, idsB);
assert.equal(new Set(idsA).size, 3);
assert.equal(new Set(idsA.map((id) => GUNS.find((gun) => gun.id === id).cls)).size, 3);
assert.equal(getNvdaBoostRotationKey(date), 'nvda-boost:2026-10-21');
console.log(`nvda boost rotation: ALL PASS (${idsA.join(', ')})`);
