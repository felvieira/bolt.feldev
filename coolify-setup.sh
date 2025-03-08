#!/bin/bash
set -e

echo "===== Bolt.diy Coolify Setup Script ====="
echo "Validating Coolify environment..."

#########################################
# Persistência ou Geração de SESSION_SECRET
#########################################
PERSISTED_SECRET_PATH="/app/session-data/session-secret"
if [ -z "${SESSION_SECRET}" ] && [ -f "${PERSISTED_SECRET_PATH}" ]; then
  echo "SESSION_SECRET persistido encontrado, utilizando-o."
  export SESSION_SECRET=$(cat "${PERSISTED_SECRET_PATH}")
fi

if [ -z "${SESSION_SECRET}" ]; then
  echo "WARNING: SESSION_SECRET não definido!"
  # Gera SESSION_SECRET de forma segura (valor oculto)
  export SESSION_SECRET=$(openssl rand -base64 32)
  echo "SESSION_SECRET gerado (valor oculto)."
else
  echo "SESSION_SECRET já está definido (valor oculto)."
fi

#########################################
# Função: Patch do arquivo de ambiente
#########################################
patch_file() {
  local file=$1
  local var="SESSION_SECRET"
  local value="${SESSION_SECRET}"
  
  if [ -f "$file" ]; then
    if grep -q "^$var=" "$file"; then
      sed -i "s|^$var=.*|$var=$value|" "$file"
      echo "$file atualizado com SESSION_SECRET (valor oculto)."
    else
      echo "$var=$value" >> "$file"
      echo "$file atualizado com SESSION_SECRET (valor oculto)."
    fi
  else
    echo "# Environment file" > "$file"
    echo "$var=$value" >> "$file"
    echo "$file criado com SESSION_SECRET (valor oculto)."
  fi
}

#########################################
# Patch dos arquivos de ambiente
#########################################
echo "Atualizando arquivos de ambiente..."
patch_file ".env.local"

# Cria o diretório bolt-env e copia o .env.local para ele (para volume, etc.)
mkdir -p ./bolt-env
cp .env.local ./bolt-env/.env.local

patch_file ".dev.vars"

# Exporta SESSION_SECRET para o ambiente atual
export SESSION_SECRET=${SESSION_SECRET}

#########################################
# Verificação do Setup
#########################################
echo "Setup verification:"
echo "- .env.local exists: $([ -f .env.local ] && echo 'Yes' || echo 'No')"
echo "- .dev.vars exists: $([ -f .dev.vars ] && echo 'Yes' || echo 'No')"
echo "- bolt-env directory exists: $([ -d ./bolt-env ] && echo 'Yes' || echo 'No')"
echo "- SESSION_SECRET is set: $([ -n \"${SESSION_SECRET}\" ] && echo 'Yes' || echo 'No')"

echo "===== Setup Complete ====="
