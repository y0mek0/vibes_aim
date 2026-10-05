// server/src/routes/missions.js — 6 missions to unlock NVDA from AAPL.
//
// Missions are computed from store state at claim time (no hidden state).
// Each mission has a `check(state)` that returns { done, progress }.

import { sendJson, HttpError, round } from '../util/json.js';

const MISSION_DEFS = [
  { kind: 'first_10_hits',   label: 'Land 10 aim hits',                target: 10,  reward: 50 },
  { kind: 'earn_half_aapl',  label: 'Earn 0.5 AAPL via aim',          target: 0.5, reward: 250 },
  { kind: 'first_trade',     label: 'Open and close your first trade', target: 1,   reward: 150 },
  { kind: 'first_profit',    label: 'Close a trade in profit',         target: 1,   reward: 200 },
  { kind: 'hold_60s',        label: 'Hold a long position 60 seconds', target: 60,  reward: 200 },
  { kind: 'precise_session', label: 'Reach 70% accuracy in a session', target: 0.7, reward: 350 },
];

export function missionsRoutes(r, { store }) {
  r.get('/missions', async (req, res) => {
    const playerId = req.headers['x-player-id'];
    if (!playerId) throw new HttpError(400, 'missing_player_id');
    const player = await store.getOrCreatePlayer(playerId);
    const state = await readState(playerId, store);
    const out = await Promise.all(MISSION_DEFS.map(async (def) => {
      const m = await store.getMission(playerId, def.kind);
      const { done, progress } = await checkMission(def, state, store);
      if (progress !== m.progress || (done && !m.done)) {
        await store.setMissionProgress(playerId, def.kind, round(progress, 6), done);
      }
      return {
        kind: def.kind, label: def.label, target: def.target, reward: def.reward,
        progress: round(progress, 6), done, claimed: !!m.claimedAt,
      };
    }));
    sendJson(res, 200, { stable: player.stable, missions: out });
  });

  r.post('/missions/claim', async (req, res, _params, _query, body) => {
    const playerId = req.headers['x-player-id'];
    if (!playerId) throw new HttpError(400, 'missing_player_id');
    const { kind } = body || {};
    const def = MISSION_DEFS.find((d) => d.kind === kind);
    if (!def) throw new HttpError(404, 'not_found');
    const state = await readState(playerId, store);
    const { done, progress } = await checkMission(def, state, store);
    if (!done) throw new HttpError(400, 'not_done', `progress ${progress}/${def.target}`);
    // ensure persisted
    await store.setMissionProgress(playerId, def.kind, round(progress, 6), true);
    const claim = await store.claimMission(playerId, def.kind);
    if (!claim.ok) throw new HttpError(400, 'already_claimed');
    const player = await store.addStable(playerId, def.reward);
    // milestone: if all six are claimed, unlock NVDA
    const all = await store.listMissions(playerId);
    const claimedKinds = new Set(all.filter((m) => m.claimedAt).map((m) => m.kind));
    if (MISSION_DEFS.every((d) => claimedKinds.has(d.kind))) {
      await store.unlock(playerId, 'NVDA');
    }
    sendJson(res, 200, { ok: true, kind, reward: def.reward, stable: player.stable });
  });
}

async function readState(playerId, store) {
  const player = await store.getOrCreatePlayer(playerId);
  const trades = await store.listTrades(playerId);
  const balances = await store.getAllBalances(playerId);
  const hits = await store.countHits(playerId);
  const earnedAapl = await store.totalEarnedViaAim(playerId, 'AAPL');
  return {
    trades, balances, hits, earnedAapl,
    // Missing data is a valid state for existing players created before
    // the precision field. It must resolve to zero, never NaN/null.
    preciseBest: Number.isFinite(Number(player.preciseBest)) ? Number(player.preciseBest) : 0,
  };
}

async function checkMission(def, state, store) {
  switch (def.kind) {
    case 'first_10_hits': {
      const n = state.hits;
      return { done: n >= 10, progress: Math.min(n, 10) };
    }
    case 'earn_half_aapl': {
      const earned = state.earnedAapl;
      return { done: earned >= 0.5, progress: Math.min(earned, 0.5) };
    }
    case 'first_trade': {
      const closed = state.trades.filter((t) => t.status !== 'open');
      return { done: closed.length >= 1, progress: Math.min(closed.length, 1) };
    }
    case 'first_profit': {
      const wins = state.trades.filter((t) => t.status === 'closed' && t.pnl > 0);
      return { done: wins.length >= 1, progress: Math.min(wins.length, 1) };
    }
    case 'hold_60s': {
      // "hold 60s" = any long trade that stayed open at least 60s without liquidation.
      // Real 60-second hold: any long trade that stayed open at least
      // 60s without liquidation. See MISTAKES Stage 11 (1.1) for the
      // previous MVP shortcut. The test opens a position, waits 60s, and
      // closes — the only way to satisfy this mission.
      const ok = state.trades.some((t) => t.side === 'long' && t.status === 'closed' && t.closedAt - t.createdAt >= 60_000);
      return { done: ok, progress: ok ? 1 : 0 };
    }
    case 'precise_session': {
      // Real accuracy tracking: the server records the player's
      // best hits/shots ratio in player.preciseBest on every /aim/hit.
      // The mission is satisfied when the player reaches 70% accuracy
      // (across any session of shots they've taken). Guard against
      // undefined -> NaN so the JSON response stays numeric.
      const acc = Number.isFinite(state.preciseBest) ? state.preciseBest : 0;
      return { done: acc >= 0.7, progress: Math.min(acc, 0.7) };
    }
    default:
      return { done: false, progress: 0 };
  }
}

