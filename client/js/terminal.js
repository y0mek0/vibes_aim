// client/js/terminal.js - compact trading workspace over the existing store.
import { store } from '../src/store.js?v=20261013-6';
import {
  clampLeverage, clampNotional, round2, round6,
  computeOrder, computeClosePreview, portfolioValue, formatPnl,
  sortTradesNewest,
} from '../src/terminal-core.js?v=20261013-6';

const SELECTORS = {
  root: '#vibes-terminal', balance: '[data-vt-balance]', portfolioVal: '[data-vt-portfolio-value]', portfolioTotal: '[data-vt-portfolio-total]', openPnl: '[data-vt-open-pnl]', holdings: '[data-vt-holdings]', assetsTotal: '[data-vt-assets-total]', assetsBody: '[data-vt-assets-body]', convertTicker: '[data-vt-convert-ticker]', convertUnits: '[data-vt-convert-units]', convertInputLabel: '[data-vt-convert-input-label]', convertPrice: '[data-vt-convert-price]', convertUsd: '[data-vt-convert-usd]', convertStatus: '[data-vt-convert-status]', convertSubmit: '[data-vt-convert-submit]', spotSide: '[data-vt-spot-side]', spotPct: '[data-vt-spot-pct]', spotReceiveLabel: '[data-vt-spot-receive-label]', spotReceiveTicker: '[data-vt-spot-receive-ticker]', available: '[data-vt-available]', perpAvailable: '[data-vt-perp-available]', positionsBody: '[data-vt-positions-body]', historyBody: '[data-vt-history-body]', ordersBody: '[data-vt-orders-body]', marketTicker: '[data-vt-market-ticker]', marketPrice: '[data-vt-market-price]', otTicker: '[data-vt-ot-ticker]', otSymbol: '[data-vt-ot-symbol]', otPrice: '[data-vt-ot-price]', otSide: '[data-vt-ot-side]', otNotional: '[data-vt-ot-notional]', otLeverage: '[data-vt-ot-leverage]', otLeverageNum: '[data-vt-ot-leverage-num]', otEntry: '[data-vt-ot-entry]', otLiq: '[data-vt-ot-liq]', otMargin: '[data-vt-ot-margin]', otNotionalTotal: '[data-vt-ot-notional-total]', otStatus: '[data-vt-ot-status]', otConfirmChk: '[data-vt-ot-confirm-chk]', otSubmit: '[data-vt-ot-submit]',
};

const fmtMoney = (n) => Number.isFinite(Number(n)) ? round2(Number(n)).toFixed(2) : '-';
const fmtUnits = (value) => { const n = Number(value || 0); if (!Number.isFinite(n)) return '-'; if (n === 0) return '0.00'; if (Math.abs(n) >= 100) return n.toFixed(2); if (Math.abs(n) >= 1) return n.toFixed(4).replace(/0+$/, '').replace(/\.$/, ''); return n.toFixed(6).replace(/0+$/, '').replace(/\.$/, ''); };
const setText = (el, value) => { if (el) el.textContent = value; };
const toggle = (el, on, cls = 'active') => { if (el) el.classList.toggle(cls, !!on); };

