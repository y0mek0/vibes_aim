// Stalker — VALORANT-like strafe brain for the tracking bot. Pure + seeded.
// DOCUMENTED (engine, reused here): accel 18.75, release friction
// v·e^(-3.3t) − 28.6t, deadzone 27.5%, stop ~0.1 s, walk 61%, rhythm
// move → stop → shoot → move, jiggle 0.2–0.3 s, tempo variation, micro vs
// long strafes (see DATA_SOURCES.md).
// MODELED (assumption, labeled): strafe-duration bands, pause/fake/crouch
// rates and rhythm cadence per tier. Difficulty scales COMPLEXITY, not speed.

import { frictionSpeed } from './gunplay.js';

export const STALK_ACCEL = 18.75;
export const TRACK_DIFFS = {
  easy:   { strafe: [1.2, 2.2], walkMix: 0,    fakeP: 0,    pauseP: 0.08, pause: [0.4, 0.9],  rhythm: 6,   crouchP: 0,   jitter: 0 },
  medium: { strafe: [0.6, 1.6], walkMix: 0.25, fakeP: 0.12, pauseP: 0.15, pause: [0.3, 0.7],  rhythm: 4,   crouchP: 0.1,  jitter: 0.15 },
  hard:   { strafe: [0.35, 1.1], walkMix: 0.35, fakeP: 0.25, pauseP: 0.2,  pause: [0.25, 0.6], rhythm: 2.5, crouchP: 0.2,  jitter: 0.3 },
};

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createStalker({ bounds = 6, speed = 5.4, difficulty = 'medium', seed = 1 } = {}) {
  const P = TRACK_DIFFS[difficulty] || TRACK_DIFFS.medium;
  const rand = mulberry32(seed >>> 0);
  const R = (a, b) => a + rand() * (b - a);
  const S = {
    x: 0, vx: 0, dir: 1, phase: 'strafe', t: 0, dur: 1,
    frac: 1, tempo: 1, crouch: 0, crouchOn: false, rhythmT: P.rhythm,
    state: { x: 0, vx: 0, dir: 1, crouchK: 0, phase: 'strafe' },
  };
  function newStrafe(forceDir) {
    if (forceDir) S.dir = forceDir;
    else if (rand() < 0.8) S.dir *= -1; // mostly alternate, sometimes push through (wide swing)
    S.frac = rand() < P.walkMix ? 0.61 : 1;
    S.dur = R(P.strafe[0], P.strafe[1]) * S.tempo;
    S.crouchOn = rand() < P.crouchP;
    S.phase = 'strafe'; S.t = 0;
  }
  newStrafe(rand() < 0.5 ? -1 : 1);
  return {
    params: P,
    state: S.state,
    update(dt) {
      S.t += dt;
      S.rhythmT -= dt;
      if (S.rhythmT <= 0) { S.rhythmT = P.rhythm; S.tempo = 0.8 + rand() * 0.5; } // tempo shift
      const ck = S.crouchOn && S.phase === 'strafe' ? 1 : 0;
      S.crouch += Math.max(-6 * dt, Math.min(6 * dt, ck - S.crouch));
      if (S.phase === 'strafe') {
        if (S.x > bounds - 1 && S.dir > 0) S.dir = -1; // steer off walls early
        if (S.x < -bounds + 1 && S.dir < 0) S.dir = 1;
        const want = S.dir * S.frac * speed * (1 + (rand() - 0.5) * P.jitter);
        const dv = want - S.vx, maxD = STALK_ACCEL * dt;
        S.vx += Math.max(-maxD, Math.min(maxD, dv));
        if (S.t >= S.dur) {
          const r = rand();
          if (r < P.fakeP) { S.dir *= -1; S.dur = S.dur * 0.4; S.frac = 1; S.t = 0; } // fake-out
          else if (r < P.fakeP + P.pauseP) { S.phase = 'stop'; S.t = 0; S.dur = R(P.pause[0], P.pause[1]); S.crouchOn = false; }
          else newStrafe(0);
        }
      } else { // stop: real engine friction, then re-engage (counter-strafe style)
        const s = S.vx < 0 ? -1 : 1;
        S.vx = s * frictionSpeed(Math.abs(S.vx), dt);
        if (S.t >= S.dur) newStrafe(0);
      }
      S.x += S.vx * dt;
      if (S.x > bounds) { S.x = bounds; S.vx = Math.min(0, S.vx); }
      if (S.x < -bounds) { S.x = -bounds; S.vx = Math.max(0, S.vx); }
      S.state.x = S.x; S.state.vx = S.vx; S.state.dir = S.dir;
      S.state.crouchK = S.crouch; S.state.phase = S.phase;
      return S.state;
    },
  };
}
