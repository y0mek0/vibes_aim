// Ballistics core — pure functions, no DOM, no three.js (node-testable).
// Damage bands, RPM, spread and zoom behave like VALORANT per DATA_SOURCES.md.

import { MOVE_DEFAULT, MOVE_SHOTGUN } from '../data/mechanics.js';

// First band whose maxRange >= dist
export function bandAt(gun, dist) {
  for (const b of gun.bands) if (dist <= b[0]) return b;
  return gun.bands[gun.bands.length - 1];
}

// Per-pellet damage. part: 'head' | 'body' | 'leg'
export function damageAtRange(gun, dist, part) {
  const b = bandAt(gun, dist);
  return part === 'head' ? b[1] : part === 'leg' ? b[3] : b[2];
}

// Total damage of one trigger pull (pellets x per-pellet), before HP cap
export function pullDamage(gun, dist, part, altSlug = false) {
  const pellets = altSlug && gun.alt?.kind === 'slug' ? gun.alt.pellets : gun.pellets;
  return pellets * damageAtRange(gun, dist, part);
}

// Shots (trigger pulls) to kill hp at dist with part hits
export function shotsToKill(gun, dist, part, hp, altSlug = false) {
  const d = pullDamage(gun, dist, part, altSlug);
  if (d <= 0) return Infinity;
  return Math.ceil(hp / d);
}

// Effective fire rate (rounds/sec) incl. spool position 0..1 and ADS/scoped state
export function effectiveRpm(gun, { ads = false, scoped = false, spool = 1 } = {}) {
  let rpm = gun.rpm;
  if (gun.spool) rpm = gun.spool.from + (gun.spool.to - gun.spool.from) * Math.min(1, Math.max(0, spool));
  if (scoped && gun.alt?.kind === 'scope' && gun.alt.scopeRpm) return gun.alt.scopeRpm;
  if (ads) {
    // burst weapons: sustained rate = rounds per burst × bursts per second
    // (Bulldog 3×2.105=6.32, Stinger 4×2.118=8.47 — matches wiki sustained figures)
    if (gun.alt?.kind === 'adsburst') return gun.alt.count * gun.alt.burstsPerSec;
    if (gun.alt?.kind === 'ads' && gun.alt.rpm) return gun.alt.rpm;
    if (gun.adsRpm) return gun.adsRpm;
  }
  return rpm;
}

// Time-to-kill (sec) assuming all-part hits at dist vs hp (rpm = rounds per SECOND)
export function ttk(gun, dist, part, hp, opts = {}) {
  const n = shotsToKill(gun, dist, part, hp, opts.altSlug);
  if (!isFinite(n) || n <= 1) return 0;
  return (n - 1) / effectiveRpm(gun, opts);
}

// Total spread in degrees for current state
export function spreadDeg(gun, { crouch = false, move = 'still', ads = false, scoped = false, bloom = 0 } = {}) {
  const s = gun.spread;
  if (scoped && s.scoped !== undefined) return s.scoped + movePenalty(gun, move) * 0.25;
  let base = s.hip;
  if (crouch) base *= 0.85; // documented crouch multiplier
  if (ads && s.ads !== undefined) base = crouch ? s.ads * 0.85 : s.ads;
  if (ads && gun.alt?.kind === 'adsburst' && gun.alt.spread !== undefined)
    base = crouch ? gun.alt.spread * 0.85 : gun.alt.spread;
  return Math.min(s.max ?? 10, base + movePenalty(gun, move) + bloom);
}

export function movePenalty(gun, move) {
  const s = gun.spread;
  const table = gun.cls === 'Shotgun' ? MOVE_SHOTGUN : MOVE_DEFAULT;
  const pick = k => s[k] ?? table[k] ?? 0;
  switch (move) {
    case 'crouchmove': return pick('crouchMove');
    case 'walk': return pick('walk');
    case 'run': return pick('run');
    case 'air': return pick('air');
    default: return 0;
  }
}

// Gridshot / Flick Shot are one-shot modes: any valid hit kills the orb,
// no weapon/gun damage math applies there (bots mode keeps the full model).
export const lethalOnHit = mode => mode === 'gridshot' || mode === 'flick';
// Current zoom factor (1 = hip). adsLevel for scope toggle index.
export function zoomOf(gun, { ads = false, scopeIdx = 0 } = {}) {
  if (!ads || !gun.alt) return 1;
  if (gun.alt.kind === 'scope') return gun.alt.zooms[Math.min(scopeIdx, gun.alt.zooms.length - 1)];
  return gun.alt.zoom || 1;
}
