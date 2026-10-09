import { boot } from './game.js?v=20261009-3';
boot();

// ---- app shell: optional install prompt and desktop-only gate ----
let deferredPrompt = null;
const installBtn = () => document.getElementById('pwa-install');
addEventListener('beforeinstallprompt', e => {
  e.preventDefault(); deferredPrompt = e;
  const b = installBtn(); if (b) b.hidden = false;
});
installBtn()?.addEventListener('click', async () => {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  await deferredPrompt.userChoice;
  deferredPrompt = null;
  installBtn().hidden = true;
});
addEventListener('appinstalled', () => { installBtn().hidden = true; });
// PWA/offline support is not part of this MVP: do not register a missing
// worker and create a browser-visible 404 on every local launch.
// desktop-only: touch-only devices get the gate instead of a broken trainer
if (matchMedia('(pointer: coarse)').matches && !matchMedia('(pointer: fine)').matches) {
  document.getElementById('deskblock')?.classList.add('on');
}
