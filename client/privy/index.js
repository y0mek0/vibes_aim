import React, { useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { PrivyProvider, useLinkAccount, useLogin, usePrivy, useWallets } from '@privy-io/react-auth';

const root = document.getElementById('privy-wallet-root');
const appId = document.querySelector('meta[name="privy-app-id"]')?.getAttribute('content')?.trim() || '';
const isLocalHost = ['127.0.0.1', 'localhost'].includes(window.location.hostname);
const canBootPrivy = Boolean(appId) && !isLocalHost;

function shortError(error) {
  return error?.message || 'Privy wallet connection failed.';
}

function WalletBridge() {
  const { ready, authenticated, getAccessToken, logout } = usePrivy();
  const { wallets } = useWallets();
  const pendingRef = useRef(null);
  const loginRef = useRef(null);
  const linkWalletRef = useRef(null);
  const stateRef = useRef({ ready, authenticated, wallets, getAccessToken });

  useEffect(() => {
    stateRef.current = { ready, authenticated, wallets, getAccessToken };
  }, [ready, authenticated, wallets, getAccessToken]);

  const resolveAuthenticated = async () => {
    const accessToken = await stateRef.current.getAccessToken?.();
    if (!accessToken) throw new Error('Privy did not return an access token.');
    return { accessToken };
  };

  const resolveConnected = async () => {
    const state = stateRef.current;
    const wallet = (state.wallets || []).find((item) => item?.chainType === 'ethereum' && item?.address);
    const { accessToken } = await resolveAuthenticated();
    if (!wallet?.address) throw new Error('Privy did not return an authenticated Ethereum wallet.');
    return { wallet: wallet.address, accessToken };
  };

  const settlePending = async () => {
    const pending = pendingRef.current;
    if (!pending || !stateRef.current.authenticated) return;
    const hasEthereumWallet = (stateRef.current.wallets || []).some((item) => item?.chainType === 'ethereum' && item?.address);
    if (pending.kind === 'wallet' && !hasEthereumWallet) {
      if (!pending.linking) {
        pending.linking = true;
        linkWalletRef.current?.();
      }
      return;
    }
    pendingRef.current = null;
    try {
      pending.resolve(pending.kind === 'wallet' ? await resolveConnected() : await resolveAuthenticated());
    } catch (error) { pending.reject(error); }
  };

  const { login } = useLogin({
    onComplete: () => { void settlePending(); },
    onError: (error) => {
      const pending = pendingRef.current;
      pendingRef.current = null;
      if (pending) pending.reject(error);
    },
  });
  loginRef.current = login;

  const { linkWallet } = useLinkAccount({
    onSuccess: () => { void settlePending(); },
    onError: (error) => {
      const pending = pendingRef.current;
      pendingRef.current = null;
      if (pending) pending.reject(error);
    },
  });
  linkWalletRef.current = linkWallet;

  useEffect(() => { void settlePending(); }, [authenticated, wallets, ready]);

  useEffect(() => {
    const beginLogin = (kind) => {
      if (!appId) return Promise.reject(new Error('Privy App ID is not configured.'));
      if (!stateRef.current.ready) return Promise.reject(new Error('Privy wallet provider is still loading.'));
      if (stateRef.current.authenticated && kind !== 'wallet') return resolveAuthenticated();
      return new Promise((resolve, reject) => {
        pendingRef.current = { kind, resolve, reject };
        if (stateRef.current.authenticated) {
          void settlePending();
          return;
        }
        try { loginRef.current?.(); }
        catch (error) {
          pendingRef.current = null;
          reject(error);
        }
      });
    };

    window.aim2stockPrivy = {
      authenticate() { return beginLogin('auth'); },
      connect() { return beginLogin('wallet'); },
      disconnect() { return logout(); },
      isConfigured: Boolean(appId),
    };
    return () => { delete window.aim2stockPrivy; };
  }, [logout]);

  return React.createElement('span', { hidden: true, 'data-privy-ready': ready ? 'true' : 'false' }, shortError);
}

if (!root) {
  console.warn('[privy] wallet bridge root is missing');
} else if (!canBootPrivy) {
  const reason = isLocalHost
    ? 'Privy login is available on the configured production domain only.'
    : 'Privy App ID is not configured.';
  window.aim2stockPrivy = {
    authenticate: () => Promise.reject(new Error(reason)),
    connect: () => Promise.reject(new Error(reason)),
    disconnect: async () => {},
    isConfigured: false,
  };
} else {
  createRoot(root).render(
    React.createElement(
      PrivyProvider,
      {
        appId,
        config: {
          loginMethods: ['google', 'wallet'],
          embeddedWallets: { createOnLogin: 'off' },
        },
      },
      React.createElement(WalletBridge),
    ),
  );
}
