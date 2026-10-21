// server/src/routes/index.js — mounts all routes on the router.

import { createRouter } from '../router.js';
import { healthRoute } from './health.js';
import { marketRoutes } from './market.js';
import { aimRoutes } from './aim.js';
import { portfolioRoutes } from './portfolio.js';
import { missionsRoutes } from './missions.js';
import { loadoutRoutes } from './loadout.js';
import { authRoutes } from './auth.js';
import { holdingRoutes } from './holding.js';
import { createHoldingService } from '../holding/service.js';

export function mountRoutes({ market, store, config, holding: injectedHolding }) {
  const holding = injectedHolding ?? createHoldingService(config.a2s);
  const r = createRouter();
  healthRoute(r);
  marketRoutes(r, { market });
  aimRoutes(r, { store, config, holding });
  portfolioRoutes(r, { market, store });
  missionsRoutes(r, { store });
  loadoutRoutes(r, { store });
  authRoutes(r, { store, config });
  holdingRoutes(r, { holding });
  return r;
}
