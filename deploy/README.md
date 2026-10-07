# Deploy notes

This repo deploys as two pieces: a static client and a Node server.

## Static client

`client/` is plain HTML/CSS/JS with no build step. Any static host works.

### Vercel (zero config)

- Root directory: `client/`
- Build command: *(empty)*
- Output directory: `.`
- The host page reads `window.VIBES_API_BASE`. Set it via a `vercel.json` rewrite or by editing `client/index.html` to inject a `<script>` that sets the global before any module loads.

Example `client/vercel.json`:

```json
{
  "headers": [
    { "source": "/(.*)", "headers": [{ "key": "Cache-Control", "value": "public, max-age=300" }] }
  ]
}
```

### Netlify / GitHub Pages / Cloudflare Pages

- Publish directory: `client/`
- No build command.
- No environment variables needed on the static side beyond the API base URL.

## Node server

`server/src/index.js` reads `PORT` (default 3000) and `ORIGIN` (the static client's URL — needed for CORS). Everything else is optional.

### Render (free tier)

- Service type: Web Service
- Build command: `npm test`
- Start command: `node server/src/index.js`
- Health check path: `/health`
- Environment:
  - `ORIGIN=https://aim2stock-client.vercel.app`
  - `MARKET_PROVIDER=stub` (Finnhub token is optional and off by default)
  - `SUPABASE_URL=` (leave empty to use the in-memory store)
  - `SUPABASE_SERVICE_KEY=`

### Fly.io / Railway / Heroku

- Start command: `node server/src/index.js`
- Set `PORT` (the platform usually injects it for you)
- Set `ORIGIN` to the static client's URL

### Docker (any host with a Docker daemon)

Two minimal Dockerfiles are shipped. Both use `node:20-alpine` (matches `.nvmrc`) and contain no `npm install` step because the project has zero runtime npm dependencies.

- `server/Dockerfile` — production server image. Exposes port `3000`, runs as the unprivileged `node` user, and uses `/health` as a container health check.
- `server/Dockerfile.test` — same base image, runs the full fast `npm test` chain. Useful in CI and for local "does this machine still pass?" checks.

```bash
# Production server
docker build -t aim2stock-server ./server
docker run --rm -p 3000:3000 \
    -e ORIGIN=http://127.0.0.1:4173 \
    -e MARKET_PROVIDER=stub \
    aim2stock-server

# Test image (CI / local check)
docker build -f server/Dockerfile.test -t aim2stock-tests .
docker run --rm aim2stock-tests
```

### Supabase persistence

To persist progress across server restarts:

1. Create a Supabase project.
2. Open the SQL editor and run `server/migrations/0001_init.sql`.
3. Set `SUPABASE_URL` and `SUPABASE_SERVICE_KEY` in the server env.
4. The server automatically switches to Supabase. No code change.

If `SUPABASE_URL` is empty, the in-memory store runs. Progress is lost when the server restarts. This is fine for a single-session demo; use Supabase for anything longer.

### Finnhub (real market data)

The MVP runs on the `stub` provider. The chart shows deterministic offline prices. To use real intraday candles:

1. Sign up at https://finnhub.io and get a free API key (60 requests/min).
2. Set `MARKET_PROVIDER=finnhub` and `FINNHUB_TOKEN=<your key>` in the server env.
3. The first 9 tickers (AAPL, MSFT, NVDA, TSLA, AMZN, SPY, SPCX, OPENAI, ANTHROPIC) appear in `/market/symbols`. OPENAI and ANTHROPIC return `pre_ipo: true` with `price: null` because there is no real market for them.

The server polls `/market/quote` every 1s from each open chart. With a free Finnhub key that is 9 req/s sustained for one player, which is well inside the 60 req/min limit. Two simultaneous players + an idle chart = 3 req/s ≈ 180/min, still inside the limit.

## Reverse proxy / CORS

The server's CORS allow-list is `ORIGIN` only. For a production deploy:

- Vercel + Render: `ORIGIN` = your Vercel app URL.
- Custom domain: set `ORIGIN` to `https://vibesaim.example.com` exactly (no trailing slash).

To support multiple origins, change `server/src/index.js`'s CORS section to read `ORIGINS` (comma-separated) and echo the request's `Origin` if it matches.

## Health check

`GET /health` returns `{"ok": true, "ts": <ms>}`. It never throws. Configure your platform's health check to hit `/health` every 30s.

## Verifying the deploy

After deploy, open the client URL in a browser. You should see:

1. The `aim2stock` boot card with "Looking for the server on http://<host>:3000…" for ~1s.
2. The boot card disappears, the engine menu is interactive, the chart shows a price.
3. Land 10 aim hits. The aim-bridge HUD chip in the bottom-right should show `farm AAPL 0.0080 | total 0.0080` after 10 hits.

If the boot card stays, open the dev console and check `/health` and `/portfolio` from the server's host directly. Most deploys fail on CORS: `ORIGIN` must match the static client's URL **including protocol and port**.
