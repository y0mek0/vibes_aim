// client/js/terminal.js — the trading terminal UI. Thin shell over
// client/src/store.js (the network) and client/src/terminal-core.js
// (the math). Renders the portfolio, the open order ticket, the open
// positions, and the trade history. Auto-mounts if a #vibes-terminal
// element is in the DOM.

import { store } from '../src/store.js?v=20261009-2';
import {
  MAX_LEVERAGE, clampLeverage, clampNotional, round2, round6,
  computeOrder, computeClosePreview, portfolioValue, formatPnl,
  sortTradesNewest,
} from '../src/terminal-core.js?v=20261009-2';

const SELECTORS = {
  root:          '#vibes-terminal',
  balance:       '[data-vt-balance]',
  portfolioVal:  '[data-vt-portfolio-value]',
  portfolioTotal:'[data-vt-portfolio-total]',
  openPnl:       '[data-vt-open-pnl]',
  holdings:      '[data-vt-holdings]',
  assetsTotal:   '[data-vt-assets-total]',
  convertTicker: '[data-vt-convert-ticker]',
  convertUnits:  '[data-vt-convert-units]',
  convertPrice:  '[data-vt-convert-price]',
  convertUsd:    '[data-vt-convert-usd]',
  convertStatus: '[data-vt-convert-status]',
  convertSubmit: '[data-vt-convert-submit]',
  spotSide:      '[data-vt-spot-side]',
  spotQuoteLabel:'[data-vt-spot-quote-label]',
  spotPct:       '[data-vt-spot-pct]',
  positionsBody: '[data-vt-positions-body]',
  historyBody:   '[data-vt-history-body]',
  marketTicker:  '[data-vt-market-ticker]',
  marketPrice:   '[data-vt-market-price]',
  otTicker:      '[data-vt-ot-ticker]',
  otSymbol:      '[data-vt-ot-symbol]',
  otPrice:       '[data-vt-ot-price]',
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
    assetPrices: {},
    spotSide: 'buy',
  };

  function fmtMoney(n) { return Number.isFinite(n) ? round2(n).toFixed(2) : '—'; }

  function formatUnits(value) {
    const n = Number(value || 0);
    if (!Number.isFinite(n)) return '—';
    if (n === 0) return '0.00';
    if (Math.abs(n) >= 100) return n.toFixed(2);
    if (Math.abs(n) >= 1) return n.toFixed(4).replace(/0+$/, '').replace(/\.$/, '');
    return n.toFixed(6).replace(/0+$/, '').replace(/\.$/, '');
  }

  function renderHoldings(balances, prices = state.assetPrices, player = store.state.player) {
    if (!els.holdings) return;
    const assets = [
      { ticker: 'USD', units: Number(player?.stable || 0), price: 1 },
      ...Object.keys(balances || {}).filter((ticker) => ticker !== 'STABLE' && ticker !== 'USD').sort().map((ticker) => ({
        ticker,
        units: Number(balances[ticker] || 0),
        price: Number.isFinite(Number(prices?.[ticker])) ? Number(prices[ticker]) : null,
      })),
    ];
    const totalKnown = assets.every((asset) => asset.price != null);
    const total = assets.reduce((sum, asset) => sum + (asset.price == null ? 0 : asset.units * asset.price), 0);
    setText(els.assetsTotal, totalKnown ? fmtMoney(total) : '—');
    els.holdings.innerHTML = assets.map((asset) => {
      const value = asset.price == null ? '—' : '$' + fmtMoney(asset.units * asset.price);
      return `<div class="vt-asset" data-vt-asset="${asset.ticker}"><div class="vt-asset-top"><strong>${asset.ticker}</strong><span class="num">${formatUnits(asset.units)}</span></div><span class="vt-asset-value">${value}</span></div>`;
    }).join('');
  }

  async function ensureAssetPrices() {
    const missing = Object.keys(store.state.balances || {}).filter((ticker) => ticker !== state.ticker && !Number.isFinite(Number(state.assetPrices[ticker])));
    await Promise.all(missing.map(async (ticker) => {
      try {
        const q = await store.fetchQuote(ticker);
        if (q && q.price != null) state.assetPrices[ticker] = q.price;
      } catch (_) { /* price stays unavailable */ }
    }));
    renderHoldings(store.state.balances, state.assetPrices, store.state.player);
    renderPortfolio();
    renderConvert();
  }

  function renderConvert() {
    if (!els.convertTicker || !els.convertUnits) return;
    const balances = store.state.balances || {};
    const tickers = [...new Set(['AAPL', state.ticker, ...Object.keys(balances), ...(store.state.unlocks || [])])]
      .filter((ticker) => ticker && ticker !== 'STABLE' && ticker !== 'USD').sort();
    const previous = els.convertTicker.value;
    els.convertTicker.innerHTML = tickers.map((ticker) => `<option value="${ticker}">${ticker}</option>`).join('');
    if (!tickers.length) {
      els.convertTicker.disabled = true;
      els.convertUnits.disabled = true;
      if (els.convertSubmit) els.convertSubmit.disabled = true;
      setText(els.convertPrice, '—');
      setText(els.convertUsd, '—');
      setText(els.convertStatus, 'No spot assets available.');
      return;
    }
    const ticker = tickers.includes(previous) ? previous : tickers[0];
    els.convertTicker.value = ticker;
    els.convertTicker.disabled = false;
    els.convertUnits.disabled = false;
    const available = Number(balances[ticker] || 0);
    const usdAvailable = Number(store.state.player?.stable || 0);
    const units = Number(els.convertUnits.value || 0);
    const price = Number(state.assetPrices[ticker]);
    const usd = Number.isFinite(price) && price > 0 && Number.isFinite(units) ? units * price : NaN;
    setText(els.convertPrice, Number.isFinite(price) ? fmtMoney(price) : '—');
    setText(els.convertUsd, Number.isFinite(usd) ? fmtMoney(usd) : '—');
    const buy = state.spotSide === 'buy';
    const valid = units > 0 && Number.isFinite(price) && price > 0
      && (buy ? usd <= usdAvailable + 1e-9 : units <= available + 1e-9);
    setText(els.convertStatus, buy
      ? `USD available ${fmtMoney(usdAvailable)} · ${ticker} ${formatUnits(available)}`
      : `${ticker} available ${formatUnits(available)} · USD ${fmtMoney(usdAvailable)}`);
    setText(els.spotQuoteLabel, buy ? 'Total ' : 'Receive ');
    if (els.convertSubmit) els.convertSubmit.textContent = `${buy ? 'Buy' : 'Sell'} ${ticker}`;
    if (els.convertSubmit) els.convertSubmit.disabled = !valid;
  }

  async function refreshConvertQuote() {
    if (!els.convertTicker || !els.convertTicker.value) return;
    const ticker = els.convertTicker.value;
    if (!Number.isFinite(Number(state.assetPrices[ticker]))) {
      try {
        const q = await store.fetchQuote(ticker);
        if (q && q.price != null) state.assetPrices[ticker] = q.price;
      } catch (_) { /* price remains unavailable */ }
    }
    renderConvert();
  }

  async function spotTrade() {
    const ticker = els.convertTicker?.value;
    const units = Number(els.convertUnits?.value);
    if (!ticker || !Number.isFinite(units) || units <= 0) return;
    if (els.convertSubmit) els.convertSubmit.disabled = true;
    const side = state.spotSide;
    setText(els.convertStatus, side === 'buy' ? 'Buying…' : 'Selling…');
    try {
      const r = await store.tradeSpot({ ticker, side, units });
      setText(els.convertStatus, `${side === 'buy' ? 'Bought' : 'Sold'} ${formatUnits(r.units)} ${ticker} for ${fmtMoney(r.usd)} USD.`);
      els.convertUnits.value = '0.01';
      refreshAll();
    } catch (e) {
      setText(els.convertStatus, 'Error: ' + (e && e.message ? e.message : e));
      renderConvert();
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
        state.assetPrices[state.ticker] = q.price;
        setText(els.otSymbol, state.ticker);
        setText(els.otPrice, fmtMoney(q.price));
        setText(els.otEntry, fmtMoney(q.price));
        setText(els.marketTicker, state.ticker);
        setText(els.marketPrice, fmtMoney(q.price));
        document.querySelectorAll(`[data-vt-watch-price="${state.ticker}"]`).forEach((el) => { el.textContent = fmtMoney(q.price); });
        renderHoldings(store.state.balances, state.assetPrices, store.state.player);
        renderPortfolio();
        renderPreview();
        renderConvert();
      } else if (q && q.status === 'pre_ipo') {
        state.entryPrice = 0;
        setText(els.otSymbol, state.ticker);
        setText(els.otPrice, '—');
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
        els.otStatus.textContent = `Insufficient USD: need ${fmtMoney(preview.margin)}, have ${fmtMoney(player.stable)}`;
        els.otStatus.classList.add('neg');
      } else {
        els.otStatus.textContent = `OK — entry ${fmtMoney(preview.entry)}, liquidates at ${fmtMoney(preview.liquidationPrice)}`;
        els.otStatus.classList.remove('neg');
      }
    }
    if (els.otSubmit) els.otSubmit.disabled = !preview.marginOk || state.entryPrice === 0 || (els.otConfirmChk && !els.otConfirmChk.checked);
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
    const priceMap = { ...state.assetPrices };
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
    renderHoldings(store.state.balances, state.assetPrices, store.state.player);
    renderPositions(store.state.trades);
    renderHistory(store.state.trades);
    renderConvert();
    ensureAssetPrices();
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
      setText(els.otSymbol, state.ticker);
      setText(els.otPrice, '—');
      refreshQuote();
      renderPreview();
    });
  }
  if (els.otSide) {
    els.otSide.addEventListener('change', () => {
      state.side = els.otSide.value;
      panel.querySelectorAll('[data-vt-side-choice]').forEach((button) => {
        button.classList.toggle('active', button.dataset.vtSideChoice === state.side);
      });
      renderPreview();
    });
  }
  panel.querySelectorAll('[data-vt-side-choice]').forEach((button) => {
    button.addEventListener('click', () => {
      if (!els.otSide) return;
      els.otSide.value = button.dataset.vtSideChoice;
      els.otSide.dispatchEvent(new Event('change', { bubbles: true }));
    });
  });
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
    // Percentage quick-buttons (25/50/75/MAX). Sets notional to a fixed
    // fraction of the player's USD stable balance and updates the preview.
    // MAX caps at the smaller of (1e7, balance * leverage) so the player
    // can never borrow beyond what they can actually back with stable.
    const pctBtns = panel.querySelectorAll('[data-vt-ot-pct]');
    pctBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        const pct = Number(btn.dataset.vtOtPct);
        if (!Number.isFinite(pct)) return;
        const stable = (store.state && store.state.player && Number(store.state.player.stable)) || 0;
        const lev = Number(state.leverage) || 1;
        const maxByLev = Math.min(1e7, stable * Math.max(1, lev));
        const pctAmt = pct === 100 ? maxByLev : Math.max(1, Math.floor((maxByLev * pct) / 100));
        if (els.otNotional) {
          els.otNotional.value = String(clampNotional(pctAmt, 1e7));
          state.notional = clampNotional(pctAmt, 1e7);
        }
        // Visually toggle the active state on the percentage buttons.
        pctBtns.forEach((b) => b.classList.toggle('active', b === btn));
        renderPreview();
      });
    });
    if (els.convertTicker) {
      els.convertTicker.addEventListener('change', refreshConvertQuote);
    }
    panel.querySelectorAll(SELECTORS.spotSide).forEach((button) => {
    button.addEventListener('click', () => {
      state.spotSide = button.dataset.vtSpotSide;
      panel.querySelectorAll(SELECTORS.spotSide).forEach((b) => b.classList.toggle('active', b === button));
      renderConvert();
    });
  });
  if (els.convertUnits) {
    els.convertUnits.addEventListener('input', renderConvert);
  }
  // Spot percentage quick-buttons (25/50/75/MAX). Buy uses % of USD
  // stable balance; sell uses % of the held ticker balance.
  panel.querySelectorAll(SELECTORS.spotPct).forEach((btn) => {
    btn.addEventListener('click', () => {
      const pct = Number(btn.dataset.vtSpotPct);
      if (!Number.isFinite(pct)) return;
      const ticker = els.convertTicker?.value;
      const price = Number(state.assetPrices[ticker]);
      const buy = state.spotSide === 'buy';
      const stable = Number(store.state.player?.stable || 0);
      const balances = store.state.balances || {};
      const held = Number(balances[ticker] || 0);
      let units = 0;
      if (buy) {
        // units = usd_budget / price
        const budget = stable * (pct / 100);
        units = Number.isFinite(price) && price > 0 ? budget / price : 0;
      } else {
        units = held * (pct / 100);
      }
      if (els.convertUnits) {
        els.convertUnits.value = Number.isFinite(units) ? String(round6(units)) : '0';
      }
      panel.querySelectorAll(SELECTORS.spotPct).forEach((b) => b.classList.toggle('active', b === btn));
      renderConvert();
    });
  });
  if (els.convertSubmit) {
    els.convertSubmit.addEventListener('click', spotTrade);
  }
  if (els.otConfirmChk) {
    els.otConfirmChk.addEventListener('change', renderPreview);
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

  // First paint. If the store hasn't been hydrated yet (cold start, no
    // prior refresh), fetch the defaults before rendering so we don't
    // paint the empty holdings view first.
    if (typeof store.refresh === 'function') {
      const refreshPromise = (!store.state || !store.state.ready)
        ? store.refresh().catch(() => {})
        : Promise.resolve();
      refreshPromise.then(() => {
        refreshAll();
        refreshQuote();
      });
    } else {
      refreshAll();
      refreshQuote();
    }
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
