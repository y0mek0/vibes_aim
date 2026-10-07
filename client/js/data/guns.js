// aim2stock arsenal — CS:GO/Warface-inspired names, two-slot loadout.
//
// Each gun now carries:
//   priceStable  — one-time unlock cost in USD stable (charged from
//                  player.stable on first purchase, never again).
//   earnMult     — multiplier applied on /aim/hit so shotguns and snipers
//                  earn more per hit (each hit is a real event) and high-mag
//                  autorifles earn less per shot (spray-and-pray math).
//
// `start` = true means the gun is unlocked by default (no purchase needed).
// Only `usp` (sidearm slot 2) is start:true today; everything else is gated.
//
// Keep GUN_CLASSES in a fixed player-facing order so dropdowns are stable.

export const GUNS = [
  // ---------- Sidearms (slot 2) ----------
  { id:'usp',     name:'USP',     cls:'Sidearm', start:true,  priceStable:0,    earnMult:1.0, mag:12, reserve:24, reload:1.75, equip:0.75, run:5.73,
    mode:'semi', rpm:6.75, pellets:1, bands:[[30,78,26,22],[999,66,22,18]], pen:'Low', silenced:true,
    spread:{hip:0.30, max:0.8, src:'est'}, recoil:{pitch:0.30, yaw:0.08, src:'est'},
    snd:{freq:1800, dur:0.06}, desc:'Default sidearm. Free, silenced. RMB: 3-pellet alt.' },

  { id:'glock',   name:'GLOCK',   cls:'Sidearm', priceStable:0,    earnMult:1.0, mag:20, reserve:120, reload:2.2, equip:0.75, run:5.73,
    mode:'auto', rpm:11.67, pellets:1, bands:[[20,78,26,22],[999,63,21,17]], pen:'Low', silenced:false,
    spread:{hip:0.35, max:0.9, src:'est'}, recoil:{pitch:0.35, yaw:0.12, src:'est'},
    snd:{freq:1700, dur:0.05}, desc:'Full-auto backup. Free secondary. Wild past 20 m.' },

  { id:'p2000',   name:'P2000',   cls:'Sidearm', priceStable:500,  earnMult:1.0, mag:13, reserve:39, reload:1.5, equip:0.75, run:5.73,
    mode:'semi', rpm:6.75, pellets:1, bands:[[30,105,30,25],[999,87,25,21]], pen:'Medium', silenced:true,
    spread:{hip:0.30, max:0.8, src:'est'}, recoil:{pitch:0.30, yaw:0.08, src:'est'},
    snd:{freq:1900, dur:0.06}, desc:'Silenced pistol-round staple. One-taps to the neck.' },

  { id:'fiveseven', name:'FIVE-SEVEN', cls:'Sidearm', priceStable:600,  earnMult:1.0, mag:20, reserve:100, reload:2.0, equip:0.75, run:5.73,
    mode:'semi', rpm:7.5, pellets:1, bands:[[10,152,39,33],[30,128,39,33],[999,112,34,28]], pen:'Medium', silenced:true,
    spread:{hip:0.25, max:0.8, src:'est'}, recoil:{pitch:0.35, yaw:0.08, src:'est'},
    snd:{freq:1800, dur:0.06}, desc:'High-cap precision pistol. 20 in the mag, light recoil.' },

  { id:'deagle',  name:'DESERT EAGLE', cls:'Sidearm', priceStable:800,  earnMult:1.5, mag:7, reserve:35, reload:2.2, equip:1.0, run:5.4,
    mode:'semi', rpm:4, pellets:1, bands:[[30,159,55,46],[999,145,50,42]], pen:'High', silenced:false,
    spread:{hip:0.30, max:0.9, src:'est'}, recoil:{pitch:0.70, yaw:0.10, src:'est'},
    snd:{freq:1100, dur:0.10}, desc:'One-tap headshot under 30 m. 1.5x earn per hit.' },

  { id:'sawed-off', name:'SAWED-OFF', cls:'Sidearm', priceStable:300,  earnMult:3.0, mag:2, reserve:6, reload:1.75, equip:0.75, run:5.4,
    mode:'semi', rpm:3.33, pellets:15, bands:[[7,24,12,10],[15,16,8,6],[999,6,3,2]], pen:'Low', silenced:false,
    spread:{hip:4.0, max:6.0, src:'est'}, recoil:{pitch:0.80, yaw:0.20, src:'est'},
    snd:{freq:900, dur:0.12}, desc:'15 pellets per shell. 3x earn per hit. Falls off past 7 m.' },

  // ---------- SMGs ----------
  { id:'mp9',     name:'MP9',     cls:'SMG', priceStable:1100, earnMult:0.7, mag:30, reserve:120, reload:2.2, equip:0.9, run:5.73,
    mode:'auto', rpm:16, pellets:1, bands:[[15,67,27,22],[999,62,23,21]], pen:'Low', silenced:false,
    spread:{hip:0.65, max:1.5, src:'est'}, recoil:{pitch:0.35, yaw:0.15, src:'est'}, recovery:0.4,
    alt:{kind:'adsburst', count:4, burstsPerSec:2.118, intraRps:18, zoom:1.15, spread:0.5, max:2.74},
    snd:{freq:1600, dur:0.05}, desc:'16 rps hose. ADS: 1.15x + 4-round bursts. 0.7x earn — cheap spray.' },

  { id:'mp5',     name:'MP5',     cls:'SMG', priceStable:1600, earnMult:0.8, mag:30, reserve:120, reload:2.25, equip:0.9, run:5.73,
    mode:'auto', rpm:13.33, pellets:1, bands:[[20,78,26,22],[999,66,22,18]], pen:'Medium', silenced:true,
    spread:{hip:0.25, max:0.9, ads:0.15, src:'est'}, recoil:{pitch:0.30, yaw:0.10, src:'est'}, recovery:0.4,
    snd:{freq:1700, dur:0.05}, desc:'Silenced workhorse SMG. 0.8x earn, easy to farm with.' },

  // ---------- Shotguns ----------
  { id:'nova',    name:'NOVA',    cls:'Shotgun', priceStable:850,  earnMult:3.0, mag:5, reserve:10, reload:2.5, equip:1.0, run:5.06,
    mode:'semi', rpm:1.1, pellets:9, bands:[[8,40,20,17],[12,26,13,11],[999,18,9,7]], pen:'Low', silenced:false,
    spread:{hip:2.0, max:4.0, src:'est'}, recoil:{pitch:0.80, yaw:0.20, src:'est'},
    snd:{freq:800, dur:0.14}, desc:'9 pellets. 3x earn per hit. Slow, devastating at close range.' },

  { id:'xm1014',  name:'XM1014',  cls:'Shotgun', priceStable:1850, earnMult:2.5, mag:5, reserve:15, reload:2.2, equip:1.0, run:5.06,
    mode:'auto', rpm:3.5, pellets:12, bands:[[10,34,17,14],[15,20,10,8],[999,14,7,6]], pen:'Medium', silenced:false,
    spread:{hip:2.5, max:4.0, src:'est'}, recoil:{pitch:0.80, yaw:0.20, src:'est'},
    snd:{freq:850, dur:0.12}, desc:'Full-auto room wiper. 12 pellets, 2.5x earn.' },

  // ---------- Rifles ----------
  { id:'famas',   name:'FAMAS',   cls:'Rifle', priceStable:2050, earnMult:1.0, mag:25, reserve:90, reload:3.1, equip:1.0, run:5.4,
    mode:'auto', rpm:10, adsRpm:10, pellets:1, bands:[[999,115,35,29]], pen:'Medium', silenced:false,
    spread:{hip:0.3, max:1.0, src:'est'}, recoil:{pitch:0.45, yaw:0.15, src:'est'}, recovery:0.35,
    alt:{kind:'adsburst', count:3, burstsPerSec:2.105, intraRps:13.333, zoom:1.25, spread:0.1},
    snd:{freq:1300, dur:0.07}, desc:'Budget rifle. ADS: 1.25x + 3-round bursts.' },

  { id:'sg553',   name:'SG553',   cls:'Rifle', priceStable:2250, earnMult:1.2, mag:30, reserve:90, reload:2.8, equip:1.0, run:5.4,
    mode:'auto', rpm:9.5, adsRpm:9.5, pellets:1, bands:[[999,195,65,49]], pen:'High', silenced:false,
    spread:{hip:0.10, max:0.5, ads:0.06, src:'est'}, recoil:{pitch:0.60, yaw:0.05, src:'est'}, recovery:0.4,
    alt:{kind:'ads', zoom:1.5, rpm:7.625},
    snd:{freq:1200, dur:0.08}, desc:'Semi-auto one-tap machine. 1.2x earn.' },

  { id:'m4a1',    name:'M4A1',    cls:'Rifle', priceStable:2900, earnMult:1.0, mag:30, reserve:90, reload:3.1, equip:1.0, run:5.4,
    mode:'auto', rpm:11, adsRpm:9.9, pellets:1, bands:[[20,156,39,33],[999,140,35,29]], pen:'Medium', silenced:true,
    spread:{hip:0.20, max:0.9, ads:0.11, src:'est'}, recoil:{pitch:0.40, yaw:0.12, src:'est'}, recovery:0.4,
    alt:{kind:'ads', zoom:1.25}, snd:{freq:1400, dur:0.06}, desc:'Silenced spray king. 1.0x earn, top of the meta.' },

  { id:'ak47',    name:'AK-47',   cls:'Rifle', priceStable:2900, earnMult:1.1, mag:30, reserve:90, reload:2.5, equip:1.0, run:5.4,
    mode:'auto', rpm:9.75, adsRpm:8.32, pellets:1, bands:[[999,160,40,34]], pen:'Medium', silenced:false,
    spread:{hip:0.25, max:1.0, ads:0.157, src:'est'}, recoil:{pitch:0.50, yaw:0.18, src:'est'}, recovery:0.4,
    alt:{kind:'ads', zoom:1.25}, snd:{freq:1250, dur:0.07}, desc:'No falloff. One-tap at any range. 1.1x earn.' },

  // ---------- Snipers ----------
  { id:'scout',   name:'SSG 08',  cls:'Sniper', priceStable:950,  earnMult:3.5, mag:10, reserve:90, reload:2.5, reloadPerBullet:0.4, equip:1.25, run:5.4,
    mode:'semi', rpm:1.5, pellets:1, bands:[[999,202,101,85]], pen:'Medium', silenced:false,
    spread:{hip:1.0, max:1.0, scoped:0, src:'est'}, recoil:{pitch:1.20, yaw:0.10, src:'est'},
    snd:{freq:1000, dur:0.12}, desc:'Budget sniper. 3.5x earn per hit. Quick-scope king.' },

  { id:'sg550',   name:'SG 550',  cls:'Sniper', priceStable:2400, earnMult:3.0, mag:5, reserve:30, reload:2.8, equip:1.25, run:5.06,
    mode:'semi', rpm:2.75, pellets:1, bands:[[999,238,140,110]], pen:'High', silenced:false,
    spread:{hip:3.0, max:3.0, scoped:0, src:'est'}, recoil:{pitch:1.50, yaw:0.15, src:'est'},
    snd:{freq:950, dur:0.14}, desc:'Double-tap semi-auto sniper. 3.0x earn.' },

  { id:'awp',     name:'AWP',     cls:'Sniper', priceStable:4700, earnMult:3.5, mag:5, reserve:30, reload:3.7, equip:1.5, run:5.13,
    mode:'semi', rpm:0.6, pellets:1, bands:[[999,255,150,120]], pen:'High', silenced:false,
    spread:{hip:5.0, max:5.0, scoped:0, src:'est'}, recoil:{pitch:2.00, yaw:0.20, src:'est'},
    alt:{kind:'scope', zooms:[2.5, 5], scopeRpm:0.75, scopeMove:0.72},
    snd:{freq:700, dur:0.18}, desc:'One body shot kills. 3.5x earn. The big one.' },

  // ---------- Heavy ----------
  { id:'m249',    name:'M249',    cls:'Heavy', priceStable:1600, earnMult:0.5, mag:100, reserve:200, reload:5.5, equip:1.0, run:5.13,
    mode:'auto', rpm:10, spool:{from:10, to:13, time:1.0}, pellets:1,
    bands:[[30,75,30,25],[999,70,28,23]], pen:'High', silenced:false,
    spread:{hip:0.35, max:1.1, ads:0.20, src:'est'}, recoil:{pitch:0.30, yaw:0.12, src:'est'},
    snd:{freq:1100, dur:0.06}, desc:'100 rounds of area denial. 0.5x earn — spam is cheap.' },

  { id:'negev',   name:'NEGEV',   cls:'Heavy', priceStable:3200, earnMult:0.4, mag:150, reserve:300, reload:6.0, equip:1.1, run:5.13,
    mode:'auto', rpm:12, spool:{from:12, to:15.6, time:1.2}, pellets:1,
    bands:[[30,95,38,32],[999,77,31,26]], pen:'High', silenced:false,
    spread:{hip:0.40, max:1.2, ads:0.22, src:'est'}, recoil:{pitch:0.28, yaw:0.10, src:'est'},
    snd:{freq:1000, dur:0.06}, desc:'150 rounds, spools to 15.6. 0.4x earn — biggest mag, lowest earn.' },
];

