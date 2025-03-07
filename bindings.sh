#!/bin/bash
set -euo pipefail

bindings=""

# Função para extrair nomes de variáveis do arquivo worker-configuration.d.ts
extract_env_vars() {
  grep -o '[A-Z_]\+:' worker-configuration.d.ts | sed 's/://'
}

# Se existir o arquivo .env.local, leia dele
if [ -f ".env.local" ]; then
  while IFS= read -r line || [ -n "$line" ]; do
    # Ignora comentários e linhas vazias
    if [[ ! "$line" =~ ^# ]] && [[ -n "$line" ]]; then
      name=$(echo "$line" | cut -d '=' -f 1)
      value=$(echo "$line" | cut -d '=' -f 2-)
      # Remove aspas se estiverem envolvidas
      value=$(echo "$value" | sed 's/^"\(.*\)"$/\1/')
      bindings+="--binding ${name}=${value} "
    fi
  done < .env.local
else
  # Caso .env.local não exista, usa as variáveis definidas no worker-configuration.d.ts
  env_vars=($(extract_env_vars))
  for var in "${env_vars[@]}"; do
    # Se a variável estiver definida no ambiente, gera o binding
    if [ -n "${!var-}" ]; then
      bindings+="--binding ${var}=${!var} "
    fi
  done
fi

# Remove espaços em branco no final
bindings=$(echo $bindings | sed 's/[[:space:]]*$//')

echo $bindings
