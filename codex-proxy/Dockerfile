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

EXPOSE 3100

CMD ["node", "server.js"]
