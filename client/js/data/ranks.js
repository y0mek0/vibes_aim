// Rank catalog and first calibration table for the five-domain profile.
// Aim thresholds use the shipped raw score of each mode. Balance thresholds
// use current total portfolio value in USD, not profit or reward bonuses.

export const RANK_CALIBRATION_VERSION = '2026-11-v1';
export const QUALIFYING_SESSION_SECONDS = 300;
export const RANK_SCORE_WINDOW = 100;
export const RANK_SCORE_SAMPLE = 3;
export const AIM_RANK_MODES = Object.freeze(['gridshot', 'flick', 'tracking', 'bots']);

const RANK_COLORS = Object.freeze({
  white: '#f4f1ea',
  yellow: '#f6d447',
  orange: '#f08a24',
  green: '#46a36a',
  blue: '#3d7bd9',
  purple: '#8b5cf6',
  brown: '#8b5a2b',
  black: '#111318',
});

const makeRank = (level, id, name, belt, color, textColor) => Object.freeze({
  level, id, name, belt, color, textColor,
});

export const KARATE_RANKS = Object.freeze([
  makeRank(1, 'mark', 'Mark', 'White', RANK_COLORS.white, '#111318'),
  makeRank(2, 'sight', 'Sight', 'Yellow', RANK_COLORS.yellow, '#17140a'),
  makeRank(3, 'trace', 'Trace', 'Orange', RANK_COLORS.orange, '#17140a'),
  makeRank(4, 'tempo', 'Tempo', 'Green', RANK_COLORS.green, '#f4f1ea'),
  makeRank(5, 'strike', 'Strike', 'Blue', RANK_COLORS.blue, '#f4f1ea'),
  makeRank(6, 'drive', 'Drive', 'Purple', RANK_COLORS.purple, '#f4f1ea'),
  makeRank(7, 'prime', 'Prime', 'Brown', RANK_COLORS.brown, '#f4f1ea'),
  makeRank(8, 'apex', 'Apex', 'Black', RANK_COLORS.black, '#f4f1ea'),
]);

// Draft v1 thresholds are intentionally mode-specific because the game uses
// different raw score scales: Flick is reaction-time points, Tracking is
// time-on-target points, and the other modes award kill points.
export const AIM_SCORE_THRESHOLDS = Object.freeze({
  gridshot: Object.freeze([0, 5_000, 8_000, 11_000, 14_000, 17_000, 20_000, 24_000]),
  flick: Object.freeze([0, 40_000, 65_000, 90_000, 115_000, 135_000, 150_000, 165_000]),
  tracking: Object.freeze([0, 1_000, 2_000, 3_000, 4_000, 5_000, 6_500, 8_000]),
  bots: Object.freeze([0, 3_000, 6_000, 9_000, 12_000, 15_000, 19_000, 24_000]),
});

// Starting balance is 200 USD. The current total balance is dynamic and can
// move down; balance rank is therefore not an attained/high-water-mark rank.
export const BALANCE_THRESHOLDS_USD = Object.freeze([
  200, 300, 450, 700, 1_100, 1_800, 3_000, 5_000,
]);

const RANK_BY_ID = new Map(KARATE_RANKS.map((rank) => [rank.id, rank]));

function numeric(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export function rankByLevel(level) {
  const n = Math.trunc(numeric(level, 1));
  return KARATE_RANKS[Math.max(0, Math.min(KARATE_RANKS.length - 1, n - 1))];
}

export function rankById(id) {
  return RANK_BY_ID.get(String(id || '').toLowerCase()) || KARATE_RANKS[0];
}

export function rankLevelForThreshold(value, thresholds) {
  const amount = Math.max(0, numeric(value));
  let level = 1;
  for (let i = 0; i < thresholds.length; i++) {
    if (amount >= thresholds[i]) level = i + 1;
    else break;
  }
  return level;
}

export function aimRankLevel(mode, score) {
  const thresholds = AIM_SCORE_THRESHOLDS[mode] || AIM_SCORE_THRESHOLDS.gridshot;
  return rankLevelForThreshold(score, thresholds);
}

export function balanceRankLevel(totalBalanceUsd) {
  return rankLevelForThreshold(totalBalanceUsd, BALANCE_THRESHOLDS_USD);
}

export function qualifyingAimSession({ mode, durationSeconds, completed = true } = {}) {
  return AIM_RANK_MODES.includes(mode)
    && Math.trunc(numeric(durationSeconds)) === QUALIFYING_SESSION_SECONDS
    && completed === true;
}

export function topScores(scores, windowSize = RANK_SCORE_WINDOW, sampleSize = RANK_SCORE_SAMPLE) {
  const valid = Array.isArray(scores)
    ? scores.map(Number).filter(Number.isFinite).slice(-windowSize)
    : [];
  return valid.sort((a, b) => b - a).slice(0, sampleSize);
}

export function topScoresAverage(scores, windowSize = RANK_SCORE_WINDOW, sampleSize = RANK_SCORE_SAMPLE) {
  const selected = topScores(scores, windowSize, sampleSize);
  if (selected.length < sampleSize) return null;
  return selected.reduce((sum, value) => sum + value, 0) / selected.length;
}

export function aimRankFromScores(mode, scores, attainedLevel = 1) {
  const average = topScoresAverage(scores);
  const candidate = average === null ? 1 : aimRankLevel(mode, average);
  return Math.max(1, Math.min(8, Math.max(Math.trunc(attainedLevel) || 1, candidate)));
}

export function overallRating(aimLevels, balanceLevel) {
  const aim = Array.isArray(aimLevels) ? aimLevels.slice(0, 4).map((value) => Math.max(1, Math.min(8, numeric(value, 1)))) : [];
  while (aim.length < 4) aim.push(1);
  const balance = Math.max(1, Math.min(8, numeric(balanceLevel, 1)));
  return (aim.reduce((sum, value) => sum + value, 0) + balance * 4) / 8;
}

export function overallDisplay(rating) {
  const value = Math.max(1, Math.min(8, numeric(rating, 1)));
  const level = value >= 8 ? 8 : Math.floor(value);
  return {
    rating: value,
    level,
    progress: level >= 8 ? 1 : value - level,
    rank: rankByLevel(level),
  };
}
