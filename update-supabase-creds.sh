#!/bin/bash
set -e

echo "===== Update Supabase Credentials Script ====="
echo "Validating Supabase credentials..."

#########################################
# 1. Definir SUPABASE_URL com valor fixo se não estiver definido
#########################################
if [ -z "${SUPABASE_URL}" ]; then
  echo "SUPABASE_URL não fornecido, utilizando valor padrão."
  export SUPABASE_URL="https://supabase.cantodorei.com.br"
else
  echo "SUPABASE_URL fornecido."
fi

#########################################
# 2. Gerar valores para as chaves se não estiverem definidas
#########################################
if [ -z "${SUPABASE_ANON_KEY}" ]; then
  echo "SUPABASE_ANON_KEY não fornecido, gerando um valor randômico."
  export SUPABASE_ANON_KEY=$(openssl rand -base64 32)
else
  echo "SUPABASE_ANON_KEY fornecido."
fi

if [ -z "${SUPABASE_SERVICE_KEY}" ]; then
  echo "SUPABASE_SERVICE_KEY não fornecido, gerando um valor randômico."
  export SUPABASE_SERVICE_KEY=$(openssl rand -base64 32)
else
  echo "SUPABASE_SERVICE_KEY fornecido."
fi

echo "Supabase credentials definidas (valores ocultos, exceto SUPABASE_URL)."

#########################################
# 3. Persistência das Credenciais
#########################################
mkdir -p ./bolt-env
PERSISTED_CREDS="./bolt-env/supabase-creds.env"
echo "Persistindo credenciais no arquivo: $PERSISTED_CREDS"
cat > "$PERSISTED_CREDS" <<EOF
SUPABASE_URL=${SUPABASE_URL}
SUPABASE_ANON_KEY=${SUPABASE_ANON_KEY}
SUPABASE_SERVICE_KEY=${SUPABASE_SERVICE_KEY}
EOF
echo "Credenciais do Supabase persistidas (valores ocultos, exceto SUPABASE_URL)."

#########################################
# 4. Patch dos Arquivos de Ambiente
#########################################
patch_file() {
  local file=$1
  local var=$2
  local value
  value=$(printenv $var)
  if [ -f "$file" ]; then
    if grep -q "^$var=" "$file"; then
      sed -i "s|^$var=.*|$var=$value|" "$file"
      echo "$file: Variável $var atualizada (valor oculto, exceto SUPABASE_URL)."
    else
      echo "$var=$value" >> "$file"
      echo "$file: Variável $var adicionada (valor oculto, exceto SUPABASE_URL)."
    fi
  else
    echo "# Arquivo de ambiente" > "$file"
    echo "$var=$value" >> "$file"
    echo "$file criado e variável $var adicionada (valor oculto, exceto SUPABASE_URL)."
  fi
}

ENV_FILE=".env.local"
for var in SUPABASE_URL SUPABASE_ANON_KEY SUPABASE_SERVICE_KEY; do
  patch_file "$ENV_FILE" "$var"
done

if [ -f ".dev.vars" ]; then
  for var in SUPABASE_URL SUPABASE_ANON_KEY SUPABASE_SERVICE_KEY; do
    patch_file ".dev.vars" "$var"
  done
else
  echo ".dev.vars não encontrado. Pulando atualização."
fi

echo "===== Update Supabase Credentials Complete ====="
