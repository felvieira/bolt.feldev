#!/bin/bash
set -e

echo "###############################################################################"
echo "# 0. DEFINIÇÕES E VARIÁVEIS GLOBAIS"
echo "###############################################################################"
echo ""
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
LOG_FILE="/tmp/postdeploy_${TIMESTAMP}.log"
BACKUP_FILE="/tmp/db_backup_${TIMESTAMP}.sql"

# Diretórios
LOCAL_MIGRATIONS_DIR="migrations"

# Tabela para verificação de migrações
CHECK_TABLE="chats"

# Nome do bucket no MinIO
MINIO_BUCKET="bolt-app-files"

# Configurações de conexão (via variáveis de ambiente)
MINIO_HOST=${MINIO_HOST:-"supabase-minio"}
MINIO_PORT=${MINIO_PORT:-"9000"}
MINIO_USER=${SERVICE_USER_MINIO}
MINIO_PASSWORD=${SERVICE_PASSWORD_MINIO}

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

log "=== INICIANDO SCRIPT DE CONFIGURAÇÃO DIRETA DO SUPABASE ==="
log "Registrando em: $LOG_FILE"

echo "###############################################################################"
echo "# 1. VERIFICAR CONEXÃO COM MINIO"
echo "###############################################################################"
echo ""
log "Verificando conexão com MinIO..."

# Verificar se o MinIO client está instalado
if ! command -v mc &> /dev/null; then
    log "Cliente MinIO não encontrado, instalando..."
    wget https://dl.min.io/client/mc/release/linux-amd64/mc -O /usr/local/bin/mc
    chmod +x /usr/local/bin/mc
fi

# Configurar cliente MinIO
log "Configurando cliente MinIO (${MINIO_HOST}:${MINIO_PORT})..."
mc alias set supabase-minio "http://${MINIO_HOST}:${MINIO_PORT}" "${MINIO_USER}" "${MINIO_PASSWORD}"

if [ $? -ne 0 ]; then
    handle_error "Não foi possível conectar ao MinIO. Verifique as credenciais e conexão." "fatal"
fi

echo "###############################################################################"
echo "# 2. VERIFICAR/CONFIGURAR BUCKET NO MINIO"
echo "###############################################################################"
echo ""
# Verificar se o bucket já existe
log "Verificando se o bucket '$MINIO_BUCKET' já existe..."
bucket_exists=$(mc ls supabase-minio | grep -c "$MINIO_BUCKET" || true)

if [ "$bucket_exists" -eq 0 ]; then
  log "Bucket '$MINIO_BUCKET' não existe. Criando..."
  mc mb supabase-minio/$MINIO_BUCKET
  
  if [ $? -ne 0 ]; then
    handle_error "Falha ao criar bucket no MinIO." "fatal"
  else
    log "Bucket '$MINIO_BUCKET' criado com sucesso!"
  fi
else
  log "Bucket '$MINIO_BUCKET' já existe. Verificando políticas..."
fi

# Verificar política atual antes de aplicar nova
log "Verificando políticas existentes no bucket..."
current_policy=$(mc anonymous get supabase-minio/$MINIO_BUCKET)

log "Política atual: $current_policy"

# Configurar permissões no bucket
log "Configurando permissões restritas no bucket do MinIO..."

# Cria uma política de acesso personalizada
POLICY_FILE="/tmp/bucket_policy.json"
cat > $POLICY_FILE << EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "AWS": ["*"]
      },
      "Action": [
        "s3:GetObject",
        "s3:PutObject",
        "s3:DeleteObject",
        "s3:ListBucket"
      ],
      "Resource": [
        "arn:aws:s3:::${MINIO_BUCKET}/*",
        "arn:aws:s3:::${MINIO_BUCKET}"
      ],
      "Condition": {
        "StringEquals": {
          "aws:UserAgent": "bolt-app-client"
        }
      }
    }
  ]
}
EOF

# Aplica a política ao bucket
mc anonymous set none supabase-minio/$MINIO_BUCKET
mc policy set $POLICY_FILE supabase-minio/$MINIO_BUCKET

log "=== Bucket configurado com permissões adequadas ==="

echo "###############################################################################"
echo "# 3. EXTRAIR INFORMAÇÕES DE CONEXÃO COM O BANCO"
echo "###############################################################################"
echo ""

