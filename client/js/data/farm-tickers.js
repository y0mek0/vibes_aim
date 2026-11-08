// Farm ticker catalog. Keep future entries visible so the selector can grow
// without changing the training layout; only `active` entries can be selected.
export const FARM_TICKERS = Object.freeze([
  // AAPL keeps the existing AIM2STOCK site accent as the default farm theme.
  { ticker: 'AAPL', name: 'Apple', color: '#f6d447', active: true },
  { ticker: 'NVDA', name: 'NVIDIA', color: '#76b900', active: true },
  { ticker: 'MSFT', name: 'Microsoft', color: '#00a4ef', active: true },
  { ticker: 'TSLA', name: 'Tesla', color: '#e82127', active: true },
  { ticker: 'AMZN', name: 'Amazon', color: '#ff9900', active: false },
  { ticker: 'SPY', name: 'S&P 500', color: '#8b5cf6', active: false },
]);

export const ACTIVE_FARM_TICKERS = Object.freeze(
  FARM_TICKERS.filter((item) => item.active).map((item) => item.ticker),
);

const DEFAULT_FARM_COLOR = FARM_TICKERS[0].color;
export function farmTickerBySymbol(ticker) {
  return FARM_TICKERS.find((item) => item.ticker === ticker) || FARM_TICKERS[0];
}
export function farmTickerColor(ticker) {
  return farmTickerBySymbol(ticker).color || DEFAULT_FARM_COLOR;
}
