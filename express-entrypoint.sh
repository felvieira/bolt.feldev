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

# Iniciar o servidor Express diretamente
echo "Iniciando servidor Express..."
exec node server.js
