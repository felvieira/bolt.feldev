#!/bin/bash
set -e

###############################################################################
# 0. DEFINIÇÕES E VARIÁVEIS GLOBAIS
###############################################################################
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
LOG_FILE="/tmp/postdeploy_${TIMESTAMP}.log"
BACKUP_FILE="/tmp/db_backup_${TIMESTAMP}.sql"

# Diretórios
LOCAL_MIGRATIONS_DIR="migrations"
TMP_DIR="/tmp/db_migrations"

# Tabela para verificação de migrações
CHECK_TABLE="chats"

# Nome do bucket no MinIO
MINIO_BUCKET="bolt-app-files"

# Função para logging
log() {
  echo "[$(date +"%Y-%m-%d %H:%M:%S")] $1" | tee -a "$LOG_FILE"
}

# Função para tratamento de erros
handle_error() {
  log "ERRO: $1"
  if [ "$2" == "fatal" ]; then
    log "Erro fatal. Abortando script de post-deploy."
    exit 1
  fi
}

log "=== INICIANDO SCRIPT DE CONFIGURAÇÃO DO SUPABASE ==="
log "Registrando em: $LOG_FILE"

###############################################################################
# 1. FUNÇÃO: aguardar até encontrar um container cujo nome inclua um padrão
###############################################################################
wait_for_container() {
  local pattern="$1"
  local timeout="${2:-30}"
  local container_id=""
  
  for ((i=1; i<=$timeout; i++)); do
    container_id=$(docker ps --filter "name=$pattern" --format "{{.ID}}" | head -n 1)
    if [ -n "$container_id" ]; then
      log "Container '$pattern' encontrado com ID: $container_id"
      echo "$container_id"
      return 0
    fi
    log "Aguardando container '$pattern' (tentativa $i/$timeout)..."
    sleep 2
  done
  
  echo ""
  return 1
}

###############################################################################
# 2. LOCALIZAR CONTAINER DO MINIO E VERIFICAR/CONFIGURAR BUCKET
###############################################################################
log "Localizando container do MinIO..."
minio_container=$(wait_for_container "supabase-minio" 60)
if [ -z "$minio_container" ]; then
  handle_error "Container do MinIO não encontrado (filtro: 'supabase-minio')." "fatal"
fi

log "=== Container MinIO encontrado: $minio_container ==="

# Essas variáveis devem estar definidas no ambiente do post-deploy
if [ -z "$SERVICE_USER_MINIO" ] || [ -z "$SERVICE_PASSWORD_MINIO" ]; then
  handle_error "Variáveis SERVICE_USER_MINIO ou SERVICE_PASSWORD_MINIO não definidas." "fatal"
fi

# Configurar o cliente MinIO
docker exec -T "$minio_container" sh -c "
  mc alias set supabase-minio http://localhost:9000 \"$SERVICE_USER_MINIO\" \"$SERVICE_PASSWORD_MINIO\"
"

