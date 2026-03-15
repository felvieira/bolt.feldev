FROM node:22-bookworm-slim

WORKDIR /app

# Install @openai/codex globally
RUN npm install -g @openai/codex

# Copy and install proxy dependencies
COPY package.json ./
RUN npm install --production

COPY . .

ENV CODEX_PROXY_PORT=3100

EXPOSE 3100

CMD ["node", "server.js"]
