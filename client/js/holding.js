// A2S Holding page controller. The policy table is deterministic and renders
// even when no wallet is connected; live wallet state can hydrate the status cards.

import { api, setWalletProof, getWalletProofValue } from '../src/api.js?v=20261021-2';
import {
  HOLDING_AMOUNT_TIERS,
  HOLDING_TIME_TIERS,
  getHoldingMatrix,
  getHoldingMultiplier,
  getNextHoldingTier,
  formatHoldingBalance,
  formatHoldingMultiplier,
} from './data/holding.js?v=20261021-2';

const root = document.getElementById('vibes-holding');
if (!root) throw new Error('A2S Holding root is missing');

const esc = (value) => String(value).replace(/[&<>"']/g, (char) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[char]));

const shortAddress = (value) => value ? `${value.slice(0, 6)}…${value.slice(-4)}` : 'Not connected';

function setWalletUi(address, busy = false) {
  const button = root.querySelector('[data-holding-connect]');
  const addressEl = root.querySelector('[data-holding-wallet-address]');
  if (addressEl) addressEl.textContent = shortAddress(address);
  if (button) {
    button.disabled = busy;
    button.textContent = busy ? 'Verifying…' : (address ? 'Refresh holding' : 'Connect wallet');
  }
}

async function connectWallet() {
  const provider = window.aim2stockPrivy;
  if (!provider || typeof provider.connect !== 'function') {
    throw new Error('Privy wallet provider is not configured yet.');
  }
  const connected = await provider.connect();
  const verified = await api.post('/holding/privy/verify', { wallet: connected.wallet }, {
    headers: { Authorization: `Bearer ${connected.accessToken}` },
  });
  setWalletProof(verified.walletProof);
  setWalletUi(verified.wallet);
  render(await api.get('/holding/status'));
}

async function refreshHolding() {
  if (!getWalletProofValue()) return;
  try {
    const status = await api.get('/holding/status');
    setWalletUi(status.wallet);
    render(status);
  } catch {
    setWalletProof(null);
    setWalletUi(null);
    render(null);
  }
}

async function onConnectClick() {
  const button = root.querySelector('[data-holding-connect]');
  if (button) button.disabled = true;
  try { await connectWallet(); }
  catch (error) {
    const copy = root.querySelector('[data-holding-wallet-copy]');
    if (copy) copy.textContent = error?.message || 'Wallet verification failed.';
  }
  finally { if (button) button.disabled = false; }
}

function renderTable() {
  const body = root.querySelector('[data-holding-matrix-body]');
  if (!body) return;
  body.innerHTML = getHoldingMatrix().map((row) => `
    <tr data-holding-balance-row="${row.min}">
      <th scope="row"><span>${esc(row.label)}</span><small>${row.min === 0 ? 'starting tier' : 'A2S held'}</small></th>
      ${row.values.map((value, index) => `<td data-holding-cell="${row.min}-${HOLDING_TIME_TIERS[index].days}">${formatHoldingMultiplier(value)}</td>`).join('')}
    </tr>
  `).join('');
}

function setStatus(status) {
  const state = status || {};
  const balance = Number(state.balance);
  const heldDays = Number(state.heldDays);
  const hasLiveState = Number.isFinite(balance) && Number.isFinite(heldDays) && balance >= 0 && heldDays >= 0;
  const amountEl = root.querySelector('[data-holding-current-balance]');
  const daysEl = root.querySelector('[data-holding-current-days]');
  const multiplierEl = root.querySelector('[data-holding-current-multiplier]');
  const statusEl = root.querySelector('[data-holding-wallet-status]');
  const nextEl = root.querySelector('[data-holding-next]');
  const copyEl = root.querySelector('[data-holding-wallet-copy]');

  if (!hasLiveState) {
    if (amountEl) amountEl.textContent = '—';
    if (daysEl) daysEl.textContent = '—';
    if (multiplierEl) multiplierEl.textContent = '—';
    if (statusEl) statusEl.textContent = 'Wallet not connected';
    if (nextEl) nextEl.textContent = 'Connect a wallet to verify your A2S holding.';
    if (copyEl) copyEl.textContent = 'Connect your Robinhood Chain wallet to read the A2S balance and holding timer.';
    root.dataset.holdingLive = 'false';
    return;
  }

  const multiplier = getHoldingMultiplier(balance, heldDays);
  const next = getNextHoldingTier(balance, heldDays);
  if (amountEl) amountEl.textContent = `${formatHoldingBalance(balance)} A2S`;
  if (daysEl) daysEl.textContent = `${Math.floor(heldDays)} days held`;
  if (multiplierEl) multiplierEl.textContent = formatHoldingMultiplier(multiplier);
  if (statusEl) statusEl.textContent = 'Holding verified on-chain';
  if (nextEl) {
    const amount = next.nextAmount ? `${next.nextAmount.label} A2S` : null;
    const time = next.nextTime ? next.nextTime.label : null;
    nextEl.textContent = amount && time ? `Next tier: ${amount} held for ${time}.` : 'Maximum holding tier reached.';
  }
  if (copyEl) copyEl.textContent = `Checked ${new Date(status.checkedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}. Reward multiplier is calculated by the server.`;
  root.dataset.holdingLive = 'true';
}

function updateCurrentCell(status) {
  root.querySelectorAll('[data-holding-cell]').forEach((cell) => cell.classList.remove('is-current'));
  const balance = Number(status?.balance);
  const heldDays = Number(status?.heldDays);
  if (!Number.isFinite(balance) || !Number.isFinite(heldDays)) return;
  let amount = HOLDING_AMOUNT_TIERS[0];
  for (const tier of HOLDING_AMOUNT_TIERS) {
    if (balance >= tier.min) amount = tier;
    else break;
  }
  let time = HOLDING_TIME_TIERS[0];
  for (const tier of HOLDING_TIME_TIERS) {
    if (heldDays >= tier.days) time = tier;
    else break;
  }
  root.querySelector(`[data-holding-cell="${amount.min}-${time.days}"]`)?.classList.add('is-current');
}

function render(status) {
  setStatus(status);
  updateCurrentCell(status);
}

renderTable();
render(null);
root.querySelector('[data-holding-connect]')?.addEventListener('click', onConnectClick);
void refreshHolding();

window.aim2stockHolding = Object.freeze({ render, getHoldingMultiplier, refresh: refreshHolding });
