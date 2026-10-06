// server/src/data/loadout.js — server-side mirror of the gun catalog.
//
// The client owns the visual catalog (client/js/data/guns.js) with all the
// art data. The server owns the *purchase contract* — what guns exist,
// what they cost in stable, and what they pay per hit. This file is the
// server copy. If the two ever drift, the server wins (the client never
// charges itself, the server is the only place that debits stable).
//
// Prices are tuned for the earn curve: a decent player nets ~1.4 USD/hr
// with a baseline rifle. Tier 1 weapons (deagle / sawn-off / scout / p2000
// / fiveseven / mp9 / m249) are 10-20 minutes of play, Tier 4 (AWP, AK,
// M4A1, NEGEV) is 1.5-2 hours.

export const GUNS_CATALOG = [
  // ---------- Sidearms ----------
  { id: 'usp',        name: 'USP',          cls: 'Sidearm', start: true,  priceStable: 0,    earnMult: 1.0 },
  { id: 'glock',      name: 'GLOCK',        cls: 'Sidearm', start: false, priceStable: 0,    earnMult: 1.0 },
  { id: 'p2000',      name: 'P2000',        cls: 'Sidearm', start: false, priceStable: 500,  earnMult: 1.0 },
  { id: 'fiveseven',  name: 'FIVE-SEVEN',   cls: 'Sidearm', start: false, priceStable: 600,  earnMult: 1.0 },
  { id: 'deagle',     name: 'DESERT EAGLE', cls: 'Sidearm', start: false, priceStable: 800,  earnMult: 1.5 },
  { id: 'sawed-off',  name: 'SAWED-OFF',    cls: 'Sidearm', start: false, priceStable: 300,  earnMult: 3.0 },

  // ---------- SMGs ----------
  { id: 'mp9',        name: 'MP9',          cls: 'SMG', start: false, priceStable: 1100, earnMult: 0.7 },
  { id: 'mp5',        name: 'MP5',          cls: 'SMG', start: false, priceStable: 1600, earnMult: 0.8 },

  // ---------- Shotguns ----------
  { id: 'nova',       name: 'NOVA',         cls: 'Shotgun', start: false, priceStable: 850,  earnMult: 3.0 },
  { id: 'xm1014',     name: 'XM1014',       cls: 'Shotgun', start: false, priceStable: 1850, earnMult: 2.5 },

  // ---------- Rifles ----------
  { id: 'famas',      name: 'FAMAS',        cls: 'Rifle', start: false, priceStable: 2050, earnMult: 1.0 },
  { id: 'sg553',      name: 'SG553',        cls: 'Rifle', start: false, priceStable: 2250, earnMult: 1.2 },
  { id: 'm4a1',       name: 'M4A1',         cls: 'Rifle', start: false, priceStable: 2900, earnMult: 1.0 },
  { id: 'ak47',       name: 'AK-47',        cls: 'Rifle', start: false, priceStable: 2900, earnMult: 1.1 },

  // ---------- Snipers ----------
  { id: 'scout',      name: 'SSG 08',       cls: 'Sniper', start: false, priceStable: 950,  earnMult: 3.5 },
  { id: 'sg550',      name: 'SG 550',       cls: 'Sniper', start: false, priceStable: 2400, earnMult: 3.0 },
  { id: 'awp',        name: 'AWP',          cls: 'Sniper', start: false, priceStable: 4700, earnMult: 3.5 },

  // ---------- Heavy ----------
  { id: 'm249',       name: 'M249',         cls: 'Heavy', start: false, priceStable: 1600, earnMult: 0.5 },
  { id: 'negev',      name: 'NEGEV',        cls: 'Heavy', start: false, priceStable: 3200, earnMult: 0.4 },
];

const BY_ID = new Map(GUNS_CATALOG.map((g) => [g.id, g]));

export function getGunCatalog() { return GUNS_CATALOG; }
export function getGun(id) { return BY_ID.get(id) || null; }
export function getEarnMult(gunId) {
  // Unknown gunId (or null) -> 1.0 so existing clients don't suddenly stop
  // earning while a deploy rolls out.
  const g = BY_ID.get(gunId);
  return g ? g.earnMult : 1.0;
}
export function isStarter(id) { const g = BY_ID.get(id); return !!(g && g.start); }
