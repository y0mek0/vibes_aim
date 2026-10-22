import { PrivyClient } from '@privy-io/node';
import { getAddress, isAddress } from 'ethers';

function normalizeWallet(wallet) {
  if (!isAddress(wallet)) return null;
  return getAddress(wallet);
}

function linkedAccounts(user) {
  return Array.isArray(user?.linked_accounts)
    ? user.linked_accounts
    : (Array.isArray(user?.linkedAccounts) ? user.linkedAccounts : []);
}

function accountAddress(account) {
  const chainType = account?.chain_type || account?.chainType;
  const type = account?.type;
  if (chainType !== 'ethereum' || (type !== 'wallet' && type !== 'smart_wallet')) return null;
  return normalizeWallet(account?.address);
}

function googleIdentity(user) {
  const account = linkedAccounts(user).find((item) => item?.type === 'google_oauth' && item?.subject);
  return account ? { googleId: account.subject, email: account.email || null } : null;
}

export function createPrivyService(options = {}) {
  const appId = options.appId || '';
  const appSecret = options.appSecret || '';
  let client = null;

  function requireConfig() {
    if (!appId || !appSecret) throw new Error('privy_not_configured');
    if (!client) client = new PrivyClient({ appId, appSecret });
    return client;
  }

  async function verifyAccessToken(accessToken) {
    if (typeof accessToken !== 'string' || !accessToken) throw new Error('invalid_privy_access_token');
    return requireConfig().utils().auth().verifyAccessToken(accessToken);
  }

  async function getUser(userId) {
    if (!userId) throw new Error('invalid_privy_user');
    return requireConfig().users()._get(userId);
  }

  async function verifyGoogleUser(accessToken) {
    const token = await verifyAccessToken(accessToken);
    const user = await getUser(token.user_id);
    const google = googleIdentity(user);
    if (!google) throw new Error('privy_google_not_linked');
    return { ...token, ...google };
  }

  async function verifyWallet({ accessToken, wallet }) {
    const normalized = normalizeWallet(wallet);
    if (!normalized) throw new Error('invalid_privy_wallet_request');
    const token = await verifyAccessToken(accessToken);
    const user = await getUser(token.user_id);
    const owned = linkedAccounts(user).some((account) => accountAddress(account) === normalized);
    if (!owned) throw new Error('privy_wallet_not_linked');

    return {
      wallet: normalized,
      privyUserId: token.user_id,
      sessionId: token.session_id,
      expiresAt: token.expiration * 1000,
    };
  }

  return {
    verifyAccessToken,
    getUser,
    verifyGoogleUser,
    verifyWallet,
    config: { enabled: Boolean(appId && appSecret) },
  };
}
