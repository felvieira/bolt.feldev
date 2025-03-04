#!/bin/bash
set -euo pipefail

bindings=""

# Lista os nomes das variáveis que você deseja obter (de acordo com sua interface)
env_keys=(SESSION_SECRET SUPABASE_URL SUPABASE_ANON_KEY DATABASE_URL NODE_ENV RUNNING_IN_DOCKER DEFAULT_NUM_CTX ANTHROPIC_API_KEY OPENAI_API_KEY GROQ_API_KEY HuggingFace_API_KEY OPEN_ROUTER_API_KEY OLLAMA_API_BASE_URL OPENAI_LIKE_API_KEY OPENAI_LIKE_API_BASE_URL TOGETHER_API_KEY TOGETHER_API_BASE_URL DEEPSEEK_API_KEY LMSTUDIO_API_BASE_URL GOOGLE_GENERATIVE_AI_API_KEY MISTRAL_API_KEY XAI_API_KEY PERPLEXITY_API_KEY AWS_BEDROCK_CONFIG)

for key in "${env_keys[@]}"; do
  value=$(printenv "$key")
  if [ -n "$value" ]; then
    bindings+="--binding ${key}=${value} "
  fi
done

# Remove espaços em branco finais e exibe os bindings
bindings=$(echo "$bindings" | sed 's/[[:space:]]*$//')
echo "$bindings"
