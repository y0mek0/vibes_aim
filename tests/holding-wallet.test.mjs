import assert from 'node:assert/strict';
import { Wallet } from 'ethers';
import { createHoldingService } from '../server/src/holding/service.js';
import { createApp } from '../server/src/index.js';

const wallet = Wallet.createRandom();
const holding = createHoldingService({ authSecret: 'test-secret', chainId: 46630, contract: '0xcE413504CD82FcF32b290366D57443C6B3213DC9' });
const challenge = await holding.challenge(wallet.address);
const signature = await wallet.signMessage(challenge.message);
const verified = await holding.verify({ wallet: wallet.address, message: challenge.message, signature, challengeToken: challenge.challengeToken });
assert.equal(holding.readProof(verified.walletProof).wallet, wallet.address);
await assert.rejects(() => holding.verify({ wallet: wallet.address, message: challenge.message, signature: Wallet.createRandom().signMessage(challenge.message), challengeToken: challenge.challengeToken }));
console.log('wallet challenge/signature verification: ALL PASS');

const fakeStore = {
  async listUnlocks() { return []; },
  async hitRateCheck() { return { allowed: true }; },
  async recordHit() { return { duplicate: false }; },
  async getOrCreatePlayer() { return {}; },
  async recordAccuracy() {},
  async addTickerUnits(_playerId, _ticker, unit) { return { qty: unit }; },
};
const fakeHolding = {
  readProof() { return { wallet: wallet.address }; },
  async getVerifiedStatus() { return { multiplier: 2.2, verified: true }; },
  async challenge() { return {}; },
  async verify() { return {}; },
  async getStatus() { return {}; },
};
const app = createApp({ store: fakeStore, holding: fakeHolding });
const server = app.listen(0);
await new Promise((resolve) => server.once('listening', resolve));
const port = server.address().port;
const response = await fetch(`http://127.0.0.1:${port}/aim/hit`, {
  method: 'POST',
  headers: { 'content-type': 'application/json', 'x-player-id': 'holding-test', 'x-session-id': 'holding-session', 'x-wallet-proof': verified.walletProof },
  body: JSON.stringify({ hitId: 'holding-hit', ticker: 'AAPL', accuracy: 1, streak: 0, gunId: 'vandal' }),
});
const json = await response.json();
assert.equal(response.status, 200);
assert.equal(json.holdingVerified, true);
assert.equal(json.holdingMultiplier, 2.2);
assert.equal(json.unit, 0.00176);
server.close();
console.log('server reward applies verified holding multiplier: ALL PASS');
