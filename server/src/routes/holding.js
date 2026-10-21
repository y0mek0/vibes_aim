import { sendJson, HttpError } from '../util/json.js';

export function holdingRoutes(r, { holding }) {
  r.get('/holding/challenge', async (_req, res, _params, query) => {
    try {
      sendJson(res, 200, await holding.challenge(query.wallet));
    } catch (error) {
      throw new HttpError(400, 'invalid_wallet', error.message);
    }
  });

  r.post('/holding/verify', async (_req, res, _params, _query, body) => {
    try {
      sendJson(res, 200, await holding.verify(body || {}));
    } catch (error) {
      throw new HttpError(401, 'wallet_verification_failed', error.message);
    }
  });

  r.get('/holding/status', async (req, res) => {
    const proof = req.headers['x-wallet-proof'];
    const verified = holding.readProof(proof);
    if (!verified) throw new HttpError(401, 'wallet_not_verified', 'Connect and sign the A2S verification message first.');
    try {
      sendJson(res, 200, await holding.getStatus(verified.wallet));
    } catch (error) {
      throw new HttpError(503, 'holding_unavailable', 'A2S holding verification is temporarily unavailable.');
    }
  });
}