# Verificar se o bucket já existe
log "Verificando se o bucket '$MINIO_BUCKET' já existe..."
bucket_exists=$(docker exec -T "$minio_container" sh -c "
  mc ls supabase-minio | grep -c \"$MINIO_BUCKET\" || true
")

if [ "$bucket_exists" -eq 0 ]; then
  log "Bucket '$MINIO_BUCKET' não existe. Criando..."
  minio_config_result=$(docker exec -T "$minio_container" sh -c "
    mc mb supabase-minio/$MINIO_BUCKET
  ")
  
  if [ $? -ne 0 ]; then
    handle_error "Falha ao criar bucket no MinIO: $minio_config_result"
  else
    log "Bucket '$MINIO_BUCKET' criado com sucesso!"
  fi
else
  log "Bucket '$MINIO_BUCKET' já existe. Verificando políticas..."
fi

# Verificar política atual antes de aplicar nova
log "Verificando políticas existentes no bucket..."
current_policy=$(docker exec -T "$minio_container" sh -c "
  mc anonymous get supabase-minio/$MINIO_BUCKET
")

log "Política atual: $current_policy"

# Configurar permissões no bucket
log "Configurando permissões restritas no bucket do MinIO..."

# Cria uma política de acesso personalizada
POLICY_FILE="/tmp/bucket_policy.json"
docker exec -T "$minio_container" sh -c "cat > $POLICY_FILE << 'EOF'
{
  \"Version\": \"2012-10-17\",
  \"Statement\": [
    {
      \"Effect\": \"Allow\",
      \"Principal\": {
        \"AWS\": [\"*\"]
      },
      \"Action\": [
        \"s3:GetObject\",
        \"s3:PutObject\",
        \"s3:DeleteObject\",
        \"s3:ListBucket\"
      ],
      \"Resource\": [
        \"arn:aws:s3:::${MINIO_BUCKET}/*\",
        \"arn:aws:s3:::${MINIO_BUCKET}\"
      ],
      \"Condition\": {
        \"StringEquals\": {
          \"aws:UserAgent\": \"bolt-app-client\"
        }
      }
    }
  ]
}
EOF"

# Aplica a política ao bucket
docker exec -T "$minio_container" sh -c "mc anonymous set none supabase-minio/$MINIO_BUCKET"
docker exec -T "$minio_container" sh -c "mc policy set $POLICY_FILE supabase-minio/$MINIO_BUCKET"

log "=== Bucket configurado com permissões adequadas ==="

###############################################################################
# 3. LOCALIZAR CONTAINER DO DB (SUPABASE/POSTGRES)
###############################################################################
log "Localizando container do banco de dados..."
db_container=$(wait_for_container "supabase-db" 60)
if [ -z "$db_container" ]; then
  handle_error "Container do DB não encontrado (filtro: 'supabase-db')." "fatal"
fi

log "=== Container DB encontrado: $db_container ==="

###############################################################################
# 4. PARSEAR A DATABASE_URL PARA EXTRAIR USUÁRIO, SENHA, HOST, PORTA, NOME DO DB
###############################################################################
if [ -z "$DATABASE_URL" ]; then
  handle_error "Variável DATABASE_URL não está definida." "fatal"
fi

# Exemplo: postgresql://postgres:secret@my-postgres:5432/postgres
# Remove o prefixo "postgresql://" ou "postgres://"
STR="$(echo "$DATABASE_URL" | sed 's#^\(postgres\|postgresql\)://##')"

# Separa USER:PASS de HOST:PORT/DB
USERPASS="$(echo "$STR" | cut -d'@' -f1)"        # postgres:secret
HOSTPORTDB="$(echo "$STR" | cut -d'@' -f2)"      # my-postgres:5432/postgres

DB_USER="$(echo "$USERPASS" | cut -d':' -f1)"    # postgres
DB_PASSWORD="$(echo "$USERPASS" | cut -d':' -f2)" 
HOSTPORT="$(echo "$HOSTPORTDB" | cut -d'/' -f1)" # my-postgres:5432
DB_NAME="$(echo "$HOSTPORTDB" | cut -d'/' -f2)"  # postgres
DB_HOST="$(echo "$HOSTPORT" | cut -d':' -f1)"    # my-postgres
DB_PORT="$(echo "$HOSTPORT" | cut -d':' -f2)"    # 5432

log "=== Dados extraídos da DATABASE_URL ==="
log "DB_USER=$DB_USER"
log "DB_PASSWORD=[oculto]"
log "DB_HOST=$DB_HOST"
log "DB_PORT=$DB_PORT"
log "DB_NAME=$DB_NAME"

###############################################################################
# 5. VERIFICAR SE O SCHEMA E TABELAS JÁ EXISTEM
###############################################################################
log "Verificando se o schema auth e a tabela chats já existem..."

# Verificar schema auth
schema_auth_exists=$(docker exec -e PGPASSWORD="$DB_PASSWORD" -T "$db_container" \
  sh -c "psql -U $DB_USER -h localhost -p $DB_PORT -d $DB_NAME -tAc \"SELECT EXISTS(SELECT 1 FROM information_schema.schemata WHERE schema_name = 'auth');\"")

