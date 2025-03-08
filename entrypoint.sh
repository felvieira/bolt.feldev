#!/bin/bash
set -e
echo "Starting entrypoint script for bolt.diy"

echo "Verificando variáveis de ambiente no container:"
echo "SUPABASE_URL presente: ${SUPABASE_URL:+yes}"
echo "SUPABASE_ANON_KEY presente: ${SUPABASE_ANON_KEY:+yes}"
echo "SUPABASE_SERVICE_KEY presente: ${SUPABASE_SERVICE_KEY:+yes}"
echo "SESSION_SECRET presente: ${SESSION_SECRET:+yes}"

# --- Função: Criação Consolidada dos Arquivos de Ambiente ---
create_env_files() {
  echo "Criando arquivos de ambiente consolidados..."
  cat > .env.local << 'EOF'
# .env.local - Utilizado pelo runtime da aplicação
SESSION_SECRET='${SESSION_SECRET}'
SUPABASE_URL='${SUPABASE_URL}'
SUPABASE_ANON_KEY='${SUPABASE_ANON_KEY}'
SUPABASE_SERVICE_KEY='${SUPABASE_SERVICE_KEY}'
DATABASE_URL='${DATABASE_URL}'
NODE_ENV='${NODE_ENV:-production}'
RUNNING_IN_DOCKER='true'
DEFAULT_NUM_CTX='${DEFAULT_NUM_CTX}'
GROQ_API_KEY='${GROQ_API_KEY}'
HuggingFace_API_KEY='${HuggingFace_API_KEY}'
OPENAI_API_KEY='${OPENAI_API_KEY}'
ANTHROPIC_API_KEY='${ANTHROPIC_API_KEY}'
OPEN_ROUTER_API_KEY='${OPEN_ROUTER_API_KEY}'
GOOGLE_GENERATIVE_AI_API_KEY='${GOOGLE_GENERATIVE_AI_API_KEY}'
OLLAMA_API_BASE_URL='${OLLAMA_API_BASE_URL}'
OPENAI_LIKE_API_BASE_URL='${OPENAI_LIKE_API_BASE_URL}'
OPENAI_LIKE_API_KEY='${OPENAI_LIKE_API_KEY}'
TOGETHER_API_BASE_URL='${TOGETHER_API_BASE_URL}'
TOGETHER_API_KEY='${TOGETHER_API_KEY}'
DEEPSEEK_API_KEY='${DEEPSEEK_API_KEY}'
HYPERBOLIC_API_KEY='${HYPERBOLIC_API_KEY}'
HYPERBOLIC_API_BASE_URL='${HYPERBOLIC_API_BASE_URL}'
MISTRAL_API_KEY='${MISTRAL_API_KEY}'
COHERE_API_KEY='${COHERE_API_KEY}'
LMSTUDIO_API_BASE_URL='${LMSTUDIO_API_BASE_URL}'
XAI_API_KEY='${XAI_API_KEY}'
PERPLEXITY_API_KEY='${PERPLEXITY_API_KEY}'
AWS_BEDROCK_CONFIG='${AWS_BEDROCK_CONFIG}'
VITE_LOG_LEVEL='${VITE_LOG_LEVEL:-debug}'
EOF
  # Duplicar para os outros arquivos necessários
  cp .env.local .dev.vars
  cp .env.local .env
}

# --- Persistência ou Geração de SESSION_SECRET ---
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

# --- Atualização das Credenciais do Supabase ---
if [ -f "./update-supabase-creds.sh" ]; then
  echo "Executando update-supabase-creds.sh para injeção direta das credenciais do Supabase..."
  chmod +x ./update-supabase-creds.sh
  ./update-supabase-creds.sh
else
  echo "WARNING: update-supabase-creds.sh não encontrado. Pulando injeção das credenciais do Supabase."
fi

# --- Criação dos Arquivos de Ambiente (somente se ainda não existirem) ---
if [ ! -f ".env.local" ]; then
  create_env_files
else
  echo ".env.local já existe, pulando criação dos arquivos de ambiente."
fi

# --- Preparação das Bindings para o Wrangler ---
DIRECT_BINDINGS="--binding SESSION_SECRET='${SESSION_SECRET}' --binding SUPABASE_URL='${SUPABASE_URL}' --binding SUPABASE_ANON_KEY='${SUPABASE_ANON_KEY}' --binding SUPABASE_SERVICE_KEY='${SUPABASE_SERVICE_KEY}'"

if [ -f "./bindings.sh" ]; then
  echo "Gerando bindings usando bindings.sh..."
  chmod +x ./bindings.sh
  BINDINGS=$(./bindings.sh)
  if [[ "$BINDINGS" != *"--binding SUPABASE_URL="* ]]; then
    echo "Adicionando bindings do Supabase ao output de bindings.sh."
    BINDINGS="$BINDINGS $DIRECT_BINDINGS"
  fi
  echo "Iniciando aplicação com bindings combinados."
  exec env SUPABASE_URL="${SUPABASE_URL}" SUPABASE_ANON_KEY="${SUPABASE_ANON_KEY}" \
       SUPABASE_SERVICE_KEY="${SUPABASE_SERVICE_KEY}" SESSION_SECRET="${SESSION_SECRET}" \
       wrangler pages dev ./build/client --script ./build/client/_worker.js ${BINDINGS} --ip 0.0.0.0 --port 5173 --no-show-interactive-dev-session
else
  echo "Iniciando aplicação com bindings diretos."
  exec env SUPABASE_URL="${SUPABASE_URL}" SUPABASE_ANON_KEY="${SUPABASE_ANON_KEY}" \
       SUPABASE_SERVICE_KEY="${SUPABASE_SERVICE_KEY}" SESSION_SECRET="${SESSION_SECRET}" \
       wrangler pages dev ./build/client --script ./build/client/_worker.js ${DIRECT_BINDINGS} --ip 0.0.0.0 --port 5173 --no-show-interactive-dev-session
fi
