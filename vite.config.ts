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
import { createRequire } from 'module';
import fs from 'fs';

const require = createRequire(import.meta.url);

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

export default defineConfig((config) => {
  const isProd = config.mode === 'production';
  const __dirname = path.dirname(fileURLToPath(import.meta.url));

  // Verificar se temos sass instalado como dependência
  try {
    require.resolve('sass');
    console.log('✅ Dependência sass encontrada.');
  } catch (error) {
    console.error('❌ Dependência sass não encontrada. Instale com: pnpm add -D sass');
    process.exit(1);
  }

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
          // Preserve original file names and structure for static assets
          assetFileNames: (assetInfo) => {
            // Preserve logos, icons, and other static assets with their original path
            if (/\.(png|jpe?g|svg|gif|ico)$/.test(assetInfo.name)) {
              return `client/[name][extname]`;
            }
            // For other assets, use the default naming
            return 'client/assets/[name]-[hash][extname]';
          },
          // Preserve chunk names that make sense
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
      UnoCSS({
        mode: 'global',
      }),
      tsconfigPaths(),
      chrome129IssuePlugin(),
      config.mode === 'production' && optimizeCssModules({ apply: 'build' }),
      // Plugin personalizado para suporte a SCSS
      {
        name: 'scss-loader',
        transform(code, id) {
          // Se for um arquivo SCSS
          if (id.endsWith('.scss')) {
            const sass = require('sass');
            
            try {
              // Compilar SCSS para CSS
              const result = sass.compile(id, {
                style: 'expanded',
                loadPaths: [
                  path.dirname(id),
                  path.join(__dirname, 'app', 'styles'),
                  path.join(__dirname, 'node_modules')
                ]
              });
              
              // Retornar o CSS compilado
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
              console.error('Erro ao compilar SCSS:', error);
              // Em caso de erro, retornar um CSS vazio
              return {
                code: `
                  const styleSheet = document.createElement('style');
                  styleSheet.textContent = '/* SCSS compilation error */';
                  document.head.appendChild(styleSheet);
                  export default styleSheet;
                `,
                map: null
              };
            }
          }
          
          // Lidar com a importação virtual do UnoCSS
          if (id === 'uno.css' || id.includes('uno.css?')) {
            return {
              code: `
                // UnoCSS is injected by the plugin
                export default {};
              `,
              map: null
            };
          }
          
          // Garantir que env-bridge.server tenha efeitos colaterais
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
          // Opções básicas para o processador SCSS
          includePaths: [
            path.join(__dirname, 'app', 'styles'),
            path.join(__dirname, 'node_modules')
          ]
        },
      },
      // Desativa a otimização de CSS em desenvolvimento para facilitar o debugging
      devSourcemap: true,
    },
    resolve: {
      alias: {
        // Ajudar a resolver imports de CSS/SCSS
        '~': path.resolve(__dirname, 'app'),
        // Alias para lidar com importações de uno.css
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