# Verificar tabela auth.users
auth_users_exists=$(docker exec -e PGPASSWORD="$DB_PASSWORD" -T "$db_container" \
  sh -c "psql -U $DB_USER -h localhost -p $DB_PORT -d $DB_NAME -tAc \"SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema = 'auth' AND table_name = 'users');\"")

# Verificar tabela chats
chats_table_exists=$(docker exec -e PGPASSWORD="$DB_PASSWORD" -T "$db_container" \
  sh -c "psql -U $DB_USER -h localhost -p $DB_PORT -d $DB_NAME -tAc \"SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'chats');\"")

# Verificar índices na tabela chats
idx_url_id_exists=""
idx_timestamp_exists=""

if [ "$(echo "$chats_table_exists" | xargs)" = "t" ]; then
  idx_url_id_exists=$(docker exec -e PGPASSWORD="$DB_PASSWORD" -T "$db_container" \
    sh -c "psql -U $DB_USER -h localhost -p $DB_PORT -d $DB_NAME -tAc \"SELECT EXISTS(SELECT 1 FROM pg_indexes WHERE tablename = 'chats' AND indexname = 'idx_chats_url_id');\"")
  
  idx_timestamp_exists=$(docker exec -e PGPASSWORD="$DB_PASSWORD" -T "$db_container" \
    sh -c "psql -U $DB_USER -h localhost -p $DB_PORT -d $DB_NAME -tAc \"SELECT EXISTS(SELECT 1 FROM pg_indexes WHERE tablename = 'chats' AND indexname = 'idx_chats_timestamp');\"")
fi

log "Schema auth existe: $(echo "$schema_auth_exists" | xargs)"
log "Tabela auth.users existe: $(echo "$auth_users_exists" | xargs)"
log "Tabela chats existe: $(echo "$chats_table_exists" | xargs)"

if [ "$(echo "$chats_table_exists" | xargs)" = "t" ]; then
  log "Índice idx_chats_url_id existe: $(echo "$idx_url_id_exists" | xargs)"
  log "Índice idx_chats_timestamp existe: $(echo "$idx_timestamp_exists" | xargs)"
fi

# Verificar se tudo já está configurado corretamente
if [ "$(echo "$schema_auth_exists" | xargs)" = "t" ] && \
   [ "$(echo "$auth_users_exists" | xargs)" = "t" ] && \
   [ "$(echo "$chats_table_exists" | xargs)" = "t" ] && \
   [ "$(echo "$idx_url_id_exists" | xargs)" = "t" ] && \
   [ "$(echo "$idx_timestamp_exists" | xargs)" = "t" ]; then
   
  log "✅ Todas as tabelas e índices já existem e estão configurados corretamente!"
  log "Pulando etapa de migrações."
  should_run_migrations=false
else
  log "⚠️ Algumas tabelas ou índices não existem. Executando migrações..."
  should_run_migrations=true
  
  # Criar backup apenas se alguma estrutura já existir
  if [ "$(echo "$chats_table_exists" | xargs)" = "t" ]; then
    log "Criando backup do banco de dados antes de aplicar migrações..."
    docker exec -e PGPASSWORD="$DB_PASSWORD" -T "$db_container" \
      sh -c "pg_dump -U $DB_USER -h localhost -p $DB_PORT -d $DB_NAME -f $BACKUP_FILE"

    if [ $? -eq 0 ]; then
      log "Backup criado com sucesso em: $BACKUP_FILE"
    else
      log "AVISO: Não foi possível criar backup. Continuando mesmo assim..."
    fi
  fi
fi

