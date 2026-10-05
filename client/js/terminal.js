// client/js/terminal.js — the trading terminal UI. Thin shell over
// client/src/store.js (the network) and client/src/terminal-core.js
// (the math). Renders the portfolio, the open order ticket, the open
// positions, and the trade history. Auto-mounts if a #vibes-terminal
// element is in the DOM.

import { store } from '../src/store.js';
import {
  MAX_LEVERAGE, clampLeverage, clampNotional, round2, round6,
  computeOrder, computeClosePreview, portfolioValue, formatPnl,
  sortTradesNewest,
} from '../src/terminal-core.js';

const SELECTORS = {
  root:          '#vibes-terminal',
  balance:       '[data-vt-balance]',
  portfolioVal:  '[data-vt-portfolio-value]',
  portfolioTotal:'[data-vt-portfolio-total]',
  openPnl:       '[data-vt-open-pnl]',
  holdings:      '[data-vt-holdings]',
  positionsBody: '[data-vt-positions-body]',
  historyBody:   '[data-vt-history-body]',
  marketTicker:  '[data-vt-market-ticker]',
  marketPrice:   '[data-vt-market-price]',
  otTicker:      '[data-vt-ot-ticker]',
  otSide:        '[data-vt-ot-side]',
  otNotional:    '[data-vt-ot-notional]',
  otLeverage:    '[data-vt-ot-leverage]',
  otLeverageNum: '[data-vt-ot-leverage-num]',
  otEntry:       '[data-vt-ot-entry]',
  otLiq:         '[data-vt-ot-liq]',
  otMargin:      '[data-vt-ot-margin]',
  otNotionalTotal:'[data-vt-ot-notional-total]',
  otStatus:      '[data-vt-ot-status]',
  otPreview:     '[data-vt-ot-preview]',
  otConfirm:     '[data-vt-ot-confirm]',
  otClose:       '[data-vt-ot-cancel]',
  otConfirmChk:  '[data-vt-ot-confirm-chk]',
  otSubmit:      '[data-vt-ot-submit]',
};

function setText(el, value) { if (el) el.textContent = value; }
function setClass(el, cls, on) { if (el) el.classList.toggle(cls, !!on); }

