#!/usr/bin/env node
import pkg from '@remix-run/dev';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Garantir que os arquivos CSS necessários estejam copiados para a pasta assets
function ensureCssAssets() {
  console.log('📦 Verificando arquivos CSS necessários...');
  
  const publicAssetsDir = path.join(__dirname, 'public', 'assets');
  
  // Garantir que o diretório existe
  if (!fs.existsSync(publicAssetsDir)) {
    fs.mkdirSync(publicAssetsDir, { recursive: true });
    console.log('📁 Diretório public/assets criado com sucesso');
  }
  
  // Lista de arquivos CSS para copiar
  const cssFiles = [
    {
      src: path.join(__dirname, 'node_modules', '@xterm', 'xterm', 'css', 'xterm.css'),
      dest: path.join(publicAssetsDir, 'xterm.css')
    },
    {
      src: path.join(__dirname, 'node_modules', 'react-toastify', 'dist', 'ReactToastify.css'),
      dest: path.join(publicAssetsDir, 'react-toastify.css')
    },
    {
      src: path.join(__dirname, 'node_modules', '@unocss', 'reset', 'tailwind-compat.css'),
      dest: path.join(publicAssetsDir, 'tailwind-reset.css')
    }
  ];
  
  for (const file of cssFiles) {
    try {
      if (fs.existsSync(file.src)) {
        fs.copyFileSync(file.src, file.dest);
        console.log(`✅ ${path.basename(file.src)} copiado com sucesso`);
      } else {
        console.warn(`⚠️ Arquivo ${file.src} não encontrado`);
      }
    } catch (error) {
      console.error(`❌ Erro ao copiar ${file.src}:`, error);
    }
  }
  
  console.log('📦 Processamento de arquivos CSS concluído!');
}

async function runBuild() {
  try {
    process.env.NODE_NO_WARNINGS = '1';
    console.log('🚀 Iniciando processo de build...');
    
    // Etapa 1: Garantir arquivos CSS
    ensureCssAssets();
    
    // Etapa 2: Build do Remix
    console.log('🔨 Iniciando build do Remix...');
    await pkg.cli.run(['build']);
    
    console.log('✅ Build concluído com sucesso!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Falha no processo de build:', error);
    process.exit(1);
  }
}

runBuild();
