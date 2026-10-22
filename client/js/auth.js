// client/js/auth.js — Privy sign-in for aim2stock.
//
// Privy manages Google and wallet authentication. We exchange its access
// token on our server, which preserves an existing Google-backed player on
// the first Privy login and returns the application's server session.
//
// The class is exposed as a global singleton so the rest of the app can
// reach auth state without an explicit dependency on this file.

import { api } from '../src/api.js?v=20261021-2';

const TOKEN_KEY = 'aim2stock.sessionToken.v1';
const PROFILE_KEY = 'aim2stock.profile.v1';

function safeGet(key) {
  try { return localStorage.getItem(key); } catch { return null; }
}
function safeSet(key, v) {
  try { v == null ? localStorage.removeItem(key) : localStorage.setItem(key, v); } catch { /* noop */ }
}

function emit(state) {
  for (const l of (auth._listeners || [])) {
    try { l(state); } catch (_) { /* swallow */ }
  }
}

function accountLabel(email) {
  const raw = String(email || '').trim();
  const local = raw.split('@')[0].replace(/[._-]+/g, ' ').trim();
  if (!local) return 'Account';
  return local.split(/\s+/).map((part) => part[0]?.toUpperCase() + part.slice(1)).join(' ').slice(0, 18);
}

function paintAuthUi(state) {
  const signinBtn = document.getElementById('auth-signin');
  const profileBtn = document.getElementById('auth-profile-btn');
  const profileAccount = document.getElementById('profile-account');
  const profileEmail = document.getElementById('profile-email');
  const accountAvatar = document.querySelector('[data-auth-avatar]');
  const accountName = document.querySelector('[data-auth-name]');
  const email = state?.profile?.email || state?.player?.email || '';
  const label = accountLabel(email);
  const signedIn = !!(state && state.player);
  if (signinBtn) signinBtn.hidden = signedIn;
  if (profileBtn) {
    profileBtn.hidden = !signedIn;
    profileBtn.title = signedIn ? `Account: ${email || label}` : 'Open account';
    profileBtn.setAttribute('aria-label', signedIn ? `Open account for ${email || label}` : 'Open account');
  }
  if (profileAccount) profileAccount.hidden = !signedIn;
  if (profileEmail) profileEmail.textContent = email || '—';
  if (accountAvatar) accountAvatar.textContent = label.slice(0, 1).toUpperCase() || 'A';
  if (accountName) accountName.textContent = label;
}

