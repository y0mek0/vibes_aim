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
  aim: {
    hitRps: readNumber('AIM_HIT_RPS', 15),
    hitUnit: readNumber('AIM_HIT_UNIT', 0.0008),
    priceImpactMax: readNumber('AIM_PRICE_IMPACT_MAX', 0.018),
  },
};
