// Scenery themes — pure data (no three.js), testable. world.js interprets.
// Every theme reuses the same hall footprint + occluder contract so gameplay,
// spawn bands and raycasts behave identically everywhere.

export const THEMES = [
  { id: 'protocol', name: 'Protocol Hall', desc: 'Clean VALORANT training hall.',
    indoor: true, bg: '#202a34', fog: ['#202a34', 70, 190],
    hemi: ['#ffffff', '#4a5158', 1.45], dir: ['#fff2dd', 1.25],
    floor: '#333c44', wall: '#27333e', side: '#232e38', ceil: '#1a222b',
    accent: '#f6d447', glow: '#7df9c5', lane: '#d8d8d8',
    sky: 'none', extras: ['pillars', 'racks', 'jumbo', 'sign', 'shafts', 'crates'] },
  { id: 'desert', name: 'Desert Range', desc: 'Sun-bleached outdoor range.',
    indoor: false, bg: '#9fc3e0', fog: ['#e3d2ab', 45, 110],
    hemi: ['#fff3e0', '#5a5142', 1.35], dir: ['#ffe9c4', 1.2],
    floor: '#c9ab7c', wall: '#e0cfa8', side: '#c9b183', ceil: null,
    accent: '#f6d447', glow: '#7df9c5', lane: '#f3ead6',
    sky: 'day', extras: ['mountains', 'sun', 'clouds', 'cypress', 'jumbo', 'woodcrates', 'stripes'] },
  { id: 'arctic', name: 'Arctic Outpost', desc: 'Snowfield under pale sun.',
    indoor: false, bg: '#bcd0de', fog: ['#d7e4ec', 40, 100],
    hemi: ['#ffffff', '#6a7683', 1.4], dir: ['#eaf4ff', 1.15],
    floor: '#e6edf2', wall: '#cfd9e0', side: '#bcc9d4', ceil: null,
    accent: '#3d7ea6', glow: '#7df9c5', lane: '#5a6a76',
    sky: 'snow', extras: ['mountains', 'sun', 'snowpines', 'icespikes', 'jumbo', 'frostcrates', 'stripes'] },
  { id: 'night', name: 'Night Ops', desc: 'Dark facility, lit trim.',
    indoor: true, bg: '#070c13', fog: ['#070c13', 60, 170],
    hemi: ['#8fa8d8', '#1a2230', 0.85], dir: ['#b8ccf0', 0.7],
    floor: '#161d25', wall: '#101720', side: '#0d1319', ceil: '#080d13',
    accent: '#f6d447', glow: '#7df9c5', lane: '#8a8474',
    sky: 'none', extras: ['pillars', 'racks', 'jumbo', 'sign', 'crates'] },
  { id: 'sunset', name: 'Sunset Courtyard', desc: 'Terracotta dusk, string lights.',
    indoor: false, bg: '#e8956b', fog: ['#e8a06b', 45, 110],
    hemi: ['#ffd9b0', '#4a3a30', 1.25], dir: ['#ff9e57', 1.15],
    floor: '#b98a5e', wall: '#c98f66', side: '#a8764f', ceil: null,
    accent: '#f6d447', glow: '#7df9c5', lane: '#f3e2c2',
    sky: 'dusk', extras: ['mountains', 'lowsun', 'cypress', 'lights', 'jumbo', 'woodcrates', 'stripes'] },
  { id: 'bamboo', name: 'Bamboo Garden', desc: 'Walled green garden, lanterns.',
    indoor: false, bg: '#a8c8b8', fog: ['#b8d0bc', 45, 105],
    hemi: ['#f2ffe8', '#3a4a3a', 1.3], dir: ['#fff2cc', 1.1],
    floor: '#6f7a6a', wall: '#4a5a48', side: '#42503f', ceil: null,
    accent: '#f6d447', glow: '#ffd9a0', lane: '#d8d0b8',
    sky: 'garden', extras: ['bamboo', 'lanterns', 'fireflies', 'jumbo', 'stonecrates', 'stripes'] },
  { id: 'lunar', name: 'Lunar Base', desc: 'Regolith, stars, Earthrise.',
    indoor: false, bg: '#020306', fog: ['#0a0d13', 60, 160],
    hemi: ['#dfe8ff', '#2a2d33', 1.0], dir: ['#ffffff', 1.2],
    floor: '#5a5e63', wall: '#43474d', side: '#3a3e44', ceil: null,
    accent: '#f6d447', glow: '#e8f4ff', lane: '#c8ccd2',
    sky: 'stars', extras: ['earth', 'grayhills', 'jumbo', 'techcrates', 'stripes'] },
  { id: 'abyss', name: 'Abyss Lab', desc: 'Pressurized deep-sea dome.',
    indoor: true, bg: '#06121e', fog: ['#0a2233', 40, 120],
    hemi: ['#9fdcff', '#0a1a26', 1.1], dir: ['#6ab8e8', 0.9],
    floor: '#16283a', wall: '#0f2030', side: '#0c1a28', ceil: '#081420',
    accent: '#f6d447', glow: '#35e0ff', lane: '#7a94a8',
    sky: 'none', extras: ['pillars', 'portholes', 'rays', 'jumbo', 'sign', 'crates'] },
  { id: 'sakura', name: 'Sakura Court', desc: 'Blossom courtyard, torii gate.',
    indoor: false, bg: '#f0c8d8', fog: ['#f2cfdc', 45, 110],
    hemi: ['#fff0f4', '#5a4a52', 1.35], dir: ['#ffe4ec', 1.15],
    floor: '#9a938a', wall: '#d8bfae', side: '#c2a894', ceil: null,
    accent: '#f6d447', glow: '#ff9ecf', lane: '#f3ead6',
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
