// Deterministic ticker boost catalog shared by the shop and reward route.
// NVDA rotates once per UTC day. TSLA and MSFT have two deliberate fixed boosts
// each, and NVDA excludes those IDs so a hit can never route to two tickers.

export const FIXED_TICKER_BOOSTS = Object.freeze({
  TSLA: Object.freeze(['mp9', 'xm1014']),
  MSFT: Object.freeze(['p2000', 'm4a1']),
});

const RESERVED_BOOST_IDS = new Set(Object.values(FIXED_TICKER_BOOSTS).flat());

function hashString(value) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function nextRandom(state) {
  let value = state.value + 0x6D2B79F5;
  value = Math.imul(value ^ (value >>> 15), value | 1);
  value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
  state.value = value >>> 0;
  return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
}

function utcDay(date = new Date()) {
  const value = date instanceof Date ? date : new Date(date);
  return value.toISOString().slice(0, 10);
}

export function getNvdaBoostRotationKey(date = new Date()) {
  return `nvda-boost:${utcDay(date)}`;
}

export function getNvdaBoostGunIds(catalog, date = new Date()) {
  const items = (Array.isArray(catalog) ? catalog : []).filter((gun) => !RESERVED_BOOST_IDS.has(gun?.id));
  const classes = [...new Set(items.map((gun) => gun?.cls).filter(Boolean))];
  const state = { value: hashString(getNvdaBoostRotationKey(date)) };
  const shuffledClasses = classes.slice();
  for (let index = shuffledClasses.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(nextRandom(state) * (index + 1));
    [shuffledClasses[index], shuffledClasses[swap]] = [shuffledClasses[swap], shuffledClasses[index]];
  }
  return shuffledClasses.slice(0, 3).map((cls) => {
    const candidates = items.filter((gun) => gun?.cls === cls).slice();
    const index = Math.floor(nextRandom(state) * candidates.length);
    return candidates[index]?.id;
  }).filter(Boolean);
}

export function getTickerBoostGunIds(ticker, catalog, date = new Date()) {
  const symbol = String(ticker || '').toUpperCase();
  if (symbol === 'NVDA') return getNvdaBoostGunIds(catalog, date);
  const knownIds = new Set((Array.isArray(catalog) ? catalog : []).map((gun) => gun?.id));
  return (FIXED_TICKER_BOOSTS[symbol] || []).filter((id) => knownIds.has(id));
}

export function getBoostTickerForGun(gunId, catalog, date = new Date()) {
  for (const ticker of ['TSLA', 'MSFT', 'NVDA']) {
    if (getTickerBoostGunIds(ticker, catalog, date).includes(gunId)) return ticker;
  }
  return null;
}

export function isNvdaBoostGun(gunId, catalog, date = new Date()) {
  return getTickerBoostGunIds('NVDA', catalog, date).includes(gunId);
}
