// server/src/routes/loadout.js — one-time gun purchases for stable.
//
// GET  /loadout                -> { owned: [gunId...], catalog: [...] }
// POST /loadout/buy {gunId}    -> debits stable, grants the gun, idempotent
//                                 on repeat calls (already_owned: true).
//
// The server is the only place that mints "you own this gun" and only the
// place that debits stable. The client sends the buy intent; the server
// validates the price, the gun id, the player's balance, and persists.

import { sendJson, HttpError, round } from '../util/json.js';
import { getGun, getGunCatalog, isStarter, GUNS_CATALOG } from '../data/loadout.js';

export function loadoutRoutes(r, { store }) {
  r.get('/loadout', async (req, res, _params, _query, _body) => {
    const playerId = req.headers['x-player-id'];
    if (!playerId) throw new HttpError(400, 'missing_player_id');
    const player = await store.getOrCreatePlayer(playerId);
    const owned = (await store.getOwnedGuns(playerId)).map((e) => e.gunId);
    sendJson(res, 200, {
      player: { id: player.id, stable: player.stable },
      owned,
      catalog: GUNS_CATALOG,
    });
  });

  r.post('/loadout/buy', async (req, res, _params, _query, body) => {
    const playerId = req.headers['x-player-id'];
    if (!playerId) throw new HttpError(400, 'missing_player_id');
    const gunId = String(body?.gunId || '').toLowerCase();
    if (!gunId) throw new HttpError(400, 'missing_gun_id');
    const gun = getGun(gunId);
    if (!gun) throw new HttpError(400, 'unknown_gun', `Unknown gunId: ${gunId}`);
    const player = await store.getOrCreatePlayer(playerId);

    // Starter guns are free and granted automatically on /loadout GET, so
    // a buy attempt for one is treated as idempotent (already_owned).
    if (isStarter(gunId)) {
      const entry = await store.grantGun(playerId, gunId);
      sendJson(res, 200, { ok: true, already_owned: true, gunId, priceStable: 0,
        player: { id: player.id, stable: player.stable } });
      return;
    }

    if (await store.ownsGun(playerId, gunId)) {
      sendJson(res, 200, { ok: true, already_owned: true, gunId, priceStable: gun.priceStable,
        player: { id: player.id, stable: player.stable } });
      return;
    }

    const price = Number(gun.priceStable);
    if (!Number.isFinite(price) || price < 0) {
      throw new HttpError(500, 'bad_price');
    }
    if (player.stable + 1e-9 < price) {
      throw new HttpError(400, 'insufficient_stable', `need ${price.toFixed(2)} stable, have ${player.stable.toFixed(2)}`);
    }
    await store.addStable(playerId, -price);
    const entry = await store.grantGun(playerId, gunId);
    const updated = await store.getOrCreatePlayer(playerId);
    sendJson(res, 200, {
      ok: true, gunId, priceStable: round(price, 6),
      purchasedAt: entry.purchasedAt,
      player: { id: updated.id, stable: updated.stable },
    });
  });
}
