// VALORANT arsenal — game-data values (Liquipedia / wiki.playvalorant.com / Riot).
// bands: [maxRangeExclusive_m, head, body, leg], ascending. Use 999 = no falloff.
// src: 'data' = from game files/wikis, 'est' = community estimate (shown in codex).
// See DATA_SOURCES.md for the full provenance table.

export const GUNS = [
{ id:'classic', name:'CLASSIC', cls:'Sidearm', price:0, mag:12, reserve:36, reload:1.75, equip:0.75, run:5.73,
  mode:'semi', rpm:6.75, pellets:1, bands:[[30,78,26,22],[999,66,22,18]], pen:'Low', silenced:false,
  spread:{hip:0.4, max:0.9, src:'data'}, recoil:{pitch:0.40, yaw:0.10, src:'est'},
  alt:{kind:'shotgun', pellets:3, rpm:2.22, spread:2.2},
  snd:{freq:1500, dur:0.07}, desc:'Free sidearm. RMB: 3 pellets instantly, 2.22/s.' },

{ id:'shorty', name:'SHORTY', cls:'Sidearm', price:300, mag:2, reserve:6, reload:1.75, equip:0.75, run:5.4,
  mode:'semi', rpm:3.33, pellets:15, bands:[[7,24,12,10],[15,16,8,6],[999,6,3,2]], pen:'Low', silenced:false,
  spread:{hip:4.0, max:6.0, src:'data'}, recoil:{pitch:0.80, yaw:0.20, src:'est'}, alt:null,
  snd:{freq:900, dur:0.12}, desc:'15 pellets per shell. Falls off hard past 7 m.' },

{ id:'frenzy', name:'FRENZY', cls:'Sidearm', price:450, mag:15, reserve:45, reload:1.5, equip:0.75, run:5.73,
  mode:'auto', rpm:10, pellets:1, bands:[[20,78,26,22],[999,63,21,17]], pen:'Low', silenced:false,
  spread:{hip:0.35, max:0.9, src:'est'}, recoil:{pitch:0.35, yaw:0.12, src:'est'}, alt:null,
  snd:{freq:1700, dur:0.06}, desc:'Full-auto eco shredder. Wild past 20 m.' },

{ id:'ghost', name:'GHOST', cls:'Sidearm', price:500, mag:13, reserve:39, reload:1.5, equip:0.75, run:5.73,
  mode:'semi', rpm:6.75, pellets:1, bands:[[30,105,30,25],[999,87,25,21]], pen:'Medium', silenced:true,
  spread:{hip:0.30, max:0.8, src:'est'}, recoil:{pitch:0.30, yaw:0.08, src:'est'}, alt:null,
  snd:{freq:1900, dur:0.06}, desc:'Silenced pistol-round staple. One-taps unarmored.' },

{ id:'bandit', name:'BANDIT', cls:'Sidearm', price:600, mag:8, reserve:24, reload:1.6, equip:0.75, run:5.73,
  mode:'semi', rpm:5.1, pellets:1, bands:[[10,152,39,33],[30,128,39,33],[999,112,34,28]], pen:'Medium', silenced:true,
  spread:{hip:0.25, max:0.8, src:'est'}, recoil:{pitch:0.35, yaw:0.08, src:'est'}, alt:null,
  snd:{freq:1800, dur:0.06}, desc:'2026 precision pistol. One-taps light shields <10 m.' },

{ id:'sheriff', name:'SHERIFF', cls:'Sidearm', price:800, mag:6, reserve:18, reload:2.25, equip:1.0, run:5.4,
  mode:'semi', rpm:4, pellets:1, bands:[[30,159,55,46],[999,145,50,42]], pen:'High', silenced:false,
  spread:{hip:0.30, max:0.9, src:'est'}, recoil:{pitch:0.70, yaw:0.10, src:'est'}, alt:null,
  snd:{freq:1100, dur:0.10}, desc:'One-tap headshot under 30 m. High wall pen.' },

{ id:'stinger', name:'STINGER', cls:'SMG', price:1100, mag:20, reserve:60, reload:2.25, equip:0.9, run:5.73,
  mode:'auto', rpm:16, pellets:1, bands:[[15,67,27,22],[999,62,23,21]], pen:'Low', silenced:false,
  spread:{hip:0.65, crouch:0.55, max:1.5, walk:1, run:2.5, air:5, crouchMove:0.15, src:'data'},
  recoil:{pitch:0.35, yaw:0.15, src:'est'}, recovery:0.4,
  alt:{kind:'adsburst', count:4, burstsPerSec:2.118, intraRps:18, zoom:1.15, spread:0.5, max:2.74},
  snd:{freq:1600, dur:0.05}, desc:'16 rps hose. ADS: 1.15x + 4-round bursts.' },

{ id:'spectre', name:'SPECTRE', cls:'SMG', price:1600, mag:30, reserve:90, reload:2.25, equip:0.9, run:5.73,
  mode:'auto', rpm:13.33, adsRpm:12, pellets:1, bands:[[20,78,26,22],[999,66,22,18]], pen:'Medium', silenced:true,
  spread:{hip:0.25, max:0.9, ads:0.15, src:'est'}, recoil:{pitch:0.30, yaw:0.10, src:'est'}, runRecoilMult:1.8, recovery:0.4,
  alt:{kind:'ads', zoom:1.15}, snd:{freq:1700, dur:0.05}, desc:'Silenced half-buy king. ADS 1.15x.' },

{ id:'bucky', name:'BUCKY', cls:'Shotgun', price:850, mag:5, reserve:10, reload:2.5, equip:1.0, run:5.06,
  mode:'semi', rpm:1.1, pellets:9, bands:[[8,40,20,17],[12,26,13,11],[999,18,9,7]], pen:'Low', silenced:false,
  spread:{hip:2.0, max:4.0, src:'est'}, recoil:{pitch:0.80, yaw:0.20, src:'est'},
  alt:{kind:'slug', pellets:5, rpm:1.1, spread:0.8},
  snd:{freq:800, dur:0.14}, desc:'9 pellets. RMB: 5-pellet tight slug for mid range.' },

{ id:'judge', name:'JUDGE', cls:'Shotgun', price:1850, mag:5, reserve:15, reload:2.2, equip:1.0, run:5.06,
  mode:'auto', rpm:3.5, pellets:12, bands:[[10,34,17,14],[15,20,10,8],[999,14,7,6]], pen:'Medium', silenced:false,
  spread:{hip:2.5, max:4.0, walk:1, run:2, air:4, crouchMove:0.5, src:'data'}, recoil:{pitch:0.80, yaw:0.20, src:'est'}, alt:null,
  snd:{freq:850, dur:0.12}, desc:'Full-auto room wiper. 12 pellets a shell.' },

{ id:'bulldog', name:'BULLDOG', cls:'Rifle', price:2050, mag:24, reserve:72, reload:2.5, equip:1.0, run:5.4,
  mode:'auto', rpm:10, pellets:1, bands:[[999,115,35,29]], pen:'Medium', silenced:false,
  spread:{hip:0.3, max:1.0, src:'data'}, recoil:{pitch:0.45, yaw:0.15, src:'est'}, recovery:0.35,
  alt:{kind:'adsburst', count:3, burstsPerSec:2.105, intraRps:13.333, zoom:1.25, spread:0.1},
  snd:{freq:1300, dur:0.07}, desc:'Budget rifle. ADS: 1.25x + 3-round bursts.' },

{ id:'guardian', name:'GUARDIAN', cls:'Rifle', price:2250, mag:12, reserve:36, reload:2.5, equip:1.0, run:5.4,
  mode:'semi', rpm:5.25, pellets:1, bands:[[999,195,65,49]], pen:'High', silenced:false,
  spread:{hip:0.10, max:0.5, ads:0.06, src:'est'}, recoil:{pitch:0.60, yaw:0.05, src:'est'},
  alt:{kind:'ads', zoom:1.5, rpm:4.275},
  snd:{freq:1200, dur:0.08}, desc:'Semi-auto one-tap machine at ANY range. ADS 1.5x.' },

{ id:'phantom', name:'PHANTOM', cls:'Rifle', price:2900, mag:30, reserve:90, reload:2.5, equip:1.0, run:5.4,
  mode:'auto', rpm:11, adsRpm:9.9, pellets:1, bands:[[20,156,39,33],[999,140,35,29]], pen:'Medium', silenced:true,
  spread:{hip:0.20, crouch:0.17, max:0.9, ads:0.11, walk:3, run:6, air:10, crouchMove:0.8, src:'data'},
  recoil:{pitch:0.40, yaw:0.12, src:'est'}, runRecoilMult:1.8, recovery:0.4,
  alt:{kind:'ads', zoom:1.25}, snd:{freq:1400, dur:0.06}, desc:'Silenced spray king. Falls off past 20 m.' },

{ id:'vandal', name:'VANDAL', cls:'Rifle', price:2900, mag:25, reserve:75, reload:2.5, equip:1.0, run:5.4,
  mode:'auto', rpm:9.75, adsRpm:8.32, pellets:1, bands:[[999,160,40,34]], pen:'Medium', silenced:false,
  spread:{hip:0.25, max:1.0, ads:0.157, src:'data'}, recoil:{pitch:0.50, yaw:0.18, src:'est'}, runRecoilMult:1.8, recovery:0.4,
  alt:{kind:'ads', zoom:1.25}, snd:{freq:1250, dur:0.07}, desc:'No falloff. One-tap at any range.' },

{ id:'marshal', name:'MARSHAL', cls:'Sniper', price:950, mag:5, reserve:15, reload:2.5, reloadPerBullet:0.5, equip:1.25, run:5.4,
  mode:'semi', rpm:1.5, pellets:1, bands:[[999,202,101,85]], pen:'Medium', silenced:false,
  spread:{hip:1.0, max:1.0, scoped:0, src:'data'}, recoil:{pitch:1.20, yaw:0.10, src:'est'},
  alt:{kind:'scope', zooms:[3.5], scopeRpm:1.2, scopeMove:0.9},
  snd:{freq:1000, dur:0.12}, desc:'Budget sniper. Scoped: perfect accuracy, 3.5x.' },

{ id:'outlaw', name:'OUTLAW', cls:'Sniper', price:2400, mag:2, reserve:10, reload:3.8, equip:1.25, run:5.06,
  mode:'semi', rpm:2.75, pellets:1, bands:[[999,238,140,110]], pen:'High', silenced:false,
  spread:{hip:3.0, max:3.0, scoped:0, src:'est'}, recoil:{pitch:1.50, yaw:0.15, src:'est'},
  alt:{kind:'scope', zooms:[3.5], scopeRpm:2.2, scopeMove:0.85},
  snd:{freq:950, dur:0.14}, desc:'Double-tap sniper. 140 body — breaks shields.' },

{ id:'operator', name:'OPERATOR', cls:'Sniper', price:4700, mag:5, reserve:10, reload:3.7, equip:1.5, run:5.13,
  mode:'semi', rpm:0.6, pellets:1, bands:[[999,255,150,120]], pen:'High', silenced:false,
  spread:{hip:5.0, max:5.0, scoped:0, src:'data'}, recoil:{pitch:2.00, yaw:0.20, src:'est'},
  alt:{kind:'scope', zooms:[2.5,5], scopeRpm:0.75, scopeMove:0.72},
  snd:{freq:700, dur:0.18}, desc:'One body shot kills through heavy. 2.5x/5x scope.' },

{ id:'ares', name:'ARES', cls:'Heavy', price:1600, mag:50, reserve:100, reload:3.25, equip:1.0, run:5.13,
  mode:'auto', rpm:10, spool:{from:10, to:13, time:1.0}, adsRpm:13, pellets:1,
  bands:[[30,75,30,25],[999,70,28,23]], pen:'High', silenced:false,
  spread:{hip:0.35, max:1.1, ads:0.20, src:'est'}, recoil:{pitch:0.30, yaw:0.12, src:'est'},
  alt:{kind:'ads', zoom:1.15}, snd:{freq:1100, dur:0.06}, desc:'Spools 10→13 rps. Wallbang hose.' },

{ id:'odin', name:'ODIN', cls:'Heavy', price:3200, mag:100, reserve:200, reload:5.0, equip:1.1, run:5.13,
  mode:'auto', rpm:12, spool:{from:12, to:15.6, time:1.2}, adsRpm:15.6, pellets:1,
  bands:[[30,95,38,32],[999,77,31,26]], pen:'High', silenced:false,
  spread:{hip:0.40, max:1.2, ads:0.22, src:'est'}, recoil:{pitch:0.28, yaw:0.10, src:'est'},
  alt:{kind:'ads', zoom:1.15}, snd:{freq:1000, dur:0.06}, desc:'100 rounds of area denial. Spools to 15.6.' },

];

export const gunById = id => GUNS.find(g => g.id === id);
export const GUN_CLASSES = ['Sidearm','SMG','Shotgun','Rifle','Sniper','Heavy'];