// Legacy id -> new id map. Old settings.localStorage may still hold the
// pre-rename ids; we silently migrate on read. Empty (no legacy) in this
// build, kept so the migration helper below has a stable shape.
export const LEGACY_GUN_IDS = {
  classic: 'usp',
  shorty: 'sawed-off',
  frenzy: 'glock',
  ghost: 'p2000',
  bandit: 'fiveseven',
  sheriff: 'deagle',
  stinger: 'mp9',
  spectre: 'mp5',
  bucky: 'nova',
  judge: 'xm1014',
  bulldog: 'famas',
  guardian: 'sg553',
  phantom: 'm4a1',
  vandal: 'ak47',
  marshal: 'scout',
  outlaw: 'sg550',
  operator: 'awp',
  ares: 'm249',
  odin: 'negev',
};

export function resolveGunId(id) {
  if (!id) return id;
  return LEGACY_GUN_IDS[id] || id;
}

export const gunById = id => GUNS.find(g => g.id === resolveGunId(id));
export const GUN_CLASSES = ['Sidearm','SMG','Shotgun','Rifle','Sniper','Heavy'];

// Guns that come unlocked by default (free starter kit). Currently just
// the USP sidearm; everything else is bought with stable earned in-game.
export const STARTER_GUN_IDS = GUNS.filter(g => g.start).map(g => g.id);
