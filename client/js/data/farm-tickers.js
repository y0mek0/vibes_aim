// Farm ticker catalog. Keep future entries visible so the selector can grow
// without changing the training layout; only `active` entries can be selected.
export const FARM_TICKERS = Object.freeze([
  { ticker: 'AAPL', name: 'Apple', active: true },
  { ticker: 'NVDA', name: 'NVIDIA', active: true },
  { ticker: 'MSFT', name: 'Microsoft', active: false },
  { ticker: 'TSLA', name: 'Tesla', active: false },
  { ticker: 'AMZN', name: 'Amazon', active: false },
  { ticker: 'SPY', name: 'S&P 500', active: false },
]);

export const ACTIVE_FARM_TICKERS = Object.freeze(
  FARM_TICKERS.filter((item) => item.active).map((item) => item.ticker),
);
