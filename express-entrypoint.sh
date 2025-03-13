#!/bin/bash
set -e
echo "Starting Express entrypoint script for bolt.diy"

echo "Verificando variáveis de ambiente no container:"
echo "SUPABASE_URL presente: ${SUPABASE_URL:+yes}"
echo "SUPABASE_ANON_KEY presente: ${SUPABASE_ANON_KEY:+yes}"
echo "SUPABASE_SERVICE_KEY presente: ${SUPABASE_SERVICE_KEY:+yes}"
echo "SESSION_SECRET presente: ${SESSION_SECRET:+yes}"
echo "REDIS_URL presente: ${REDIS_URL:+yes}"

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

if [ -z "${REDIS_URL}" ]; then
  echo "WARNING: REDIS_URL não definido. Usando fallback para cookie storage."
else
  echo "REDIS_URL definido. Tentando conectar ao Redis."
fi

# Removido o bloco de verificação e execução do build
# O build agora é feito durante a criação da imagem Docker

# Iniciar o servidor Express diretamente
echo "Iniciando servidor Express..."
exec node server.js
