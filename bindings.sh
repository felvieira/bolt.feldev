#!/bin/bash
set -euo pipefail

# Variável para evitar execução duplicada
if [ "${BINDINGS_GENERATED:-false}" = "true" ]; then
  echo "Bindings already generated. Skipping."
  exit 0
fi

bindings=""

# Função para extrair nomes de variáveis do worker-configuration.d.ts
extract_env_vars() {
  if [ -f "worker-configuration.d.ts" ]; then
    grep -o '[A-Z_]\+:' worker-configuration.d.ts | sed 's/://'
  else
    echo "SESSION_SECRET SUPABASE_URL SUPABASE_ANON_KEY SUPABASE_SERVICE_KEY DATABASE_URL"
  fi
}

# Função para remover espaços em branco (trim)
trim() {
  echo "$1" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//'
}

# Função para adicionar binding de forma segura
add_binding() {
  local name
  local value
  name=$(trim "$1")
  value=$(trim "$2")
  
  # Ignora valores vazios
  if [ -z "$value" ]; then
    return
  fi
  
  # Escapa aspas duplas no valor
  value=$(echo "$value" | sed 's/"/\\"/g')
  bindings+="--binding ${name}=\"${value}\" "
}

echo "Generating bindings..."

# Lista de variáveis críticas
critical_vars=("SUPABASE_URL" "SUPABASE_ANON_KEY" "SUPABASE_SERVICE_KEY" "SESSION_SECRET")
for var in "${critical_vars[@]}"; do
  if [ -n "${!var-}" ]; then
    echo "✓ Found $var in environment"
  else
    echo "⚠ Missing $var in environment"
  fi
done

# Função para ler variáveis de um arquivo .env.local
read_env_file() {
  while IFS= read -r line || [ -n "$line" ]; do
    # Ignora comentários e linhas vazias
    if [[ ! "$line" =~ ^[[:space:]]*# ]] && [[ -n "$line" ]]; then
      if [[ "$line" =~ ^([^=]+)=(.*)$ ]]; then
        local name
        local value
        name=$(trim "${BASH_REMATCH[1]}")
        value=$(trim "${BASH_REMATCH[2]}")
        # Remove aspas circundantes se presentes
        value=$(echo "$value" | sed 's/^"\(.*\)"$/\1/' | sed "s/^'\(.*\)'$/\1/")
        add_binding "$name" "$value"
      fi
    fi
  done < .env.local
}

if [ -f ".env.local" ]; then
  echo "Reading variables from .env.local"
  read_env_file
else
  echo "No .env.local found, using environment variables"
  for var in $(extract_env_vars); do
    if [ -n "${!var-}" ]; then
      add_binding "$var" "${!var}"
    fi
  done
  
  for var in "${critical_vars[@]}"; do
    if [ -n "${!var-}" ] && [[ ! "$bindings" =~ "--binding $var=" ]]; then
      add_binding "$var" "${!var}"
    fi
  done
fi

# Remove espaços em branco no final
bindings=$(echo "$bindings" | sed 's/[[:space:]]*$//')

# Marca que os bindings foram gerados para evitar repetição
export BINDINGS_GENERATED=true

echo "Generated bindings for Wrangler:"
echo "$bindings"