async function postPrivy(accessToken, guestPlayerId) {
  return api.post('/auth/privy', { guestPlayerId: guestPlayerId || undefined }, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}

async function postSignOut(sessionToken) {
  try { await api.post('/auth/signout', { sessionToken }); }
  catch (_) { /* offline ok */ }
}

async function getMe(sessionToken) {
  return api.get('/auth/me', { headers: { Authorization: `Bearer ${sessionToken}` } });
}

async function signInWithPrivy() {
  const provider = window.aim2stockPrivy;
  if (!provider || typeof provider.authenticate !== 'function') {
    throw new Error('Privy authentication is not ready yet');
  }
  return provider.authenticate();
}

export const auth = {
  _listeners: new Set(),
  state: { player: null, profile: null, sessionToken: null },
  onChange(fn) { this._listeners.add(fn); return () => this._listeners.delete(fn); },

  // Called by bootstrap.js after the store has hydrated. Decides whether
  // the user is signed in (session token present + /auth/me OK) and
  // surfaces the right UI.
  async restore() {
    const token = safeGet(TOKEN_KEY);
    if (!token) {
      paintAuthUi(null);
      return null;
    }
    this.state.sessionToken = token;
    try {
      const me = await getMe(token);
      this.state.player = me.player;
      this.state.profile = safeGet(PROFILE_KEY) ? JSON.parse(safeGet(PROFILE_KEY)) : null;
      paintAuthUi(this.state);
      emit(this.state);
      return this.state;
    } catch (e) {
      // Token expired or backend rejected — forget it.
      safeSet(TOKEN_KEY, null);
      this.state.sessionToken = null;
      this.state.player = null;
      this.state.profile = null;
      paintAuthUi(null);
      return null;
    }
  },

  // Opens the Privy modal. Users select Google there; the backend then
  // binds the verified Privy user to the existing AIM2STOCK player.
  async signIn({ guestPlayerId = null } = {}) {
    const { accessToken } = await signInWithPrivy();
    const res = await postPrivy(accessToken, guestPlayerId);
    safeSet(TOKEN_KEY, res.sessionToken);
    safeSet(PROFILE_KEY, JSON.stringify({ email: res.player?.email || null }));
    this.state.sessionToken = res.sessionToken;
    this.state.player = res.player;
    this.state.profile = { email: res.player?.email || null };
    paintAuthUi(this.state);
    emit(this.state);
    return res;
  },

  async signOut() {
    const token = this.state.sessionToken;
    this.state.sessionToken = null;
    this.state.player = null;
    this.state.profile = null;
    safeSet(TOKEN_KEY, null);
    safeSet(PROFILE_KEY, null);
    paintAuthUi(null);
    emit(this.state);
    try { await window.aim2stockPrivy?.disconnect?.(); } catch (_) { /* best-effort */ }
    if (token) await postSignOut(token);
  },
};

// Wire the Sign in control to the Privy modal. We capture the local guest
// player id so the backend can merge guest progress into the account.
function wireButton() {
  const btn = document.getElementById('auth-signin');
  if (btn) {
    btn.addEventListener('click', async () => {
      btn.disabled = true;
      btn.setAttribute('aria-label', 'Opening sign in…');
      try {
        // Try to read the current guest playerId from the store so the
        // server can merge balances/missions/loadout into the new account.
        let guestId = null;
        try {
          const s = window.store?.state;
          if (s && !auth.state.player) {
            const stored = JSON.parse(localStorage.getItem('aim2stock.guestSnapshot.v1') || 'null');
            guestId = stored?.player?.id || null;
          }
        } catch (_) { /* noop */ }
        await auth.signIn({ guestPlayerId: guestId });
      } catch (e) {
        console.warn('[auth] sign-in failed:', e && e.message);
        btn.setAttribute('aria-label', 'Sign in failed — retry');
        setTimeout(() => {
          btn.disabled = false;
          btn.setAttribute('aria-label', 'Sign in');
        }, 2000);
      } finally {
        btn.disabled = false;
      }
    });
  }
  // Profile icon: open Customize → Profile. Sign-out lives there.
  const profileBtn = document.getElementById('auth-profile-btn');
  if (profileBtn) {
    profileBtn.addEventListener('click', () => {
      const open = document.getElementById('customize-open');
      if (open) open.click();
      // After the modal opens, switch to the Profile tab.
      requestAnimationFrame(() => {
        const profileTab = document.querySelector('[data-customize-tab="profile"]');
        if (profileTab) profileTab.click();
      });
    });
  }
  // Sign out from the Profile tab. The signed-in email is mirrored into
  // #profile-email when paintAuthUi runs; we also wire the click here
  // so users have a single place to log out.
  const signoutBtn = document.getElementById('auth-signout-profile');
  if (signoutBtn) {
    signoutBtn.addEventListener('click', async () => {
      signoutBtn.disabled = true;
      try { await auth.signOut(); }
      catch (e) { console.warn('[auth] sign-out failed:', e && e.message); }
      finally { signoutBtn.disabled = false; }
    });
  }
}

if (typeof window !== 'undefined') {
  window.auth = auth;
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      wireButton();
      paintAuthUi(auth.state);
      // Restore a persisted Google session on every page load. Without
      // this, a reload after signing in leaves auth.state.player null,
      // so the store never calls setPlayerId() and aim hits keep going
      // to a fresh guest id instead of the Google-backed player.
      auth.restore().catch(() => {});
    });
  } else {
    wireButton();
    paintAuthUi(auth.state);
    auth.restore().catch(() => {});
  }
}
