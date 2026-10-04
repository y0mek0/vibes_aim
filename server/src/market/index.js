// server/src/market/index.js — provider factory. The rest of the server
// only ever imports `createMarketProvider` and gets a fully constructed
// object. Switching providers is one env-var.

import { createStubProvider } from './stub.js';
import { createFinnhubProvider } from './finnhub.js';

export function createMarketProvider({ provider, finnhubToken } = {}) {
  switch (provider) {
    case 'finnhub': return createFinnhubProvider({ token: finnhubToken });
    case 'stub':
    default:        return createStubProvider();
  }
}

export { RANGES } from './provider.js';
