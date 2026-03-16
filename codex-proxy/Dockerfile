FROM node:22-bookworm-slim

WORKDIR /app

# Install ca-certificates so the codex Rust binary can verify TLS connections
# (node bundles its own certs, but the native codex binary uses the system store)
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates && rm -rf /var/lib/apt/lists/*

# Install @openai/codex globally
RUN npm install -g @openai/codex

# Copy and install proxy dependencies
COPY package.json ./
RUN npm install --production

COPY . .

ENV CODEX_PROXY_PORT=3100

# Store codex sidecar config + data inside /app so auth tokens survive
# container restarts when /app is mounted as a persistent volume in Coolify.
ENV XDG_CONFIG_HOME=/app/.config
ENV XDG_DATA_HOME=/app/.local/share

EXPOSE 3100

CMD ["node", "server.js"]
