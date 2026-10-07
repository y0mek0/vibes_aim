// client/js/auth.js — Google sign-in for aim2stock.
//
// Flow:
//   1. Render the official "Sign in with Google" button via Google
//      Identity Services (loaded from accounts.google.com/gsi/client).
//   2. GSI yields an id_token credential.
//   3. We POST the id_token to /auth/google on our backend; the backend
//      verifies it, finds or creates a player, optionally merges the
//      current guest player into it, and returns a session_token.
//   4. We persist session_token in localStorage and re-use it on every
//      /auth/me call to discover the active player.
//   5. On sign-out we forget the token locally and tell the backend to
//      invalidate it.
//
// The class is exposed as a global singleton so the rest of the app can
// reach auth state without an explicit dependency on this file.

import { api } from '../src/api.js?v=20261006-8';

const TOKEN_KEY = 'aim2stock.sessionToken.v1';
const PROFILE_KEY = 'aim2stock.profile.v1';

// Same client_id used in Google Cloud OAuth. The GSI library will only
// work if this origin is in the OAuth client's "Authorized JavaScript
// origins" list. We pass it through a meta tag so the server can also
// validate the aud claim if it wants to.
function readClientId() {
  const meta = document.querySelector('meta[name="google-oauth-client-id"]');
  return (meta && meta.getAttribute('content')) || '';
}

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

function paintAuthUi(state) {
  // Three states: signed-out, signed-in. The header shows at most one
  // icon button (Sign in with Google) OR one icon button (Profile)
  // OR neither. We never show the email or a separate sign-out here
  // — those live in Customize → Profile so the header stays compact.
  const signinBtn = document.getElementById('auth-signin');
  const profileBtn = document.getElementById('auth-profile-btn');
  const profileAccount = document.getElementById('profile-account');
  const profileEmail = document.getElementById('profile-email');
  const signedIn = !!(state && state.player);
  if (signinBtn) signinBtn.hidden = signedIn;
  if (profileBtn) profileBtn.hidden = !signedIn;
  if (profileAccount) profileAccount.hidden = !signedIn;
  if (profileEmail) {
    profileEmail.textContent = state?.profile?.email || state?.player?.email || '—';
  }
}

async function postGoogle(idToken, guestPlayerId) {
  return api.post('/auth/google', { idToken, guestPlayerId: guestPlayerId || undefined });
}

async function postSignOut(sessionToken) {
  try { await api.post('/auth/signout', { sessionToken }); }
  catch (_) { /* offline ok */ }
}

async function getMe(sessionToken) {
  return api.get('/auth/me', { headers: { Authorization: `Bearer ${sessionToken}` } });
}

async function signInWithGooglePopup() {
  if (!window.google || !window.google.accounts || !window.google.accounts.id) {
    throw new Error('Google Identity Services is not loaded yet');
  }
  const clientId = readClientId();
  if (!clientId) {
    throw new Error('Missing <meta name="google-oauth-client-id"> on the page');
  }
  return new Promise((resolve, reject) => {
    try {
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: (resp) => {
          if (resp && resp.credential) resolve(resp.credential);
          else reject(new Error('Google did not return an id_token'));
        },
        cancel_callback: () => reject(new Error('Google sign-in was cancelled')),
        use_fedcm: true,
      });
      window.google.accounts.id.prompt((notification) => {
        if (notification && notification.isNotDisplayed()) {
          // Fallback: render the button so the user has a way to sign in.
          const btn = document.getElementById('auth-signin');
          if (btn) {
            btn.hidden = false;
            window.google.accounts.id.renderButton(btn, {
              type: 'standard',
              theme: 'outline',
              size: 'medium',
              text: 'signin_with',
              shape: 'rectangular',
            });
          }
        }
      });
    } catch (e) {
      reject(e);
    }
  });
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

  // Trigger the popup / FedCM flow, then exchange the id_token with the
  // backend. The optional guestPlayerId arg merges the existing local
  // guest progress into the new Google account.
  async signIn({ guestPlayerId = null } = {}) {
    let idToken;
    try {
      idToken = await signInWithGooglePopup();
    } catch (e) {
      // GIS may be blocked (e.g. test env without internet, or origin
      // not authorized). Surface the error to the caller.
      throw e;
    }
    const res = await postGoogle(idToken, guestPlayerId);
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
    if (token) await postSignOut(token);
  },
};

// Wire the static "Sign in with Google" button to call signIn(). We
// capture the local guest player id (if any) so the backend can merge.
function wireButton() {
  const btn = document.getElementById('auth-signin');
  if (btn) {
    btn.addEventListener('click', async () => {
      btn.disabled = true;
      btn.setAttribute('aria-label', 'Opening Google…');
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
          btn.setAttribute('aria-label', 'Sign in with Google');
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
    });
  } else {
    wireButton();
    paintAuthUi(auth.state);
  }
}
