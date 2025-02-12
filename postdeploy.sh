#!/bin/bash
set -e

echo "=== INICIANDO POSTDEPLOY ==="

# Função para aguardar por um container com filtros especificados
wait_for_container() {
  local filter_args="$1"
  local timeout="$2"
  local container_id=""
  echo "Aguardando container com filtros: $filter_args"
  while [ $timeout -gt 0 ]; do
    container_id=$(docker ps $filter_args --format "{{.ID}}" | head -n 1)
    if [ -n "$container_id" ]; then
      echo "Container encontrado: $container_id"
      echo "$container_id"
      return 0
    fi
    sleep 2
    timeout=$((timeout-2))
  done
  echo "Container não encontrado após aguardar."
  return 1
}

# 1. Injetar SESSION_SECRET no container do serviço "app"
app_container=$(wait_for_container '--filter "label=com.docker.compose.service=app"' 60)
if [ -z "$app_container" ]; then
  echo "Container para o serviço 'app' não encontrado!"
  exit 1
fi

echo "=== Configurando Wrangler Secret para SESSION_SECRET no container 'app' ==="
docker exec -T "$app_container" sh -c "echo '$SESSION_SECRET' | wrangler secret put SESSION_SECRET"

# 2. Configurar o bucket no Minio
# Procura pelo container cujo nome contenha "supabase-minio" na rede bolt_network
minio_container=$(wait_for_container '--filter "network=bolt_network" --filter "name=supabase-minio"' 60)
if [ -z "$minio_container" ]; then
  echo "Container para o serviço 'supabase-minio' não encontrado na rede bolt_network!"
  exit 1
fi

echo "=== Configurando bucket no Minio no container 'supabase-minio' ==="
# Dentro do container, o endpoint do Minio é "http://localhost:9000"
docker exec -T "$minio_container" sh -c "mc alias set supabase-minio http://localhost:9000 \"${SERVICE_USER_MINIO}\" \"${SERVICE_PASSWORD_MINIO}\""
docker exec -T "$minio_container" sh -c "mc mb --ignore-existing supabase-minio/bolt-app-files"

# 3. Executar migrações do banco de dados no container do Supabase
db_container=$(wait_for_container '--filter "label=com.docker.compose.service=supabase-db"' 60)
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
