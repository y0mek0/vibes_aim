// server/src/config.js — read-only config from environment. No secrets in code.

function readNumber(name, def) {
  const raw = process.env[name];
  if (raw == null || raw === '') return def;
  const n = Number(raw);
  if (!Number.isFinite(n)) {
    throw new Error(`env ${name} must be a number, got ${JSON.stringify(raw)}`);
  }
  return n;
}

function readString(name, def) {
  const raw = process.env[name];
  if (raw == null || raw === '') {
    if (def === undefined) throw new Error(`env ${name} is required`);
    return def;
  }
  return raw;
}

export const config = {
  port: readNumber('PORT', 3000),
  origin: readString('ORIGIN', 'http://127.0.0.1:4173'),
  market: {
    provider: readString('MARKET_PROVIDER', 'stub'),
    finnhubToken: readString('FINNHUB_TOKEN', ''),
  },
  supabase: {
    url: readString('SUPABASE_URL', ''),
    serviceKey: readString('SUPABASE_SERVICE_KEY', ''),
  },
  google: {
    // OAuth client id used to verify id_token audience (aud claim).
    clientId: readString('GOOGLE_CLIENT_ID', ''),
  },
  privy: {
    appId: readString('PRIVY_APP_ID', ''),
    appSecret: readString('PRIVY_APP_SECRET', ''),
  },
  aim: {
    hitRps: readNumber('AIM_HIT_RPS', 15),
    hitUnit: readNumber('AIM_HIT_UNIT', 0.0008),
    priceImpactMax: readNumber('AIM_PRICE_IMPACT_MAX', 0.018),
  },
  a2s: {
    rpcUrl: readString('A2S_RPC_URL', 'https://rpc.testnet.chain.robinhood.com'),
    chainId: readNumber('A2S_CHAIN_ID', 46630),
    contract: readString('A2S_CONTRACT', '0xcE413504CD82FcF32b290366D57443C6B3213DC9'),
    decimals: readNumber('A2S_DECIMALS', 18),
    authSecret: readString('A2S_AUTH_SECRET', process.env.SUPABASE_SERVICE_KEY || (process.env.NODE_ENV === 'production' ? '' : 'aim2stock-dev-a2s-secret')),
    cacheMs: readNumber('A2S_CACHE_MS', 60_000),
    historyWindowBlocks: readNumber('A2S_HISTORY_BLOCKS', 30_000_000),
  },
};
