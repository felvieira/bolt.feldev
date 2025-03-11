#!/bin/bash
set -e

# Enhanced debugging
exec > >(tee -a /tmp/entrypoint-debug.log) 2>&1
echo "=== EXPRESS ENTRYPOINT STARTED AT $(date) ==="
echo "Starting Express entrypoint script for bolt.diy"

echo "Verificando variáveis de ambiente no container:"
echo "SUPABASE_URL presente: ${SUPABASE_URL:+yes}"
echo "SUPABASE_ANON_KEY presente: ${SUPABASE_ANON_KEY:+yes}"
echo "SUPABASE_SERVICE_KEY presente: ${SUPABASE_SERVICE_KEY:+yes}"
echo "SESSION_SECRET presente: ${SESSION_SECRET:+yes}"

#########################################
# 1. Garantir SESSION_SECRET
#########################################
if [ -z "${SESSION_SECRET}" ]; then
  echo "SESSION_SECRET não definido. Gerando novo SESSION_SECRET..."
  
  # Gera um SESSION_SECRET aleatório
  NEW_SESSION_SECRET=$(head -c 32 /dev/urandom | base64 | tr -d '\n')
  
  # Atualiza a variável de ambiente para o processo atual
  export SESSION_SECRET="$NEW_SESSION_SECRET"
  
  echo "Novo SESSION_SECRET gerado (valor oculto)."
else
  echo "SESSION_SECRET definido (valor oculto)."
fi

#########################################
# 2. Verificação das Variáveis do Supabase
#########################################
if [ -z "${SUPABASE_URL}" ] || [ -z "${SUPABASE_ANON_KEY}" ] || [ -z "${SUPABASE_SERVICE_KEY}" ]; then
  echo "WARNING: Variáveis críticas do Supabase ausentes ou não definidas."
  echo "Verifique se SUPABASE_URL, SUPABASE_ANON_KEY e SUPABASE_SERVICE_KEY estão configuradas."
  echo "A aplicação pode não funcionar corretamente sem essas variáveis."
else
  echo "Variáveis do Supabase definidas."
fi

#########################################
# 3. Patch dos Arquivos de Ambiente - MODIFICADO PARA EVITAR LOOP
#########################################
# IMPORTANTE: Só modificamos o env se:
# 1. O arquivo não existir OU
# 2. Uma flag de "primeira execução" estiver ausente

ENV_FLAG_FILE="/tmp/.env_updated"

if [ ! -f "$ENV_FLAG_FILE" ]; then
  echo "Primeira execução detectada, atualizando configurações..."
  
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

  # Verificar script inject-env-vars.sh, mas não falhar se ausente
  if [ -f "./inject-env-vars.sh" ]; then
    echo "Executando script de injeção de variáveis de ambiente..."
    chmod +x ./inject-env-vars.sh
    ./inject-env-vars.sh
  else
    echo "Script inject-env-vars.sh não encontrado. Pulando esta etapa."
  fi

  # Criar flag para evitar atualizações repetidas
  touch "$ENV_FLAG_FILE"
  echo "Flag de primeira execução criada: $ENV_FLAG_FILE"
else
  echo "Arquivo de flag detectado ($ENV_FLAG_FILE): pulando atualização de .env"
fi

#########################################
# 4. Iniciar o servidor Express
#########################################
echo "Iniciando servidor Express..."
echo "=== EXECUTANDO NODE SERVER.JS ==="

# Executar node server.js em modo de depuração para capturar erros
NODE_DEBUG=module,fs node server.js
