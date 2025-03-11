#!/bin/bash
set -e
echo "Starting Express entrypoint script for bolt.diy"

echo "Verificando variáveis de ambiente no container:"
echo "SUPABASE_URL presente: ${SUPABASE_URL:+yes}"
echo "SUPABASE_ANON_KEY presente: ${SUPABASE_ANON_KEY:+yes}"
echo "SUPABASE_SERVICE_KEY presente: ${SUPABASE_SERVICE_KEY:+yes}"
echo "SESSION_SECRET presente: ${SESSION_SECRET:+yes}"

if [ -z "${SESSION_SECRET}" ]; then
  echo "WARNING: SESSION_SECRET não definido."
else
  echo "SESSION_SECRET definido (valor oculto)."
fi

if [ -z "${SUPABASE_URL}" ] || [ -z "${SUPABASE_ANON_KEY}" ] || [ -z "${SUPABASE_SERVICE_KEY}" ]; then
  echo "WARNING: Algumas variáveis do Supabase não estão definidas."
else
  echo "Variáveis do Supabase definidas."
fi

# Verifica se a pasta build/server existe, se não, faz o build
if [ ! -d "/app/build/server" ] || [ ! -f "/app/build/server/index.js" ]; then
  echo "Build directory or server file not found, running build..."
  pnpm run build
  
  # Verify build was successful
  if [ ! -f "/app/build/server/index.js" ]; then
    echo "ERROR: Build failed, server file still not found!"
    exit 1
  else
    echo "Build completed successfully!"
  fi
else
  echo "Build directory found, skipping build."
fi

# Iniciar o servidor Express diretamente
echo "Iniciando servidor Express..."
exec node server.js