###############################################################################
# 6. APLICAR MIGRAÇÕES SE NECESSÁRIO
###############################################################################
if [ "$should_run_migrations" = true ]; then
  log "Preparando diretório temporário para migrações..."
  # Remove e recria o diretório temporário no container do DB
  docker exec -T "$db_container" sh -c "rm -rf $TMP_DIR && mkdir -p $TMP_DIR"

  # Copia os arquivos de migração locais (arquivos .sql) para dentro do container
  if [ -d "$LOCAL_MIGRATIONS_DIR" ]; then
    log "=== Copiando arquivos .sql de '$LOCAL_MIGRATIONS_DIR' para o container ==="
    docker cp "$LOCAL_MIGRATIONS_DIR/." "$db_container:$TMP_DIR"
    
    # Listar arquivos copiados para validação
    migration_files=$(docker exec -T "$db_container" sh -c "find $TMP_DIR -name '*.sql' | sort")
    if [ -z "$migration_files" ]; then
      log "AVISO: Nenhum arquivo .sql encontrado para migração."
    else
      log "Arquivos de migração encontrados:"
      docker exec -T "$db_container" sh -c "find $TMP_DIR -name '*.sql' | sort" | while read -r file; do
        log "  - $(basename "$file")"
      done
    fi
  else
    log "AVISO: Pasta '$LOCAL_MIGRATIONS_DIR' não existe ou não é um diretório. Pulando etapa de migrações."
  fi

  log "=== Aplicando migrações (.sql), se existirem ==="
  migration_success=true

  docker exec -T "$db_container" sh -c "find $TMP_DIR -name '*.sql' -type f | sort" | while read -r sql_file; do
    filename=$(basename "$sql_file")
    log "Aplicando $filename..."
    
    # Executa o script de migração
    migration_output=$(docker exec -e PGPASSWORD="$DB_PASSWORD" -T "$db_container" \
      sh -c "psql -U $DB_USER -h localhost -p $DB_PORT -d $DB_NAME -f \"$sql_file\" 2>&1")
    
    migration_status=$?
    
    if [ $migration_status -eq 0 ]; then
      log "✅ Migração '$filename' aplicada com sucesso."
    else
      log "❌ ERRO ao aplicar migração '$filename': $migration_output"
      migration_success=false
    fi
  done

  if [ "$migration_success" = false ]; then
    log "AVISO: Houve erros durante a aplicação das migrações. Verifique os logs acima."
  else
    log "=== Execução das migrações concluída com sucesso. ==="
  fi

  ###############################################################################
  # 7. VERIFICAR SE AS MIGRAÇÕES FORAM APLICADAS
  ###############################################################################
  log "=== Verificando se a tabela '$CHECK_TABLE' existe ==="

  table_exists_after=$(docker exec -e PGPASSWORD="$DB_PASSWORD" -T "$db_container" \
    sh -c "psql -U $DB_USER -h localhost -p $DB_PORT -d $DB_NAME -tAc \"SELECT to_regclass('public.$CHECK_TABLE');\"")

  # Removendo possíveis espaços em branco
  table_exists_after="$(echo "$table_exists_after" | xargs)"

  if [ "$table_exists_after" = "public.$CHECK_TABLE" ] || [ "$table_exists_after" = "$CHECK_TABLE" ]; then
    log "✅ Sucesso: a tabela '$CHECK_TABLE' foi encontrada. Migrations foram aplicadas."
  else
    log "⚠️ AVISO: a tabela '$CHECK_TABLE' não foi encontrada após as migrações."
    log "   Verifique os logs acima para possíveis erros durante as migrações."
  fi
else
  log "Migrações não serão executadas pois as tabelas e índices já existem."
fi

log "=== INFORMAÇÕES PARA TROUBLESHOOTING ==="
log "Para conectar ao banco de dados manualmente, use:"
log "docker exec -it $db_container psql -U $DB_USER -d $DB_NAME"
log ""
log "Para listar todas as tabelas públicas:"
log "\\dt"
log ""
log "Para ver o conteúdo da tabela $CHECK_TABLE (se existir):"
log "SELECT * FROM $CHECK_TABLE LIMIT 10;"

log "=== CONFIGURAÇÃO DO SUPABASE FINALIZADA! ==="
