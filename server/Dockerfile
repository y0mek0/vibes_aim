# Minimal Docker image for the vibes_aim server.
#
# The server is pure Node (no `node_modules`), so this Dockerfile only
# copies source files. Stage builds use the project's Node 20 runtime
# (matches .nvmrc) on linux/amd64 + linux/arm64.
#
# Usage:
#   docker build -t vibes_aim-server ./server
#   docker run --rm -p 3000:3000 \
#     -e ORIGIN=http://127.0.0.1:4173 \
#     -e MARKET_PROVIDER=stub \
#     vibes_aim-server

FROM node:20-alpine

LABEL org.opencontainers.image.title="vibes_aim-server" \
      org.opencontainers.image.description="Pure-Node HTTP server for the vibes_aim paper-trading backend." \
      org.opencontainers.image.licenses="MIT"

WORKDIR /app

# Copy the server source tree exactly as committed.
COPY src ./src

# The server reads runtime config from environment variables only.
# Defaults match the in-process config (port 3000, stub market, no Supabase).
ENV PORT=3000 \
    ORIGIN=http://127.0.0.1:4173 \
    MARKET_PROVIDER=stub \
    NODE_ENV=production

EXPOSE 3000

# Container liveness check: the server exposes /health on the same port.
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD wget -qO- http://127.0.0.1:3000/health > /dev/null || exit 1

# Run as the unprivileged node user that the official image provides.
USER node

CMD ["node", "src/index.js"]