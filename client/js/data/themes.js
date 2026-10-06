// Scenery themes — pure data (no three.js), testable. world.js interprets.
// Every theme reuses the same hall footprint + occluder contract so gameplay,
// spawn bands and raycasts behave identically everywhere.

export const THEMES = [
  { id: 'protocol', name: 'Protocol Hall', desc: 'Clean VALORANT training hall.',
    indoor: true, bg: '#202a34', fog: ['#202a34', 70, 190],
    hemi: ['#ffffff', '#4a5158', 1.45], dir: ['#fff2dd', 1.25],
    floor: '#333c44', wall: '#27333e', side: '#232e38', ceil: '#1a222b',
    accent: '#f6d447', glow: '#f6d447', lane: '#d8d8d8',
    sky: 'none', extras: ['pillars', 'racks', 'jumbo', 'sign', 'shafts', 'crates'] },
  { id: 'desert', name: 'Desert Range', desc: 'Sun-bleached outdoor range.',
    indoor: false, bg: '#182027', fog: ['#38423f', 45, 110],
    hemi: ['#e6e8e8', '#3b423d', 1.35], dir: ['#f6d447', 1.2],
    floor: '#373a37', wall: '#2e3430', side: '#242b28', ceil: null,
    accent: '#f6d447', glow: '#f6d447', lane: '#d8d8d8',
    sky: 'day', extras: ['mountains', 'sun', 'clouds', 'cypress', 'jumbo', 'woodcrates', 'stripes'] },
  { id: 'arctic', name: 'Arctic Outpost', desc: 'Snowfield under pale sun.',
    indoor: false, bg: '#1d262d', fog: ['#3d4748', 40, 100],
    hemi: ['#e6e8e8', '#3f464b', 1.4], dir: ['#f6d447', 1.15],
    floor: '#444a4e', wall: '#353d42', side: '#293238', ceil: null,
    accent: '#f6d447', glow: '#f6d447', lane: '#d8d8d8',
    sky: 'snow', extras: ['mountains', 'sun', 'snowpines', 'icespikes', 'jumbo', 'frostcrates', 'stripes'] },
  { id: 'night', name: 'Night Ops', desc: 'Dark facility, lit trim.',
    indoor: true, bg: '#070c13', fog: ['#070c13', 60, 170],
    hemi: ['#aeb7bf', '#1a2230', 0.85], dir: ['#d8d8d8', 0.7],
    floor: '#161d25', wall: '#101720', side: '#0d1319', ceil: '#080d13',
    accent: '#f6d447', glow: '#f6d447', lane: '#8a8474',
    sky: 'none', extras: ['pillars', 'racks', 'jumbo', 'sign', 'crates'] },
  { id: 'sunset', name: 'Sunset Courtyard', desc: 'Terracotta dusk, string lights.',
    indoor: false, bg: '#211d1a', fog: ['#3a3026', 45, 110],
    hemi: ['#e1d8c8', '#40372f', 1.25], dir: ['#f6d447', 1.15],
    floor: '#3e3730', wall: '#38302a', side: '#2d2722', ceil: null,
    accent: '#f6d447', glow: '#f6d447', lane: '#d8d8d8',
    sky: 'dusk', extras: ['mountains', 'lowsun', 'cypress', 'lights', 'jumbo', 'woodcrates', 'stripes'] },
  { id: 'bamboo', name: 'Bamboo Garden', desc: 'Walled green garden, lanterns.',
    indoor: false, bg: '#18231f', fog: ['#35443a', 45, 105],
    hemi: ['#dce8dd', '#3a4a3a', 1.3], dir: ['#f6d447', 1.1],
    floor: '#303933', wall: '#27342c', side: '#202c25', ceil: null,
    accent: '#f6d447', glow: '#f6d447', lane: '#d8d8d8',
    sky: 'garden', extras: ['bamboo', 'lanterns', 'fireflies', 'jumbo', 'stonecrates', 'stripes'] },
  { id: 'lunar', name: 'Lunar Base', desc: 'Regolith, stars, Earthrise.',
    indoor: false, bg: '#020306', fog: ['#0a0d13', 60, 160],
    hemi: ['#dfe3e4', '#2a2d33', 1.0], dir: ['#f6d447', 1.2],
    floor: '#5a5e63', wall: '#43474d', side: '#3a3e44', ceil: null,
    accent: '#f6d447', glow: '#f6d447', lane: '#d8d8d8',
    sky: 'stars', extras: ['earth', 'grayhills', 'jumbo', 'techcrates', 'stripes'] },
  { id: 'abyss', name: 'Abyss Lab', desc: 'Pressurized deep-sea dome.',
    indoor: true, bg: '#06121e', fog: ['#0a2233', 40, 120],
    hemi: ['#b8d7d0', '#0a1a26', 1.1], dir: ['#f6d447', 0.9],
    floor: '#16283a', wall: '#0f2030', side: '#0c1a28', ceil: '#081420',
    accent: '#f6d447', glow: '#f6d447', lane: '#d8d8d8',
    sky: 'none', extras: ['pillars', 'portholes', 'rays', 'jumbo', 'sign', 'crates'] },
  { id: 'sakura', name: 'Sakura Court', desc: 'Blossom courtyard, torii gate.',
    indoor: false, bg: '#1a2028', fog: ['#403e3a', 45, 110],
    hemi: ['#e6e8e8', '#4a4547', 1.35], dir: ['#f6d447', 1.15],
    floor: '#3d3b38', wall: '#353330', side: '#2b2a28', ceil: null,
    accent: '#f6d447', glow: '#f6d447', lane: '#d8d8d8',
    sky: 'pink', extras: ['blossom', 'torii', 'lights', 'jumbo', 'woodcrates', 'stripes', 'petals'] },
];

export const themeById = id => THEMES.find(t => t.id === id) || THEMES[0];
const HEX = /^#[0-9a-fA-F]{6}$/;
export function validateTheme(t) {
  if (!t || typeof t.id !== 'string' || typeof t.name !== 'string') return 'id/name';
  for (const k of ['bg', 'floor', 'wall', 'side', 'accent', 'glow', 'lane']) {
    if (!HEX.test(t[k])) return 'color ' + k;
  }
  if (t.ceil !== null && !HEX.test(t.ceil)) return 'color ceil';
  if (!HEX.test(t.fog[0]) || !HEX.test(t.hemi[0]) || !HEX.test(t.hemi[1]) || !HEX.test(t.dir[0])) return 'light colors';
  return null;
}
