// client/src/bootstrap.js — single entry point that warms the store
// before the UI modules mount. Each panel subscribes to the store, so
// the first render is the real server data, not an empty placeholder.

import { store } from './store.js?v=20261009-1';

if (typeof window !== 'undefined') {
  // Expose the store globally so legacy game.js render hooks (e.g. the
  // end-of-run Combat Report) can read fresh player/mission state without
  // having to refactor the whole engine into ESM imports.
  window.store = store;

  // Re-render the dashboard token cards whenever the store emits. The
  // dashboard cards live in client/js/game.js renderMenuStats(); we
  // invoke it from here so any state change (balance, stable, missions)
  // is reflected without the menu having to be reopened.
  store.subscribe(() => {
    try {
      if (typeof window.renderMenuStats === 'function') window.renderMenuStats();
    } catch (_) { /* game.js may not have booted yet; safe to ignore */ }
  });

  // Kick off the first refresh. Errors are swallowed (the boot banner
  // already shows a retry/Skip UI when the server is unreachable).
  queueMicrotask(() => { store.refresh().catch(() => {}); });
}
