#!/bin/bash
set -e

# Tenta injetar o secret no Cloudflare Worker via Wrangler de forma não interativa.
# Se o secret já existir, o comando pode falhar, mas usamos '|| true' para ignorar a falha.
echo "$SESSION_SECRET" | wrangler secret put SESSION_SECRET --stdin || true

# Agora inicia o processo principal da aplicação
exec pnpm run dockerstart
