import { sendJson, HttpError } from '../util/json.js';

function readBearer(req) {
  const header = req.headers.authorization || '';
  const match = /^Bearer\s+(.+)$/i.exec(header);
  return match ? match[1].trim() : '';
}

export function holdingRoutes(r, { holding, privy }) {
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

  r.post('/holding/privy/verify', async (req, res, _params, _query, body) => {
    if (!privy?.config?.enabled) throw new HttpError(503, 'wallet_provider_not_configured', 'Privy wallet verification is not configured.');
    try {
      const verified = await privy.verifyWallet({
        accessToken: readBearer(req),
        wallet: body?.wallet,
      });
      sendJson(res, 200, holding.issuePrivyProof(verified));
    } catch (error) {
      const code = error?.message === 'privy_not_configured' ? 'wallet_provider_not_configured' : 'wallet_provider_verification_failed';
      throw new HttpError(code === 'wallet_provider_not_configured' ? 503 : 401, code, 'Privy wallet verification failed.');
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
