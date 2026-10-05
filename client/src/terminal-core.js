// client/src/terminal-core.js — pure helpers for the trading terminal.
// No DOM, no fetch, no chart library. All math is done here so the
// terminal UI module can stay a thin shell and the unit tests can
// cover the rules in isolation.

// ---------- Clamping / numeric formatting -----------------------------

export const MAX_LEVERAGE = 20;
export const MIN_LEVERAGE = 1;

export function clampLeverage(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return MIN_LEVERAGE;
  return Math.max(MIN_LEVERAGE, Math.min(MAX_LEVERAGE, Math.floor(x)));
}

export function clampNotional(n, max) {
  const x = Number(n);
  if (!Number.isFinite(x) || x <= 0) return 0;
  if (typeof max === 'number' && x > max) return max;
  return x;
}

export function round6(n) { return Math.round(n * 1e6) / 1e6; }
export function round2(n) { return Math.round(n * 1e2) / 1e2; }
export function round8(n) { return Math.round(n * 1e8) / 1e8; }

// ---------- Order math (matches server/src/routes/portfolio.js) ------

/**
 * Compute the entry, liquidation price, qty, margin and notional for a
 * paper order. The math is identical to the server's, so the client
 * preview matches what the server will accept.
 *
 * @param {{ side: 'long'|'short', leverage: number, notional: number,
 *           entryPrice: number, balance?: number }} input
 * @returns {{ ok: true, entry, liquidationPrice, leverage, notional, margin, qty, marginOk }
 *           | { ok: false, error: 'bad_side'|'insufficient_margin'|'no_price'|'bad_input' }}
 */
export function computeOrder({ side, leverage, notional, entryPrice, balance } = {}) {
  if (!entryPrice || !Number.isFinite(entryPrice) || entryPrice <= 0) {
    return { ok: false, error: 'no_price' };
  }
  if (side !== 'long' && side !== 'short') {
    return { ok: false, error: 'bad_side' };
  }
  const lev = clampLeverage(leverage);
  const size = clampNotional(notional, Number.POSITIVE_INFINITY);
  if (size <= 0) return { ok: false, error: 'bad_input' };
  // Margin = notional / leverage. With leverage 5x and notional 100,
  // you commit 20 as margin and control 100 of position. This matches
  // server/src/routes/portfolio.js which uses the same formula.
  const margin = size / lev;
  const qty = size / entryPrice;
  const liq = computeLiquidationPrice(side, entryPrice, lev);
  const marginOk = balance == null ? true : (Number(balance) >= margin);
  return {
    ok: true,
    entry: round6(entryPrice),
    liquidationPrice: liq,
    leverage: lev,
    notional: round6(size * lev),
    margin: round6(margin),
    qty: round8(qty),
    marginOk,
  };
}

export function computeLiquidationPrice(side, entry, leverage) {
  const move = 1 / clampLeverage(leverage);
  const liq = side === 'long' ? entry * (1 - move) : entry * (1 + move);
  return round6(liq);
}

// Compute the realised P/L and the post-close Stable delta for a
// server-style close. Used by the UI to show "what will happen if I
// close now" before the player clicks.
export function computeClosePreview({ trade, exitPrice }) {
  if (!trade) return { ok: false, error: 'no_trade' };
  if (trade.status !== 'open') return { ok: false, error: 'not_open' };
  if (!exitPrice || !Number.isFinite(exitPrice) || exitPrice <= 0) {
    return { ok: false, error: 'no_price' };
  }
  const liq = computeLiquidationPrice(trade.side, trade.entryPrice, trade.leverage);
  let pnl, status;
  if ((trade.side === 'long' && exitPrice <= liq) || (trade.side === 'short' && exitPrice >= liq)) {
    pnl = -((trade.entryPrice * trade.qty) / trade.leverage);
    status = 'liquidated';
  } else {
    const sign = trade.side === 'long' ? 1 : -1;
    pnl = sign * (exitPrice - trade.entryPrice) * trade.qty;
    status = 'closed';
  }
  pnl = round6(pnl);
  const margin = (trade.entryPrice * trade.qty) / trade.leverage;
  const returned = status === 'liquidated' ? Math.max(0, margin + pnl) : margin + pnl;
  return {
    ok: true,
    pnl,
    status,
    margin: round6(margin),
    returned: round6(returned),
  };
}

// ---------- Portfolio presentation ------------------------------------

// Compute the portfolio value at a given map of {ticker: price}. Realised
// value is `stable + sum(qty * price)` across all tickers. Open P/L
// comes from the trades list (long: price - entry; short: entry - price).
export function portfolioValue(player, balances, trades, priceMap) {
  const stable = Number(player && player.stable) || 0;
  let equityFromHoldings = 0;
  for (const t of Object.keys(balances || {})) {
    const qty = Number(balances[t]) || 0;
    const px = Number(priceMap && priceMap[t]);
    if (qty > 0 && Number.isFinite(px)) equityFromHoldings += qty * px;
  }
  let openPnl = 0;
  for (const tr of trades || []) {
    if (tr.status !== 'open') continue;
    const px = Number(priceMap && priceMap[tr.ticker]);
    if (!Number.isFinite(px)) continue;
    const sign = tr.side === 'long' ? 1 : -1;
    openPnl += sign * (px - tr.entryPrice) * tr.qty;
  }
  return {
    stable: round6(stable),
    holdingsValue: round6(equityFromHoldings),
    openPnl: round6(openPnl),
    total: round6(stable + equityFromHoldings + openPnl),
  };
}

// Format a P/L delta with a sign and class hint. Used by the table.
export function formatPnl(n) {
  if (n == null || !Number.isFinite(n)) return { text: '—', cls: '' };
  const sign = n > 0 ? '+' : n < 0 ? '-' : '';
  return { text: `${sign}${round2(Math.abs(n)).toFixed(2)}`, cls: n > 0 ? 'pos' : n < 0 ? 'neg' : '' };
}

// Sort trades newest-first. Stable for equal timestamps.
export function sortTradesNewest(trades) {
  return [...(trades || [])].sort((a, b) => {
    if (b.createdAt !== a.createdAt) return (b.createdAt || 0) - (a.createdAt || 0);
    return String(b.id).localeCompare(String(a.id));
  });
}