# Extrai informações da DATABASE_URL se estiver definida, caso contrário usa variáveis específicas
if [ -n "$DATABASE_URL" ]; then
    log "Extraindo informações de conexão da DATABASE_URL..."
    # Remove o prefixo "postgresql://" ou "postgres://"
    STR="$(echo "$DATABASE_URL" | sed 's#^\(postgres\|postgresql\)://##')"
    
    # Separa USER:PASS de HOST:PORT/DB
    USERPASS="$(echo "$STR" | cut -d'@' -f1)"        # postgres:secret
    HOSTPORTDB="$(echo "$STR" | cut -d'@' -f2)"      # my-postgres:5432/postgres
    
    PG_USER="$(echo "$USERPASS" | cut -d':' -f1)"    # postgres
    PG_PASSWORD="$(echo "$USERPASS" | cut -d':' -f2)" 
    HOSTPORT="$(echo "$HOSTPORTDB" | cut -d'/' -f1)" # my-postgres:5432
    PG_DATABASE="$(echo "$HOSTPORTDB" | cut -d'/' -f2)"  # postgres
    PG_HOST="$(echo "$HOSTPORT" | cut -d':' -f1)"    # my-postgres
    PG_PORT="$(echo "$HOSTPORT" | cut -d':' -f2)"    # 5432
else
    log "DATABASE_URL não encontrada, usando variáveis de ambiente específicas..."
    PG_HOST=${PG_HOST:-"supabase-db"}
    PG_PORT=${PG_PORT:-"5432"}
    PG_USER=${PG_USER:-"postgres"}
    PG_PASSWORD=${PG_PASSWORD}
    PG_DATABASE=${PG_DATABASE:-"postgres"}
fi

log "=== Dados extraídos para conexão PostgreSQL ==="
log "PG_HOST=$PG_HOST"
log "PG_PORT=$PG_PORT"
log "PG_USER=$PG_USER"
log "PG_PASSWORD=[oculto]"
log "PG_DATABASE=$PG_DATABASE"

echo "###############################################################################"
echo "# 4. VERIFICAR CONEXÃO COM POSTGRESQL"
echo "###############################################################################"
echo ""
log "Verificando conexão com PostgreSQL..."

# Verificar se cliente PostgreSQL está instalado
if ! command -v psql &> /dev/null; then
    log "Cliente PostgreSQL não encontrado, instalando..."
    apt-get update && apt-get install -y postgresql-client
fi

# Testar conexão
log "Testando conexão com PostgreSQL (${PG_HOST}:${PG_PORT})..."
PGPASSWORD="$PG_PASSWORD" psql -h "$PG_HOST" -p "$PG_PORT" -U "$PG_USER" -d "$PG_DATABASE" -c "SELECT 1" > /dev/null

if [ $? -ne 0 ]; then
    handle_error "Não foi possível conectar ao PostgreSQL. Verifique as credenciais e conexão." "fatal"
fi

log "Conexão com PostgreSQL estabelecida com sucesso."

echo "###############################################################################"
echo "# 5. VERIFICAR SE O SCHEMA E TABELAS JÁ EXISTEM"
echo "###############################################################################"
echo ""
log "Verificando se o schema auth e a tabela chats já existem..."

# Verificar schema auth
schema_auth_exists=$(PGPASSWORD="$PG_PASSWORD" psql -h "$PG_HOST" -p "$PG_PORT" -U "$PG_USER" -d "$PG_DATABASE" -tAc "SELECT EXISTS(SELECT 1 FROM information_schema.schemata WHERE schema_name = 'auth');")

# Verificar tabela auth.users
auth_users_exists=$(PGPASSWORD="$PG_PASSWORD" psql -h "$PG_HOST" -p "$PG_PORT" -U "$PG_USER" -d "$PG_DATABASE" -tAc "SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema = 'auth' AND table_name = 'users');")

# Verificar tabela chats
chats_table_exists=$(PGPASSWORD="$PG_PASSWORD" psql -h "$PG_HOST" -p "$PG_PORT" -U "$PG_USER" -d "$PG_DATABASE" -tAc "SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'chats');")

# Verificar índices na tabela chats
idx_url_id_exists=""
idx_timestamp_exists=""

