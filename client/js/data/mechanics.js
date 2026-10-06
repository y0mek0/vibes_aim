// VALORANT global mechanics — researched values, see DATA_SOURCES.md
// All angles in DEGREES. Distances in METERS. Speeds in M/S.

export const SENS_YAW = 0.07;          // degrees per mouse count at sens 1.0 (Riot-confirmed)
export const HFOV = 103;               // locked horizontal FOV, degrees
export const CM_PER_360 = (dpi, sens) => (360 * 2.54) / (dpi * sens * SENS_YAW);

// Zoom model. VALORANT locks 103° HFOV; zoom divides the view (zoom 1.25x -> ~82.4°).
// Scoped aim: game scales sensitivity by (scopeSlider / zoom) on top of aim sens
// (slider default 1.0). Community 0%-monitor-match presets below reproduce
// crosshair-true 1:1 feel when entered as the slider value (edpi-calculator.org).
export const ZERO_MATCH = { '1.15': 0.908, '1.25': 0.870, '1.5': 0.815, '2.5': 0.747, '3.5': 0.731, '5': 0.723 };
export const scopedDPC = (sens, slider, zoom) => SENS_YAW * sens * slider / zoom;

// Movement error model (added spread, degrees). Best-documented table is the
// Phantom's (wiki): crouch-move +0.8 / walk +3 / run +6 / air +10. Used as the
// default for rifles/SMGs/sidearms; shotguns use the Judge table.
export const MOVE_DEFAULT = { crouchMove: 0.8, walk: 3, run: 6, air: 10 };
export const MOVE_SHOTGUN = { crouchMove: 0.5, walk: 1, run: 2, air: 4 };

// vibes_aim has a flat 100 HP model — no shields, no armor tiers. Bots
// also sit at 100 HP; there is nothing for the player to configure.
// Kept as a single export so any legacy import resolves to a number
// rather than crashing the build.
export const PLAYER_HP = 100;

// Stat ticker cadence (ms) — DOM updates throttled, sim stays per-frame
export const STAT_TICK_MS = 80;
