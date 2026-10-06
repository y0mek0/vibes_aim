// server/src/routes/index.js — mounts all routes on the router.

import { createRouter } from '../router.js';
import { healthRoute } from './health.js';
import { marketRoutes } from './market.js';
import { aimRoutes } from './aim.js';
import { portfolioRoutes } from './portfolio.js';
import { missionsRoutes } from './missions.js';
import { loadoutRoutes } from './loadout.js';
import { authRoutes } from './auth.js';

export function mountRoutes({ market, store, config }) {
  const r = createRouter();
  healthRoute(r);
  marketRoutes(r, { market });
  aimRoutes(r, { store, config });
  portfolioRoutes(r, { market, store });
  missionsRoutes(r, { store });
  loadoutRoutes(r, { store });
  authRoutes(r, { store, config });
  return r;
}
