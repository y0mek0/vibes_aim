// A2S holding economy — shared by the browser UI and server-side reward code.
// Balances are expressed in whole A2S units after token decimals are removed.

export const HOLDING_CAP = 10;

export const HOLDING_AMOUNT_TIERS = Object.freeze([
  Object.freeze({ min: 0, label: '< 1M', multiplier: 1.00 }),
  Object.freeze({ min: 1_000_000, label: '1M', multiplier: 1.20 }),
  Object.freeze({ min: 5_000_000, label: '5M', multiplier: 1.60 }),
  Object.freeze({ min: 10_000_000, label: '10M', multiplier: 2.20 }),
  Object.freeze({ min: 25_000_000, label: '25M', multiplier: 3.20 }),
  Object.freeze({ min: 50_000_000, label: '50M', multiplier: 4.40 }),
  Object.freeze({ min: 100_000_000, label: '100M', multiplier: 6.00 }),
]);

export const HOLDING_TIME_TIERS = Object.freeze([
  Object.freeze({ days: 0, label: 'Now', multiplier: 1.00 }),
  Object.freeze({ days: 3, label: '3 days', multiplier: 1.10 }),
  Object.freeze({ days: 7, label: '7 days', multiplier: 1.25 }),
  Object.freeze({ days: 14, label: '14 days', multiplier: 1.45 }),
  Object.freeze({ days: 30, label: '30 days', multiplier: 1.67 }),
]);

const round2 = (value) => Math.round(Number(value) * 100) / 100;

export function normalizeHoldingBalance(balance) {
  const numeric = typeof balance === 'bigint' ? Number(balance) : Number(balance);
  return Number.isFinite(numeric) && numeric >= 0 ? numeric : 0;
}

export function getAmountTier(balance) {
  const value = normalizeHoldingBalance(balance);
  let selected = HOLDING_AMOUNT_TIERS[0];
  for (const tier of HOLDING_AMOUNT_TIERS) {
    if (value >= tier.min) selected = tier;
    else break;
  }
  return selected;
}

export function getTimeTier(heldDays) {
  const value = Number(heldDays);
  const days = Number.isFinite(value) && value >= 0 ? value : 0;
  let selected = HOLDING_TIME_TIERS[0];
  for (const tier of HOLDING_TIME_TIERS) {
    if (days >= tier.days) selected = tier;
    else break;
  }
  return selected;
}

export function getHoldingMultiplier(balance, heldDays) {
  const amount = getAmountTier(balance);
  if (amount.min < 1_000_000) return 1;
  const time = getTimeTier(heldDays);
  return round2(Math.min(HOLDING_CAP, amount.multiplier * time.multiplier));
}

export function getHoldingMatrix() {
  return HOLDING_AMOUNT_TIERS.map((amount) => ({
    ...amount,
    values: HOLDING_TIME_TIERS.map((time) => amount.min < 1_000_000
      ? 1
      : round2(Math.min(HOLDING_CAP, amount.multiplier * time.multiplier))),
  }));
}

export function getNextHoldingTier(balance, heldDays) {
  const amount = normalizeHoldingBalance(balance);
  const days = Number.isFinite(Number(heldDays)) && Number(heldDays) >= 0 ? Number(heldDays) : 0;
  const nextAmount = HOLDING_AMOUNT_TIERS.find((tier) => tier.min > amount) || null;
  const nextTime = HOLDING_TIME_TIERS.find((tier) => tier.days > days) || null;
  return { nextAmount, nextTime };
}

export function formatHoldingMultiplier(value) {
  return `x${Number(value).toFixed(2)}`;
}

export function formatHoldingBalance(value) {
  const amount = normalizeHoldingBalance(value);
  if (amount >= 1_000_000) return `${(amount / 1_000_000).toFixed(amount % 1_000_000 === 0 ? 0 : 2)}M`;
  return Math.floor(amount).toLocaleString('en-US');
}
