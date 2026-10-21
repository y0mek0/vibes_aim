// Deterministic daily NVDA boost rotation shared by the shop and reward route.
// The rotation changes once per UTC day and never rerolls on page refresh.

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
  const items = Array.isArray(catalog) ? catalog : [];
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

export function isNvdaBoostGun(gunId, catalog, date = new Date()) {
  return getNvdaBoostGunIds(catalog, date).includes(gunId);
}
