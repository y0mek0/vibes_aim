import { boot } from './game.js';
boot();

// ---- app shell: PWA install flow, desktop-only gate, offline service worker ----
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
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
// desktop-only: touch-only devices get the gate instead of a broken trainer
if (matchMedia('(pointer: coarse)').matches && !matchMedia('(pointer: fine)').matches) {
  document.getElementById('deskblock')?.classList.add('on');
}