export function mountTerminal({ root, onClose } = {}) {
  const panel = root || document.querySelector(SELECTORS.root);
  if (!panel) return { unmount() {}, state: null };

  const els = {};
  for (const [k, sel] of Object.entries(SELECTORS)) els[k] = panel.querySelector(sel);
  // Do NOT auto-show the panel. The bottom-left tab opens it on demand.
  // Showing on mount would cover the engine menu and the chart panel.

  const state = {
    ticker: 'AAPL',
    side: 'long',
    leverage: 1,
    notional: 100,
    entryPrice: 0,
    confirming: false,
    lastPreview: null,
  };

  function fmtMoney(n) { return Number.isFinite(n) ? round2(n).toFixed(2) : '—'; }

  function renderHoldings(balances) {
    if (!els.holdings) return;
    els.holdings.innerHTML = '';
    const tickers = Object.keys(balances || {}).sort();
    if (tickers.length === 0) {
      const tr = document.createElement('tr');
      tr.innerHTML = '<td colspan="2" class="vt-empty">No holdings yet — land aim hits to farm assets.</td>';
      els.holdings.appendChild(tr);
      return;
    }
    for (const t of tickers) {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td class="num">${t}</td><td class="num">${Number(balances[t] || 0).toFixed(8)}</td>`;
      els.holdings.appendChild(tr);
    }
  }

  function renderPositions(trades) {
    if (!els.positionsBody) return;
    els.positionsBody.innerHTML = '';
    const open = (trades || []).filter((t) => t.status === 'open');
    if (open.length === 0) {
      const tr = document.createElement('tr');
      tr.innerHTML = '<td colspan="6" class="vt-empty">No open positions.</td>';
      els.positionsBody.appendChild(tr);
      return;
    }
    for (const t of open) {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td class="num">${t.ticker}</td>
        <td class="num">${t.side}</td>
        <td class="num">${t.leverage}x</td>
        <td class="num">${fmtMoney(t.entryPrice)}</td>
        <td class="num">${fmtMoney(t.liquidationPrice)}</td>
        <td><button type="button" data-vt-close="${t.id}" class="vt-btn vt-btn-ghost">Close</button></td>
      `;
      els.positionsBody.appendChild(tr);
    }
    // Wire close buttons
    els.positionsBody.querySelectorAll('[data-vt-close]').forEach((btn) => {
      btn.addEventListener('click', () => closePosition(btn.dataset.vtClose));
    });
  }

  function renderHistory(trades) {
    if (!els.historyBody) return;
    els.historyBody.innerHTML = '';
    const sorted = sortTradesNewest(trades);
    if (sorted.length === 0) {
      const tr = document.createElement('tr');
      tr.innerHTML = '<td colspan="7" class="vt-empty">No closed trades yet.</td>';
      els.historyBody.appendChild(tr);
      return;
    }
    for (const t of sorted.slice(0, 20)) {
      const tr = document.createElement('tr');
      const pnl = formatPnl(t.pnl);
      const status = t.status === 'liquidated' ? '<span class="vt-status liquidated">liquidated</span>' : `<span class="vt-status closed">${t.status}</span>`;
      tr.innerHTML = `
        <td class="num">${t.ticker}</td>
        <td class="num">${t.side}</td>
        <td class="num">${t.leverage}x</td>
        <td class="num">${fmtMoney(t.entryPrice)}</td>
        <td class="num">${t.exitPrice != null ? fmtMoney(t.exitPrice) : '—'}</td>
        <td class="num ${pnl.cls}">${pnl.text}</td>
        <td>${status}</td>
      `;
      els.historyBody.appendChild(tr);
    }
  }

  async function refreshQuote() {
    try {
      const q = await store.fetchQuote(state.ticker);
      if (q && q.price != null) {
        state.entryPrice = q.price;
        setText(els.otEntry, fmtMoney(q.price));
        setText(els.marketTicker, state.ticker);
        setText(els.marketPrice, fmtMoney(q.price));
        document.querySelectorAll(`[data-vt-watch-price="${state.ticker}"]`).forEach((el) => { el.textContent = fmtMoney(q.price); });
        renderPreview();
      } else if (q && q.status === 'pre_ipo') {
        state.entryPrice = 0;
        setText(els.otEntry, '—');
        setText(els.marketPrice, '—');
        document.querySelectorAll(`[data-vt-watch-price="${state.ticker}"]`).forEach((el) => { el.textContent = '—'; });
        setText(els.otLiq, '—');
        setText(els.otMargin, '—');
        setText(els.otNotionalTotal, '—');
        if (els.otStatus) els.otStatus.textContent = 'AWAITING MARKET — no price';
        if (els.otSubmit) els.otSubmit.disabled = true;
      }
    } catch (_) { /* keep last good price */ }
  }

  function renderPreview() {
    const player = store.state.player || { stable: 0 };
    const preview = computeOrder({
      side: state.side,
      leverage: state.leverage,
      notional: state.notional,
      entryPrice: state.entryPrice,
      balance: player.stable,
    });
    state.lastPreview = preview;
    if (!preview.ok) {
      setText(els.otLiq, '—');
      setText(els.otMargin, '—');
      setText(els.otNotionalTotal, '—');
      if (els.otStatus) els.otStatus.textContent = preview.error;
      if (els.otSubmit) els.otSubmit.disabled = true;
      return;
    }
    setText(els.otLiq, fmtMoney(preview.liquidationPrice));
    setText(els.otMargin, fmtMoney(preview.margin));
    setText(els.otNotionalTotal, fmtMoney(preview.notional));
    if (els.otStatus) {
      if (!preview.marginOk) {
        els.otStatus.textContent = `Insufficient Stable: need ${fmtMoney(preview.margin)}, have ${fmtMoney(player.stable)}`;
        els.otStatus.classList.add('neg');
      } else {
        els.otStatus.textContent = `OK — entry ${fmtMoney(preview.entry)}, liquidates at ${fmtMoney(preview.liquidationPrice)}`;
        els.otStatus.classList.remove('neg');
      }
    }
    if (els.otSubmit) els.otSubmit.disabled = !preview.marginOk || state.entryPrice === 0;
  }

  function renderDashboard(player, v) {
    const put = (selector, value) => document.querySelectorAll(selector).forEach((el) => { el.textContent = value; });
    put('[data-dashboard-stable]', fmtMoney(player.stable));
    put('[data-dashboard-portfolio-total]', fmtMoney(v.total));
    put('[data-dashboard-today]', v.openPnl > 0 ? '+' + fmtMoney(v.openPnl) : fmtMoney(v.openPnl));
  }

  function renderPortfolio() {
    const player = store.state.player;
    if (!player) return;
    setText(els.balance, fmtMoney(player.stable));
    // Build a quick price map from the last seen entry prices of open positions,
    // plus the most recent /quote cache. For a real-time value we'd subscribe
    // to the chart panel; here we approximate.
    const priceMap = {};
    for (const t of store.state.trades || []) {
      if (t.status === 'open' && state.entryPrice && t.ticker === state.ticker) {
        priceMap[t.ticker] = state.entryPrice;
      }
    }
    if (!priceMap[state.ticker] && state.entryPrice) priceMap[state.ticker] = state.entryPrice;
    const v = portfolioValue(player, store.state.balances, store.state.trades, priceMap);
    setText(els.portfolioVal, fmtMoney(v.holdingsValue));
    setText(els.portfolioTotal, fmtMoney(v.total));
    setText(els.openPnl, formatPnl(v.openPnl).text);
    setClass(els.openPnl, 'pos', v.openPnl > 0);
    setClass(els.openPnl, 'neg', v.openPnl < 0);
    renderDashboard(player, v);
  }

  function refreshAll() {
    renderPortfolio();
    renderHoldings(store.state.balances);
    renderPositions(store.state.trades);
    renderHistory(store.state.trades);
  }

  async function submitOrder() {
    if (!state.lastPreview || !state.lastPreview.ok) return;
    if (els.otConfirmChk && !els.otConfirmChk.checked) {
      if (els.otStatus) els.otStatus.textContent = 'Tick "I understand the liquidation price" to confirm.';
      return;
    }
    if (els.otSubmit) els.otSubmit.disabled = true;
    if (els.otStatus) els.otStatus.textContent = 'Submitting…';
    try {
      await store.openOrder({
        ticker: state.ticker,
        side: state.side,
        leverage: state.leverage,
        notional: state.notional,
        confirmLiquidation: true,
      });
      if (els.otStatus) els.otStatus.textContent = 'Order opened.';
      if (els.otConfirmChk) els.otConfirmChk.checked = false;
      await store.refresh();
      refreshAll();
    } catch (e) {
      if (els.otStatus) els.otStatus.textContent = 'Error: ' + (e && e.message ? e.message : e);
    } finally {
      renderPreview();
    }
  }

  async function closePosition(tradeId) {
    try {
      await store.closeOrder(tradeId);
      await store.refresh();
      refreshAll();
    } catch (e) {
      if (els.otStatus) els.otStatus.textContent = 'Close error: ' + (e && e.message ? e.message : e);
    }
  }

  // Wire the order ticket controls
  if (els.otTicker) {
    els.otTicker.addEventListener('change', () => {
      state.ticker = els.otTicker.value;
      refreshQuote();
      renderPreview();
    });
  }
  if (els.otSide) {
    els.otSide.addEventListener('change', () => {
      state.side = els.otSide.value;
      renderPreview();
    });
  }
  if (els.otLeverage) {
    els.otLeverage.addEventListener('input', () => {
      state.leverage = clampLeverage(els.otLeverage.value);
      if (els.otLeverageNum) els.otLeverageNum.textContent = `${state.leverage}x`;
      renderPreview();
    });
  }
  if (els.otNotional) {
    els.otNotional.addEventListener('input', () => {
      const n = clampNotional(els.otNotional.value, 1e7);
      state.notional = n;
      renderPreview();
    });
  }
  if (els.otConfirm) {
    els.otConfirm.addEventListener('click', () => { renderPreview(); });
  }
  if (els.otClose) {
    els.otClose.addEventListener('click', () => {
      if (typeof onClose === 'function') onClose();
    });
  }
  if (els.otSubmit) {
    els.otSubmit.addEventListener('click', submitOrder);
  }

  // Subscribe to store changes
  const unsub = store.subscribe(() => refreshAll());

  // First paint
  refreshAll();
  refreshQuote();
  // Re-quote every 5s so the entry price stays fresh
  const quoteTimer = setInterval(refreshQuote, 5000);

  function unmount() {
    clearInterval(quoteTimer);
    unsub();
    panel.hidden = true;
  }

  return { unmount, refresh: refreshAll, state: () => ({ ...state }) };
}

// Auto-mount when this module is loaded in a real browser.
if (typeof document !== 'undefined') {
  queueMicrotask(() => {
    const panel = document.getElementById('vibes-terminal');
    if (panel) mountTerminal({ root: panel });
  });
}
