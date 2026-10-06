// client/src/bootstrap.js — single entry point that warms the store
// before the UI modules mount. Each panel subscribes to the store, so
// the first render is the real server data, not an empty placeholder.

import { store } from './store.js';

if (typeof window !== 'undefined') {
  // Expose the store globally so legacy game.js render hooks (e.g. the
  // end-of-run Combat Report) can read fresh player/mission state without
  // having to refactor the whole engine into ESM imports.
  window.store = store;
  // Kick off the first refresh. Errors are swallowed (the boot banner
  // already shows a retry/Skip UI when the server is unreachable).
  queueMicrotask(() => { store.refresh().catch(() => {}); });
}
