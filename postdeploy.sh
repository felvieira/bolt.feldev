#!/bin/bash
set -e

echo "=== INICIANDO POSTDEPLOY ==="

echo "=== Configurando Wrangler Secret para SESSION_SECRET ==="
echo "$SESSION_SECRET" | wrangler secret put SESSION_SECRET

echo "=== Verificando a existência da network 'bolt_network' ==="
if ! docker network inspect bolt_network >/dev/null 2>&1; then
  echo "Network 'bolt_network' não encontrada. Criando..."
  docker network create bolt_network
else
  echo "Network 'bolt_network' já existe."
fi

echo "=== Configurando bucket no Minio ==="
# Configura o alias para o Minio (certifique-se de que as variáveis SERVICE_USER_MINIO e SERVICE_PASSWORD_MINIO estejam definidas)
mc alias set supabase-minio http://supabase-minio:9000 "${SERVICE_USER_MINIO}" "${SERVICE_PASSWORD_MINIO}"
# Cria o bucket para os arquivos do Bolt (altere 'bolt-app-files' se necessário)
mc mb --ignore-existing supabase-minio/bolt-app-files

echo "=== Executando migrações do banco de dados ==="
if [ -f migrations.sql ]; then
  echo "Executando migrations.sql..."
  psql "$DATABASE_URL" -f migrations.sql
elif [ -d migrations ]; then
  echo "Executando migrações na pasta 'migrations'..."
  for file in $(ls migrations/*.sql | sort); do
    echo "Executando $file..."
    psql "$DATABASE_URL" -f "$file"
  done
else
  echo "Nenhum arquivo de migração encontrado."
fi

echo "=== Post-deploy concluído! ==="
