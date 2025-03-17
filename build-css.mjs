#!/usr/bin/env node

/**
 * Script para compilar arquivos SCSS para CSS antes do build do Remix
 * Criado conforme recomendação da documentação Remix + Vite
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

// Configuração de diretórios
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = __dirname;
const stylesDir = path.join(rootDir, 'app', 'styles');
const publicStylesDir = path.join(rootDir, 'public', 'styles');

// Garantir que o diretório de saída existe
try {
  if (!fs.existsSync(publicStylesDir)) {
    fs.mkdirSync(publicStylesDir, { recursive: true });
    console.log(`Diretório criado: ${publicStylesDir}`);
  }
} catch (error) {
  console.error(`Erro ao criar diretório: ${error.message}`);
  process.exit(1);
}

// Compilar global.scss para CSS
try {
  console.log('Compilando SCSS para CSS...');
  
  // Compilar o arquivo global.scss principal
  const inputFile = path.join(stylesDir, 'global.scss');
  const outputFile = path.join(publicStylesDir, 'global.css');
  
  // Verificar se o arquivo de entrada existe
  if (!fs.existsSync(inputFile)) {
    console.error(`Erro: O arquivo ${inputFile} não existe.`);
    process.exit(1);
  }
  
  // Executar o compilador Sass
  const command = `npx sass ${inputFile}:${outputFile} --no-source-map --style=compressed`;
  execSync(command, { stdio: 'inherit' });
  
  console.log(`SCSS compilado com sucesso: ${outputFile}`);
} catch (error) {
  console.error(`Erro ao compilar SCSS: ${error.message}`);
  process.exit(1);
}

console.log('Build CSS concluído com sucesso!');
