#!/bin/bash
set -e
echo "Starting entrypoint script for bolt.diy"

echo "Verificando variáveis de ambiente no container:"
echo "SUPABASE_URL presente: ${SUPABASE_URL:+yes}"
echo "SUPABASE_ANON_KEY presente: ${SUPABASE_ANON_KEY:+yes}"
echo "SUPABASE_SERVICE_KEY presente: ${SUPABASE_SERVICE_KEY:+yes}"
echo "SESSION_SECRET presente: ${SESSION_SECRET:+yes}"

#########################################
# 1. Persistência ou Geração de SESSION_SECRET
#########################################
PERSISTED_SECRET_PATH="/app/session-data/session-secret"
if [ -z "${SESSION_SECRET}" ] && [ -f "${PERSISTED_SECRET_PATH}" ]; then
  echo "Encontrado SESSION_SECRET persistido, utilizando-o."
  export SESSION_SECRET=$(cat "${PERSISTED_SECRET_PATH}")
fi

if [ -z "${SESSION_SECRET}" ]; then
  echo "WARNING: SESSION_SECRET não está definido!"
  if [ -f "./coolify-setup.sh" ]; then
    echo "Executando coolify-setup.sh para gerar SESSION_SECRET"
    chmod +x ./coolify-setup.sh
    ./coolify-setup.sh
  else
    export SESSION_SECRET=$(openssl rand -base64 32)
    echo "SESSION_SECRET temporário gerado."
  fi
else
  echo "SESSION_SECRET randomizado foi definido."
fi

#########################################
# 2. Verificação e Injeção das Variáveis do Supabase
#########################################
if [ -z "${SUPABASE_URL}" ] || [ -z "${SUPABASE_ANON_KEY}" ] || [ -z "${SUPABASE_SERVICE_KEY}" ]; then
  echo "WARNING: Uma ou mais variáveis críticas do Supabase estão ausentes."
  if [ -f "./update-supabase-creds.sh" ]; then
    echo "Executando update-supabase-creds.sh para injetar as credenciais do Supabase..."
    chmod +x ./update-supabase-creds.sh
    ./update-supabase-creds.sh
  else
    echo "ERROR: update-supabase-creds.sh não encontrado. Não foi possível injetar as credenciais do Supabase."
    exit 1
  fi
else
  echo "Variáveis do Supabase estão definidas."
fi

#########################################
# 3. Patch dos Arquivos de Ambiente
#########################################
patch_env_files() {
  ENV_FILE=".env.local"
  echo "Atualizando (patch) arquivo de ambiente: $ENV_FILE"
  # Se o arquivo não existir, cria um cabeçalho básico
  if [ ! -f "$ENV_FILE" ]; then
    echo "# .env.local - Utilizado pelo runtime da aplicação" > "$ENV_FILE"
  fi

  VARS_LIST="SESSION_SECRET SUPABASE_URL SUPABASE_ANON_KEY SUPABASE_SERVICE_KEY DATABASE_URL NODE_ENV RUNNING_IN_DOCKER DEFAULT_NUM_CTX GROQ_API_KEY HuggingFace_API_KEY OPENAI_API_KEY ANTHROPIC_API_KEY OPEN_ROUTER_API_KEY GOOGLE_GENERATIVE_AI_API_KEY OLLAMA_API_BASE_URL OPENAI_LIKE_API_BASE_URL OPENAI_LIKE_API_KEY TOGETHER_API_BASE_URL TOGETHER_API_KEY DEEPSEEK_API_KEY HYPERBOLIC_API_KEY HYPERBOLIC_API_BASE_URL MISTRAL_API_KEY COHERE_API_KEY LMSTUDIO_API_BASE_URL XAI_API_KEY PERPLEXITY_API_KEY AWS_BEDROCK_CONFIG VITE_LOG_LEVEL"
  
  for var in $VARS_LIST; do
    value=$(printenv $var)
    if grep -q "^$var=" "$ENV_FILE"; then
      sed -i "s|^$var=.*|$var=$value|" "$ENV_FILE"
    else
      echo "$var=$value" >> "$ENV_FILE"
    fi
  done

  # Duplica o arquivo para os demais ambientes
  cp "$ENV_FILE" .dev.vars
  cp "$ENV_FILE" .env
}

patch_env_files

#########################################
# 4. Gerar Bindings para o Wrangler
#########################################
if [ -f "./bindings.sh" ]; then
  echo "Gerando bindings usando bindings.sh..."
  chmod +x ./bindings.sh
  BINDINGS=$(./bindings.sh)
else
  echo "bindings.sh não encontrado, usando fallback de bindings."
  BINDINGS="--binding SESSION_SECRET='${SESSION_SECRET}' --binding SUPABASE_URL='${SUPABASE_URL}' --binding SUPABASE_ANON_KEY='${SUPABASE_ANON_KEY}' --binding SUPABASE_SERVICE_KEY='${SUPABASE_SERVICE_KEY}'"
fi

echo "Bindings gerados: $BINDINGS"

#########################################
# 5. Inicia a Aplicação com Wrangler
#########################################
echo "Iniciando aplicação com wrangler..."
exec env SUPABASE_URL="${SUPABASE_URL}" SUPABASE_ANON_KEY="${SUPABASE_ANON_KEY}" \
       SUPABASE_SERVICE_KEY="${SUPABASE_SERVICE_KEY}" SESSION_SECRET="${SESSION_SECRET}" \
       wrangler pages dev ./build/client ${BINDINGS} --ip 0.0.0.0 --port 5173 --no-show-interactive-dev-session