if [ "$(echo "$chats_table_exists" | xargs)" = "t" ]; then
  idx_url_id_exists=$(PGPASSWORD="$PG_PASSWORD" psql -h "$PG_HOST" -p "$PG_PORT" -U "$PG_USER" -d "$PG_DATABASE" -tAc "SELECT EXISTS(SELECT 1 FROM pg_indexes WHERE tablename = 'chats' AND indexname = 'idx_chats_url_id');")
  
  idx_timestamp_exists=$(PGPASSWORD="$PG_PASSWORD" psql -h "$PG_HOST" -p "$PG_PORT" -U "$PG_USER" -d "$PG_DATABASE" -tAc "SELECT EXISTS(SELECT 1 FROM pg_indexes WHERE tablename = 'chats' AND indexname = 'idx_chats_timestamp');")
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
    PGPASSWORD="$PG_PASSWORD" pg_dump -h "$PG_HOST" -p "$PG_PORT" -U "$PG_USER" -d "$PG_DATABASE" -f "$BACKUP_FILE"

    if [ $? -eq 0 ]; then
      log "Backup criado com sucesso em: $BACKUP_FILE"
    else
      log "AVISO: Não foi possível criar backup. Continuando mesmo assim..."
    fi
  fi
fi

echo "###############################################################################"
echo "# 6. APLICAR MIGRAÇÕES SE NECESSÁRIO"
echo "###############################################################################"
echo ""
if [ "$should_run_migrations" = true ]; then
  log "=== Aplicando migrações (.sql), se existirem ==="
  migration_success=true

  # Aplicar migrations diretamente do diretório local
  if [ -d "$LOCAL_MIGRATIONS_DIR" ]; then
    log "Listando arquivos de migração disponíveis:"
    find "$LOCAL_MIGRATIONS_DIR" -name "*.sql" -type f | while read -r file; do
      log "  - $(basename "$file")"
    done
    
    find "$LOCAL_MIGRATIONS_DIR" -name "*.sql" -type f | sort | while read -r sql_file; do
      filename=$(basename "$sql_file")
      log "Aplicando $filename..."
      
      # Executa o script de migração
      migration_output=$(PGPASSWORD="$PG_PASSWORD" psql -h "$PG_HOST" -p "$PG_PORT" -U "$PG_USER" -d "$PG_DATABASE" -f "$sql_file" 2>&1)
      
      migration_status=$?
      
      if [ $migration_status -eq 0 ]; then
        log "✅ Migração '$filename' aplicada com sucesso."
      else
        log "❌ ERRO ao aplicar migração '$filename': $migration_output"
        migration_success=false
      fi
    done
  else
    log "AVISO: Pasta '$LOCAL_MIGRATIONS_DIR' não existe ou não é um diretório. Pulando etapa de migrações."
  fi

  if [ "$migration_success" = false ]; then
    log "AVISO: Houve erros durante a aplicação das migrações. Verifique os logs acima."
  else
    log "=== Execução das migrações concluída com sucesso. ==="
  fi

  echo "###############################################################################"
  echo "# 7. VERIFICAR SE AS MIGRAÇÕES FORAM APLICADAS"
  echo "###############################################################################"
  echo ""
  log "=== Verificando se a tabela '$CHECK_TABLE' existe ==="

  table_exists_after=$(PGPASSWORD="$PG_PASSWORD" psql -h "$PG_HOST" -p "$PG_PORT" -U "$PG_USER" -d "$PG_DATABASE" -tAc "SELECT to_regclass('public.$CHECK_TABLE');")

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

echo "###############################################################################"
echo "# 8. INFORMAÇÕES PARA TROUBLESHOOTING"
echo "###############################################################################"
echo ""
log "=== INFORMAÇÕES PARA TROUBLESHOOTING ==="
log "Para conectar ao banco de dados manualmente, use:"
log "PGPASSWORD='$PG_PASSWORD' psql -h $PG_HOST -p $PG_PORT -U $PG_USER -d $PG_DATABASE"
log ""
log "Para listar todas as tabelas públicas:"
log "\\dt"
log ""
log "Para ver o conteúdo da tabela $CHECK_TABLE (se existir):"
log "SELECT * FROM $CHECK_TABLE LIMIT 10;"

log "=== CONFIGURAÇÃO DIRETA DO SUPABASE FINALIZADA! ==="
