#!/bin/bash
set -e
echo "Verificando a existência da network 'bolt_network'..."
if ! docker network inspect bolt_network >/dev/null 2>&1; then
  echo "Network 'bolt_network' não encontrada, criando-a..."
  docker network create bolt_network
else
  echo "Network 'bolt_network' já existe."
fi
