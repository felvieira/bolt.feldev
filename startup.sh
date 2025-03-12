#!/bin/bash
set -e

# Diretório do projeto
PROJECT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$PROJECT_DIR"

echo "=== Iniciando deployment ==="

# Verificar se o script supabase-config.sh existe
if [ ! -f "./supabase-config.sh" ]; then
    echo "ERRO: script supabase-config.sh não encontrado"
    exit 1
fi

# Verificar se o comando docker está disponível
if ! command -v docker &> /dev/null; then
    echo "ERRO: Docker não está instalado ou não está no PATH"
    exit 1
fi

# Verificar se as variáveis de ambiente necessárias estão definidas
if [ -z "$DATABASE_URL" ]; then
    echo "ERRO: DATABASE_URL não está definida"
    exit 1
fi

if [ -z "$SERVICE_USER_MINIO" ] || [ -z "$SERVICE_PASSWORD_MINIO" ]; then
    echo "ERRO: Variáveis SERVICE_USER_MINIO ou SERVICE_PASSWORD_MINIO não estão definidas"
    exit 1
fi

# Executar o script de configuração do Supabase (no host)
echo "=== Executando configuração do Supabase ==="
bash ./supabase-config.sh

# Verificar o resultado da execução
SUPABASE_CONFIG_RESULT=$?
if [ $SUPABASE_CONFIG_RESULT -ne 0 ]; then
    echo "AVISO: A configuração do Supabase encontrou problemas (código de saída: $SUPABASE_CONFIG_RESULT)."
    read -p "Deseja continuar mesmo assim? (s/N): " should_continue
    if [[ ! "$should_continue" =~ ^[Ss]$ ]]; then
        echo "Abortando deployment."
        exit 1
    fi
fi

# Construir e iniciar os containers
echo "=== Construindo containers ==="
docker compose -f ./docker-compose-express.yaml build

echo "=== Iniciando containers ==="
docker compose -f ./docker-compose-express.yaml up -d

echo "=== Deployment concluído! ==="
echo "Você pode acessar os logs com: docker compose -f ./docker-compose-express.yaml logs -f"
