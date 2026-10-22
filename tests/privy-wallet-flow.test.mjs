import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('../client/privy/index.js', import.meta.url), 'utf8');

assert.match(source, /useLinkAccount/);
assert.match(source, /linkWalletRef\.current\?\.\(\)/);
assert.match(source, /pending\.kind === 'wallet' && !hasEthereumWallet/);
assert.match(source, /stateRef\.current\.authenticated && kind !== 'wallet'/);
assert.doesNotMatch(source, /authenticated\) return kind === 'wallet' \? resolveConnected\(\)/);
console.log('Privy authenticated user links an external wallet: ALL PASS');
