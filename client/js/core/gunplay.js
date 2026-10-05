// Gunplay math — pure functions mirroring VALORANT's movement/firing model.
// game.js implements these exact formulas per-frame; this module is the
// testable single source of truth. See DATA_SOURCES.md for provenance.

import { effectiveRpm } from './ballistics.js';

export const DEADZONE_FRAC = 0.275; // below 27.5% speed = full accuracy (Riot)
export const WALK_FRAC = 0.61;      // Shift-walk speed fraction (Riot dev timing)
export const CROUCH_FRAC = 0.34;    // crouch-move fraction (estimate)
export const STOP_EXP = 3.3;        // release friction: exponential coefficient
export const STOP_FLAT = 28.6;      // release friction: flat m/s^2
export const ACCEL = 18.75;         // ground accel m/s^2 (rifle, scales w/ speed)
export const AIR_ACCEL_FRAC = 0.35; // air control fraction (estimate)
export const JUMP_V0 = 7.098;       // jump impulse m/s (1.2 m jump, g=21)
export const GRAV = 21;             // gravity m/s^2
export const CAM_STAND = 1.6;
export const CAM_CROUCH = 1.05;     // crouch eye height (estimate)

export const deadzone = gun => DEADZONE_FRAC * gun.run;
export const stanceSpeed = (gun, stance, slow = 1) =>
  (stance === 'crouch' ? CROUCH_FRAC : stance === 'walk' ? WALK_FRAC : 1) * gun.run * slow;

// Spread movement category from true speed (counter-strafe friendly:
// anything under the deadzone is 'still' = full accuracy)
export function moveForSpeed(speed, gun, airborne) {
  if (airborne) return 'air';
  if (speed < deadzone(gun)) return 'still';
  if (speed < WALK_FRAC * gun.run + 0.05) return 'walk';
  return 'run';
}

// Friction after releasing keys: v *= e^(-3.3dt), then flat 28.6 m/s^2.
// Substepped so the test matches the game at any dt.
export function frictionSpeed(v0, dt) {
  const steps = Math.max(1, Math.ceil(dt / 0.004));
  let v = v0;
  const h = dt / steps;
  for (let i = 0; i < steps; i++) {
    v = v * Math.exp(-STOP_EXP * h) - STOP_FLAT * h;
    if (v <= 0) return 0;
  }
  return v;
}

export function timeToDeadzone(v0, gun) {
  const dz = deadzone(gun);
  let v = v0, t = 0;
  while (v >= dz && t < 2) { v = frictionSpeed(v, 0.004); t += 0.004; }
  return t;
}

export const jumpAirTime = () => (2 * JUMP_V0) / GRAV; // ≈0.676 s

// Minimum seconds between trigger pulls (semi rate cap + auto interval)
export const minGap = (gun, opts) => 1 / effectiveRpm(gun, opts);

// THE firing gate — single choke point for "may this shot happen now".
// Clocks are performance.now() MILLISECONDS; rps is rounds per SECOND.
// (A ms-vs-s mixup here once made every gun fire every frame.)
export const shotReady = (nowMs, lastMs, rps) => nowMs - lastMs >= 1000 / rps;

// Burst timing: fast intra-burst pops, slow inter-burst cooldown.
// Bulldog: 3 @13.333rps every 1/2.105s → sustained 6.32 (matches wiki).
export function burstTiming(alt) {
  return { intraGap: 1 / alt.intraRps, interGap: 1 / alt.burstsPerSec };
}

// Bloom recovery: ~95% gone after `recovery` seconds (Stinger 0.4, Bulldog 0.35)
export const bloomDecay = (bloom, recovery, dt) => bloom * Math.exp((-3 * dt) / (recovery || 0.4));
// Bot spawn distance bands (Settings -> Distance). Player-relative, meters.
// Close band reaches knife range (2.2 m) once you walk up to the bot.
export const SPAWN_BANDS = { close: [4, 9], standard: [10, 20], long: [20, 35] };
export const spawnDist = (band, r) => {
  const b = SPAWN_BANDS[band] || SPAWN_BANDS.standard;
  const u = r === undefined ? Math.random() : r;
  return b[0] + u * (b[1] - b[0]);
};

// Loadout slots: primary and secondary.
export const slotForClass = cls => cls === 'Sidearm' ? 2 : 1;
// Spawn intro: targets pop in with an overshoot ease over ~0.25 s so they
// visibly "arrive" (1 = fully in). Pure + tested.
export const easeOutBack = k => { const c = 1.70158; k = Math.min(1, Math.max(0, k)); return 1 + (c + 1) * Math.pow(k - 1, 3) + c * Math.pow(k - 1, 2); };
export const spawnIntro = ageMs => 0.3 + 0.7 * easeOutBack(ageMs / 250);
// Orb sizes: XS ≈ real head radius (0.156 m), M standard, XL huge.
// Base orb geometry r=0.26; scale multiplies it.
export const ORB_SIZES = { xs: 0.6, s: 0.8, m: 1.0, l: 1.3, xl: 1.7 };
export const orbScale = key => ORB_SIZES[key] || 1;
export const cycleSlot = (cur, dir) => ((cur - 1 + dir + 2) % 2) + 1;
