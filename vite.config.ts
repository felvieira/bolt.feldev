import { vitePlugin as remixVitePlugin } from '@remix-run/dev';
import UnoCSS from 'unocss/vite';
import { defineConfig, type ViteDevServer } from 'vite';
import { nodePolyfills } from 'vite-plugin-node-polyfills';
import { optimizeCssModules } from 'vite-plugin-optimize-css-modules';
import tsconfigPaths from 'vite-tsconfig-paths';
import * as dotenv from 'dotenv';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

dotenv.config();

// Get git hash with fallback
const getGitHash = () => {
  // Skip Git commands in production/Coolify environments
  if (process.env.NODE_ENV === 'production' || process.env.RUNNING_IN_DOCKER === 'true') {
    return 'production-build';
  }

  try {
    return execSync('git rev-parse --short HEAD').toString().trim();
  } catch {
    return 'no-git-info';
  }
};

// Verificar e instalar dependências necessárias
function ensureDependencies() {
  const dependencies = ['sass'];
  const missingDeps = [];

  dependencies.forEach(dep => {
    try {
      require.resolve(dep);
    } catch (e) {
      missingDeps.push(dep);
    }
  });

  if (missingDeps.length > 0) {
    console.error(`❌ Dependências necessárias não encontradas: ${missingDeps.join(', ')}`);
    console.error(`📦 Instale com: pnpm add -D ${missingDeps.join(' ')}`);
    process.exit(1);
  }
}

export default defineConfig((config) => {
  const isProd = config.mode === 'production';
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  
  // Verificar dependências necessárias
  ensureDependencies();

  // Importar sass dinamicamente depois da verificação para evitar erros
  const sass = require('sass');

  return {
    define: {
      __COMMIT_HASH: JSON.stringify(getGitHash()),
      __APP_VERSION: JSON.stringify(process.env.npm_package_version),
      'process.env.NODE_ENV': JSON.stringify(config.mode),
    },
    build: {
      target: 'esnext',
      rollupOptions: {
        external: ['@remix-run/node'],
        output: {
          assetFileNames: (assetInfo) => {
            if (/\.(png|jpe?g|svg|gif|ico)$/.test(assetInfo.name)) {
              return `client/[name][extname]`;
            }
            return 'client/assets/[name]-[hash][extname]';
          },
          chunkFileNames: 'client/assets/[name]-[hash].js',
          entryFileNames: 'client/assets/[name]-[hash].js'
        },
      },
      chunkSizeWarningLimit: 2500,
      minify: isProd ? 'esbuild' : false,
      sourcemap: !isProd,
    },
    plugins: [
      nodePolyfills({
        include: ['path', 'buffer', 'process'],
      }),
      remixVitePlugin({
        future: {
          v3_fetcherPersist: true,
          v3_relativeSplatPath: true,
          v3_throwAbortReason: true,
          v3_lazyRouteDiscovery: true,
          v3_singleFetch: true,
        },
      }),
      // Configuração do UnoCSS
      UnoCSS(),
      tsconfigPaths(),
      chrome129IssuePlugin(),
      config.mode === 'production' && optimizeCssModules({ apply: 'build' }),
      
      // Plugin personalizado para processar SCSS e UnoCSS
      {
        name: 'custom-css-loader',
        transform(code, id) {
          // Processar arquivos SCSS
          if (id.endsWith('.scss')) {
            try {
              console.log(`🔄 Processando arquivo SCSS: ${id}`);
              
              // Compilar SCSS para CSS
              const result = sass.compile(id, {
                loadPaths: [
                  path.dirname(id),
                  path.join(__dirname, 'app', 'styles'),
                  path.join(__dirname, 'node_modules')
                ]
              });
              
              // Verificar se a compilação foi bem-sucedida
              if (!result || !result.css) {
                throw new Error('Erro ao compilar SCSS: resultado vazio');
              }
              
              // Log para debug
              console.log(`✅ SCSS compilado com sucesso: ${id}`);
              
              // Injetar o CSS como uma tag style
              return {
                code: `
                  const styleSheet = document.createElement('style');
                  styleSheet.textContent = ${JSON.stringify(result.css.toString())};
                  document.head.appendChild(styleSheet);
                  export default styleSheet;
                `,
                map: null
              };
            } catch (error) {
              console.error(`❌ Erro ao processar SCSS (${id}):`, error);
              
              // Retornar código que não quebrará o build
              return {
                code: `
                  console.error("Erro ao processar SCSS: ${id}", ${JSON.stringify(error.message)});
                  export default null;
                `,
                map: null
              };
            }
          }
          
          // Processar imports de UnoCSS
          if (id === 'uno.css' || id.includes('uno.css?')) {
            console.log(`🔄 Processando import UnoCSS: ${id}`);
            return {
              code: `
                // UnoCSS é injetado pelo plugin, este é um import de placeholder
                const styleSheet = document.createElement('style');
                styleSheet.classList.add('unocss-placeholder');
                document.head.appendChild(styleSheet);
                export default styleSheet;
              `,
              map: null
            };
          }
          
          // Garantir que env-bridge.server seja processado corretamente
          if (id.includes('utils/env-bridge.server')) {
            return { code, moduleSideEffects: 'no-treeshake' };
          }
          
          return null;
        }
      }
    ],
    optimizeDeps: {
      include: ['marked', 'prismjs'],
    },
    envPrefix: [
      'VITE_',
      'OPENAI_LIKE_API_BASE_URL',
      'OLLAMA_API_BASE_URL',
      'LMSTUDIO_API_BASE_URL',
      'TOGETHER_API_BASE_URL',
      'SESSION_SECRET',
      'XAI_API_KEY',
    ],
    css: {
      preprocessorOptions: {
        scss: {
          // Opções para o pré-processador SCSS nativo do Vite
          // (nosso plugin personalizado será usado primeiro)
          importers: [{
            findFileUrl(url) {
              // Ajuda a resolver @imports em arquivos SCSS
              return new URL(url, path.join('file://', __dirname, 'app', 'styles'));
            }
          }]
        },
      },
      devSourcemap: true,
    },
    resolve: {
      alias: {
        '~': path.resolve(__dirname, 'app'),
        // Alias para UnoCSS
        'uno.css': path.resolve(__dirname, 'node_modules', 'unocss', 'dist', 'index.mjs'),
      }
    }
  };
});

function chrome129IssuePlugin() {
  return {
    name: 'chrome129IssuePlugin',
    configureServer(server: ViteDevServer) {
      server.middlewares.use((req, res, next) => {
        const raw = req.headers['user-agent']?.match(/Chrom(e|ium)\/([0-9]+)\./);

        if (raw) {
          const version = parseInt(raw[2], 10);

          if (version === 129) {
            res.setHeader('content-type', 'text/html');
            res.end(
              '<body><h1>Please use Chrome Canary for testing.</h1><p>Chrome 129 has an issue with JavaScript modules & Vite local development, see <a href="https://github.com/stackblitz/bolt.new/issues/86#issuecomment-2395519258">for more information.</a></p><p><b>Note:</b> This only impacts <u>local development</u>. `pnpm run build` and `pnpm run start` will work fine in this browser.</p></body>',
            );

            return;
          }
        }

        next();
      });
    },
  };
}
