#!/bin/bash
set -e

echo "=== Configurando Wrangler Secret para SESSION_SECRET ==="
echo "$SESSION_SECRET" | wrangler secret put SESSION_SECRET --non-interactive

echo "=== Pré-deploy concluído! ==="