export function mountTerminal({ root } = {}) {
  const panel = root || document.querySelector(SELECTORS.root);
  if (!panel) return { unmount() {}, state: null };
  const els = {};
  for (const [key, selector] of Object.entries(SELECTORS)) els[key] = panel.querySelector(selector);
  const state = { ticker: 'AAPL', mode: 'dex', spotSide: 'buy', perpSide: 'long', leverage: 1, notional: 100, entryPrice: 0, assetPrices: {}, lastPreview: null, activity: 'positions', refreshingPrices: false, marketOpen: true, marketSession: 'paper' };

  function priceFor(ticker) { const price = Number(state.assetPrices[ticker]); return Number.isFinite(price) && price > 0 ? price : null; }
  function visibleTickers() { const unlocks = new Set(store.state.unlocks || []); const tickers = new Set(['AAPL', 'NVDA', state.ticker]); for (const ticker of Object.keys(store.state.balances || {})) tickers.add(ticker); return [...tickers].filter((ticker) => ticker === 'AAPL' || ticker === 'NVDA' || unlocks.has(ticker)).sort(); }

  function renderPortfolio() {
    const player = store.state.player; if (!player) return;
    const priceMap = { ...state.assetPrices };
    for (const trade of store.state.trades || []) if (trade.status === 'open' && !priceMap[trade.ticker]) priceMap[trade.ticker] = trade.entryPrice;
    if (state.entryPrice && !priceMap[state.ticker]) priceMap[state.ticker] = state.entryPrice;
    const value = portfolioValue(player, store.state.balances, store.state.trades, priceMap);
    setText(els.balance, fmtMoney(value.stable)); setText(els.portfolioVal, fmtMoney(value.holdingsValue)); setText(els.portfolioTotal, fmtMoney(value.total)); setText(els.openPnl, formatPnl(value.openPnl).text); toggle(els.openPnl, value.openPnl > 0, 'pos'); toggle(els.openPnl, value.openPnl < 0, 'neg');
    document.querySelectorAll('[data-dashboard-stable]').forEach((el) => { el.textContent = fmtMoney(value.stable); });
    document.querySelectorAll('[data-dashboard-portfolio-total]').forEach((el) => { el.textContent = fmtMoney(value.total); });
  }

  function renderAssets() {
    const balances = store.state.balances || {}; const stable = Number(store.state.player?.stable || 0); const assets = [{ ticker: 'USD', units: stable, price: 1 }];
    for (const ticker of Object.keys(balances).filter((key) => key !== 'USD' && key !== 'STABLE').sort()) assets.push({ ticker, units: Number(balances[ticker] || 0), price: priceFor(ticker) });
    const total = assets.reduce((sum, asset) => sum + (asset.price == null ? 0 : asset.units * asset.price), 0); setText(els.assetsTotal, fmtMoney(total));
    if (els.holdings) els.holdings.innerHTML = assets.map((asset) => `<div class="vt-asset"><div class="vt-asset-top"><strong>${asset.ticker}</strong><span class="num">${fmtUnits(asset.units)}</span></div><span class="vt-asset-value">${asset.price == null ? '-' : '$' + fmtMoney(asset.units * asset.price)}</span></div>`).join('');
    if (!els.assetsBody) return;
    els.assetsBody.innerHTML = assets.map((asset) => { const value = asset.price == null ? null : asset.units * asset.price; const allocation = total > 0 && value != null ? `${((value / total) * 100).toFixed(1)}%` : '-'; return `<tr><td class="num"><strong>${asset.ticker}</strong></td><td class="num">${fmtUnits(asset.units)}</td><td class="num">${value == null ? '-' : '$' + fmtMoney(value)}</td><td class="num">${allocation}</td></tr>`; }).join('') || '<tr><td colspan="4" class="vt-empty">No assets.</td></tr>';
  }

  function renderWatchlist() {
    const unlocked = new Set(store.state.unlocks || []);
    for (const button of panel.querySelectorAll('[data-vt-watch]')) { const ticker = button.dataset.vtWatch; button.hidden = !(ticker === 'AAPL' || ticker === 'NVDA' || unlocked.has(ticker) || ticker === state.ticker); toggle(button, ticker === state.ticker); const price = priceFor(ticker); setText(button.querySelector('[data-vt-watch-price]'), price == null ? '-' : fmtMoney(price)); }
  }

  function renderTickerContext() {
    setText(els.marketTicker, state.ticker); setText(els.otSymbol, state.ticker); setText(els.marketPrice, state.entryPrice ? fmtMoney(state.entryPrice) : '-'); setText(els.otPrice, state.entryPrice ? fmtMoney(state.entryPrice) : '-'); if (els.otTicker) els.otTicker.value = state.ticker;
    if (els.convertTicker) els.convertTicker.value = state.ticker;
    setText(panel.querySelector('[data-vt-spot-receive-ticker]'), state.spotSide === 'buy' ? state.ticker : 'USD');
  }

  function renderSpot() {
    if (!els.convertUnits) return; const ticker = els.convertTicker?.value || state.ticker; const price = priceFor(ticker); const buy = state.spotSide === 'buy'; const stable = Number(store.state.player?.stable || 0); const held = Number(store.state.balances?.[ticker] || 0); const amount = Number(els.convertUnits.value || 0); const units = buy && price ? amount / price : amount; const usd = buy ? amount : (price ? units * price : NaN);
    setText(els.convertInputLabel, buy ? 'You pay' : 'You sell'); setText(els.spotReceiveLabel, 'You receive'); setText(els.spotReceiveTicker, buy ? ticker : 'USD'); setText(els.convertPrice, price == null ? '-' : fmtMoney(price)); setText(els.convertUsd, buy ? (Number.isFinite(units) ? fmtUnits(units) : '-') : (Number.isFinite(usd) ? '$' + fmtMoney(usd) : '-')); setText(els.available, buy ? `${fmtMoney(stable)} USD` : `${fmtUnits(held)} ${ticker}`);
    const valid = state.marketOpen && price != null && amount > 0 && (buy ? amount <= stable + 1e-9 : units <= held + 1e-9); const status = !state.marketOpen ? `Market ${state.marketSession || 'closed'}; spot trading is unavailable.` : price == null ? 'Price feed unavailable.' : buy ? (amount <= stable + 1e-9 ? `Market buy ready at ${fmtMoney(price)}.` : `Insufficient USD. Available ${fmtMoney(stable)}.`) : (units <= held + 1e-9 ? `Market sell ready at ${fmtMoney(price)}.` : `Insufficient ${ticker}. Available ${fmtUnits(held)}.`); setText(els.convertStatus, status);
    if (els.convertSubmit) { els.convertSubmit.disabled = !valid; els.convertSubmit.textContent = `${buy ? 'Buy' : 'Sell'} ${ticker}`; }
    panel.querySelectorAll(SELECTORS.spotSide).forEach((button) => toggle(button, button.dataset.vtSpotSide === state.spotSide));
  }

  function renderPerpPreview() {
    const player = store.state.player || { stable: 0 }; const preview = computeOrder({ side: state.perpSide, leverage: state.leverage, notional: state.notional, entryPrice: state.entryPrice, balance: player.stable }); state.lastPreview = preview;
    if (!preview.ok) { ['otEntry', 'otLiq', 'otMargin', 'otNotionalTotal'].forEach((key) => setText(els[key], '-')); setText(els.otStatus, preview.error === 'no_price' ? 'Price feed unavailable.' : 'Enter a valid position size.'); if (els.otSubmit) els.otSubmit.disabled = true; return; }
    setText(els.otEntry, fmtMoney(preview.entry)); setText(els.otLiq, fmtMoney(preview.liquidationPrice)); setText(els.otMargin, fmtMoney(preview.margin)); setText(els.otNotionalTotal, fmtMoney(preview.notional)); setText(els.perpAvailable, `${fmtMoney(Number(player.stable || 0))} USD`); setText(els.otStatus, !state.marketOpen ? `Market ${state.marketSession || 'closed'}; new positions are unavailable.` : preview.marginOk ? `Ready. Liquidation at ${fmtMoney(preview.liquidationPrice)}.` : `Insufficient USD. Need ${fmtMoney(preview.margin)}.`); toggle(els.otStatus, !preview.marginOk || !state.marketOpen, 'neg');
    if (els.otSubmit) { els.otSubmit.disabled = !state.marketOpen || !preview.marginOk || !state.entryPrice || !els.otConfirmChk?.checked; els.otSubmit.textContent = `Open ${state.perpSide}`; } if (els.otLeverageNum) els.otLeverageNum.textContent = `${state.leverage}x`; panel.querySelectorAll('[data-vt-side-choice]').forEach((button) => toggle(button, button.dataset.vtSideChoice === state.perpSide));
  }

  function renderMode() {
    panel.querySelectorAll('[data-vt-mode]').forEach((button) => { const active = button.dataset.vtMode === state.mode; toggle(button, active); button.setAttribute('aria-selected', String(active)); });
    panel.querySelectorAll('[data-vt-form]').forEach((form) => { const active = form.dataset.vtForm === state.mode; form.hidden = !active; toggle(form, active); }); if (state.mode === 'dex') renderSpot(); else renderPerpPreview();
  }

  function renderPositions() {
    if (!els.positionsBody) return; const open = (store.state.trades || []).filter((trade) => trade.status === 'open'); if (!open.length) { els.positionsBody.innerHTML = '<tr><td colspan="9" class="vt-empty">No open positions.</td></tr>'; return; }
    els.positionsBody.innerHTML = open.map((trade) => { const mark = priceFor(trade.ticker) || Number(trade.entryPrice); const pnl = computeClosePreview({ trade, exitPrice: mark }); const pnlText = pnl.ok ? formatPnl(pnl.pnl) : { text: '-', cls: '' }; const size = Number(trade.entryPrice || 0) * Number(trade.qty || 0); return `<tr><td class="num"><strong>${trade.ticker}</strong></td><td class="num">${String(trade.side || '').toUpperCase()}</td><td class="num">$${fmtMoney(size)}</td><td class="num">${trade.leverage}x</td><td class="num">${fmtMoney(trade.entryPrice)}</td><td class="num">${fmtMoney(mark)}</td><td class="num">${fmtMoney(trade.liquidationPrice)}</td><td class="num ${pnlText.cls}">${pnlText.text}</td><td><button type="button" data-vt-close="${trade.id}" class="vt-btn vt-btn-ghost vt-btn-small">Close</button></td></tr>`; }).join('');
    els.positionsBody.querySelectorAll('[data-vt-close]').forEach((button) => button.addEventListener('click', () => closePosition(button.dataset.vtClose)));
  }

  function renderHistory() {
    if (!els.historyBody) return; const trades = sortTradesNewest(store.state.trades).filter((trade) => trade.status !== 'open').slice(0, 20); els.historyBody.innerHTML = trades.length ? trades.map((trade) => { const pnl = formatPnl(Number(trade.pnl)); const status = trade.status === 'liquidated' ? 'liquidated' : trade.status || 'closed'; return `<tr><td class="num">${trade.ticker}</td><td class="num">PERP</td><td class="num">${String(trade.side || '').toUpperCase()}</td><td class="num">${fmtMoney(trade.exitPrice ?? trade.entryPrice)}</td><td class="num">$${fmtMoney(Number(trade.entryPrice || 0) * Number(trade.qty || 0))}</td><td class="num ${pnl.cls}">${pnl.text}</td><td><span class="vt-status ${status}">${status}</span></td></tr>`; }).join('') : '<tr><td colspan="7" class="vt-empty">No trade history.</td></tr>';
  }

  function renderOrders() {
    if (!els.ordersBody) return;
    const orders = (store.state.orders || []).filter((order) => String(order.status || 'open').toLowerCase() === 'open');
    els.ordersBody.innerHTML = orders.length ? orders.map((order) => `<tr><td class="num">${order.ticker || state.ticker}</td><td class="num">${String(order.mode || 'PERP').toUpperCase()}</td><td class="num">${String(order.side || '').toUpperCase()}</td><td class="num">${String(order.type || 'LIMIT').toUpperCase()}</td><td class="num">${fmtMoney(order.price)}</td><td class="num">$${fmtMoney(order.size || order.notional)}</td><td class="num">${order.filled == null ? '0%' : order.filled}</td><td>OPEN</td><td><button type="button" class="vt-btn vt-btn-ghost vt-btn-small" disabled>Cancel</button></td></tr>`).join('') : '<tr><td colspan="9" class="vt-empty">No open orders. Limit execution is not enabled.</td></tr>';
  }

  function renderActivity() {
    panel.querySelectorAll('[data-vt-activity-tab]').forEach((button) => { const active = button.dataset.vtActivityTab === state.activity; toggle(button, active); button.setAttribute('aria-selected', String(active)); }); panel.querySelectorAll('[data-vt-activity-pane]').forEach((pane) => { const active = pane.dataset.vtActivityPane === state.activity; pane.hidden = !active; toggle(pane, active); }); const labels = { positions: 'Open positions', orders: 'Pending orders', history: 'Recent executions', assets: 'Account assets' }; setText(panel.querySelector('[data-vt-activity-meta]'), labels[state.activity]);
  }

  async function ensureAssetPrices() {
    if (state.refreshingPrices) return; const missing = [...new Set([...Object.keys(store.state.balances || {}), ...(store.state.trades || []).map((trade) => trade.ticker), state.ticker])].filter((ticker) => !priceFor(ticker)); if (!missing.length) return; state.refreshingPrices = true;
    try { await Promise.all(missing.map(async (ticker) => { try { const quote = await store.fetchQuote(ticker); if (quote?.price != null) state.assetPrices[ticker] = Number(quote.price); } catch (_) { /* keep unavailable */ } })); } finally { state.refreshingPrices = false; renderAll(false); }
  }
  async function refreshQuote() { try { const quote = await store.fetchQuote(state.ticker); if (quote?.price != null) { state.entryPrice = Number(quote.price); state.assetPrices[state.ticker] = Number(quote.price); } else if (quote?.status === 'pre_ipo') state.entryPrice = 0; if (quote?.trading) { state.marketOpen = quote.trading.isOpen !== false; state.marketSession = quote.trading.session || (state.marketOpen ? 'open' : 'closed'); } } catch (_) { /* keep last price */ } renderAll(false); }
  function renderAll(fetchPrices = true) { renderTickerContext(); renderPortfolio(); renderAssets(); renderWatchlist(); renderPositions(); renderOrders(); renderHistory(); renderMode(); renderActivity(); if (fetchPrices) void ensureAssetPrices(); }

  async function spotTrade() { const ticker = els.convertTicker?.value || state.ticker; const price = priceFor(ticker); const amount = Number(els.convertUnits?.value || 0); const units = state.spotSide === 'buy' && price ? amount / price : amount; if (!price || !Number.isFinite(units) || units <= 0) return; if (els.convertSubmit) els.convertSubmit.disabled = true; setText(els.convertStatus, 'Submitting...'); try { const result = await store.tradeSpot({ ticker, side: state.spotSide, units }); window.__aim2stockChart?.addMarker?.({ ticker, kind: state.spotSide === 'buy' ? 'BUY' : 'SELL', price, ts: Date.now(), id: `spot-${state.spotSide}-${Date.now()}` }); setText(els.convertStatus, `${state.spotSide === 'buy' ? 'Bought' : 'Sold'} ${fmtUnits(result.units ?? units)} ${ticker}.`); els.convertUnits.value = state.spotSide === 'buy' ? '100' : '0'; renderAll(); } catch (error) { setText(els.convertStatus, `Trade failed: ${error?.message || error}`); renderSpot(); } }
  async function submitOrder() { if (!state.lastPreview?.ok || !state.lastPreview.marginOk || !els.otConfirmChk?.checked) return; if (els.otSubmit) els.otSubmit.disabled = true; setText(els.otStatus, 'Submitting...'); try { const result = await store.openOrder({ ticker: state.ticker, side: state.perpSide, leverage: state.leverage, notional: state.notional, confirmLiquidation: true }); const trade = result?.trade || result; window.__aim2stockChart?.addMarker?.({ ticker: state.ticker, kind: state.perpSide === 'long' ? 'LONG' : 'SHORT', price: Number(trade?.entryPrice || state.entryPrice), ts: Number(trade?.createdAt || Date.now()), id: trade?.id }); if (els.otConfirmChk) els.otConfirmChk.checked = false; setText(els.otStatus, `${state.perpSide === 'long' ? 'Long' : 'Short'} opened.`); renderAll(); } catch (error) { setText(els.otStatus, `Order failed: ${error?.message || error}`); renderPerpPreview(); } }
  async function closePosition(tradeId) { try { const trade = (store.state.trades || []).find((item) => item.id === tradeId); const price = trade ? (priceFor(trade.ticker) || Number(trade.entryPrice)) : 0; const result = await store.closeOrder(tradeId); window.__aim2stockChart?.addMarker?.({ ticker: trade?.ticker || state.ticker, kind: trade?.side === 'long' ? 'CLOSE LONG' : 'CLOSE SHORT', price, ts: Date.now(), id: `close-${tradeId}-${Date.now()}` }); void result; renderAll(); } catch (error) { setText(els.otStatus, `Close failed: ${error?.message || error}`); } }
  function selectTicker(ticker) { if (!ticker) return; state.ticker = ticker; if (els.otTicker) els.otTicker.value = ticker; if (els.convertTicker) els.convertTicker.value = ticker; panel.querySelectorAll('[data-vt-watch]').forEach((button) => toggle(button, button.dataset.vtWatch === ticker)); const chartButton = document.querySelector(`#vibes-chart [data-vc-ticker-btn="${ticker}"]`); if (chartButton && !chartButton.hidden) chartButton.click(); state.entryPrice = priceFor(ticker) || 0; renderAll(); void refreshQuote(); }

  panel.querySelectorAll('[data-vt-watch]').forEach((button) => button.addEventListener('click', () => selectTicker(button.dataset.vtWatch)));
  panel.querySelectorAll('[data-vt-mode]').forEach((button) => button.addEventListener('click', () => { state.mode = button.dataset.vtMode; renderMode(); })); panel.querySelectorAll('[data-vt-activity-tab]').forEach((button) => button.addEventListener('click', () => { state.activity = button.dataset.vtActivityTab; renderActivity(); })); panel.querySelectorAll(SELECTORS.spotSide).forEach((button) => button.addEventListener('click', () => { state.spotSide = button.dataset.vtSpotSide; renderTickerContext(); renderSpot(); })); panel.querySelectorAll('[data-vt-side-choice]').forEach((button) => button.addEventListener('click', () => { state.perpSide = button.dataset.vtSideChoice; if (els.otSide) els.otSide.value = state.perpSide; renderPerpPreview(); }));
  els.convertTicker?.addEventListener('change', () => { state.ticker = els.convertTicker.value; renderTickerContext(); void refreshQuote(); }); els.convertUnits?.addEventListener('input', renderSpot); els.convertSubmit?.addEventListener('click', spotTrade); els.otSubmit?.addEventListener('click', submitOrder); els.otConfirmChk?.addEventListener('change', renderPerpPreview); els.otNotional?.addEventListener('input', () => { state.notional = clampNotional(els.otNotional.value, 1e7); renderPerpPreview(); }); els.otLeverage?.addEventListener('input', () => { state.leverage = clampLeverage(els.otLeverage.value); renderPerpPreview(); });
  panel.querySelectorAll('[data-vt-ot-pct]').forEach((button) => button.addEventListener('click', () => { const pct = Number(button.dataset.vtOtPct); const stable = Number(store.state.player?.stable || 0); const maxByLev = Math.min(1e7, stable * Math.max(1, state.leverage)); state.notional = clampNotional(pct === 100 ? maxByLev : maxByLev * pct / 100, 1e7); if (els.otNotional) els.otNotional.value = String(state.notional); renderPerpPreview(); }));
  panel.querySelectorAll('[data-vt-spot-pct]').forEach((button) => button.addEventListener('click', () => { const pct = Number(button.dataset.vtSpotPct) / 100; const ticker = els.convertTicker?.value || state.ticker; const buy = state.spotSide === 'buy'; const available = buy ? Number(store.state.player?.stable || 0) : Number(store.state.balances?.[ticker] || 0); if (els.convertUnits) els.convertUnits.value = String(round6(available * pct)); panel.querySelectorAll(SELECTORS.spotPct).forEach((item) => toggle(item, item === button)); renderSpot(); })); els.otTicker?.addEventListener('change', () => selectTicker(els.otTicker.value));

  const unsub = store.subscribe(() => renderAll()); const refreshPromise = (!store.state?.ready && typeof store.refresh === 'function') ? store.refresh().catch(() => {}) : Promise.resolve(); refreshPromise.then(() => { renderAll(); void refreshQuote(); }); const quoteTimer = setInterval(() => { void refreshQuote(); }, 5000);
  function unmount() { clearInterval(quoteTimer); unsub(); panel.hidden = true; }
  return { unmount, refresh: renderAll, state: () => ({ ...state }) };
}

if (typeof document !== 'undefined') queueMicrotask(() => { const panel = document.getElementById('vibes-terminal'); if (panel) mountTerminal({ root: panel }); });
