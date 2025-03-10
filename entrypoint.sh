#!/bin/bash
set -e
echo "Starting Express entrypoint script for bolt.diy"

echo "Verificando variáveis de ambiente no container:"
echo "SUPABASE_URL presente: ${SUPABASE_URL:+yes}"
echo "SUPABASE_ANON_KEY presente: ${SUPABASE_ANON_KEY:+yes}"
echo "SUPABASE_SERVICE_KEY presente: ${SUPABASE_SERVICE_KEY:+yes}"
echo "SESSION_SECRET presente: ${SESSION_SECRET:+yes}"

#########################################
# 1. Garantir SESSION_SECRET (delegado a coolify-setup.sh)
#########################################
if [ -z "${SESSION_SECRET}" ]; then
  echo "SESSION_SECRET não definido. Executando coolify-setup.sh para gerar/injetar SESSION_SECRET."
  if [ -f "./coolify-setup.sh" ]; then
    chmod +x ./coolify-setup.sh
    ./coolify-setup.sh
  else
    echo "ERROR: coolify-setup.sh não encontrado."
    exit 1
  fi
else
  echo "SESSION_SECRET definido (valor oculto)."
fi

#########################################
# 2. Verificação e Injeção das Variáveis do Supabase
#########################################
if [ -z "${SUPABASE_URL}" ] || [ -z "${SUPABASE_ANON_KEY}" ] || [ -z "${SUPABASE_SERVICE_KEY}" ]; then
  echo "WARNING: Variáveis críticas do Supabase ausentes. Executando update-supabase-creds.sh para injetar as credenciais."
  if [ -f "./update-supabase-creds.sh" ]; then
    chmod +x ./update-supabase-creds.sh
    ./update-supabase-creds.sh
  else
    echo "ERROR: update-supabase-creds.sh não encontrado."
    exit 1
  fi
else
  echo "Variáveis do Supabase definidas."
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
    if [ -n "$value" ]; then
      if grep -q "^$var=" "$ENV_FILE"; then
        sed -i "s|^$var=.*|$var=$value|" "$ENV_FILE"
      else
        echo "$var=$value" >> "$ENV_FILE"
      fi
    fi
  done

  # Duplicar o arquivo para dotenv
  cp "$ENV_FILE" .env
}
patch_env_files

echo "Arquivos de ambiente atualizados."

# Executar o script de injeção de variáveis de ambiente
if [ -f "./inject-env-vars.sh" ]; then
  echo "Executando script de injeção de variáveis de ambiente..."
  chmod +x ./inject-env-vars.sh
  ./inject-env-vars.sh
fi

#########################################
# 4. Iniciar o servidor Express
#########################################
echo "Iniciando servidor Express..."
exec node server.js
