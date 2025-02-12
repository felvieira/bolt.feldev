#!/bin/bash
set -e

echo "=== INICIANDO POSTDEPLOY ==="

# Função que aguarda a disponibilidade de um container utilizando um filtro de label
wait_for_container() {
  local filter="$1"
  local timeout=$2
  local container_id=""
  echo "Aguardando container com label ${filter}..."
  while [ $timeout -gt 0 ]; do
    container_id=$(docker ps --filter "label=${filter}" --format "{{.ID}}" | head -n 1)
    if [ -n "$container_id" ]; then
      echo "Container encontrado: $container_id"
      echo "$container_id"
      return 0
    fi
    sleep 2
    timeout=$((timeout-2))
  done
  echo "Container com label '${filter}' não encontrado após aguardar."
  return 1
}

# 1. Configurar o Wrangler Secret no container do serviço 'app'
app_container=$(wait_for_container "com.docker.compose.service=app" 60)
if [ -z "$app_container" ]; then
  echo "Container para o serviço 'app' não encontrado!"
  exit 1
fi

echo "=== Configurando Wrangler Secret para SESSION_SECRET no container 'app' ==="
docker exec -T "$app_container" sh -c "echo '$SESSION_SECRET' | wrangler secret put SESSION_SECRET"

# 2. Configurar o bucket no Minio no container do serviço 'supabase-minio'
minio_container=$(wait_for_container "com.docker.compose.service=supabase-minio" 60)
if [ -z "$minio_container" ]; then
  echo "Container para o serviço 'supabase-minio' não encontrado!"
  exit 1
fi

echo "=== Configurando bucket no Minio no container 'supabase-minio' ==="
# Dentro do container supabase-minio, o endpoint local é http://localhost:9000
docker exec -T "$minio_container" sh -c "mc alias set supabase-minio http://localhost:9000 ${SERVICE_USER_MINIO} ${SERVICE_PASSWORD_MINIO}"
docker exec -T "$minio_container" sh -c "mc mb --ignore-existing supabase-minio/bolt-app-files"

# 3. Executar as migrações do banco de dados no container do serviço 'supabase-db'
db_container=$(wait_for_container "com.docker.compose.service=supabase-db" 60)
if [ -z "$db_container" ]; then
  echo "Container para o serviço 'supabase-db' não encontrado!"
  exit 1
fi

echo "=== Executando migrações do banco de dados no container 'supabase-db' ==="
if [ -f migrations.sql ]; then
  echo "Executando migrations.sql..."
  docker exec -T "$db_container" sh -c "psql \"$DATABASE_URL\" -f migrations.sql"
elif [ -d migrations ]; then
  echo "Executando migrações na pasta 'migrations'..."
  for file in $(ls migrations/*.sql | sort); do
    echo "Executando $file..."
    docker exec -T "$db_container" sh -c "psql \"$DATABASE_URL\" -f \"$file\""
  done
else
  echo "Nenhum arquivo de migração encontrado."
fi

echo "=== Post-deploy concluído! ==="
