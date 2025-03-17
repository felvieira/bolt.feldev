import { vitePlugin as remixVitePlugin } from '@remix-run/dev';
import { installGlobals } from '@remix-run/node';
import UnoCSS from 'unocss/vite';
import { defineConfig, type ViteDevServer } from 'vite';
import { nodePolyfills } from 'vite-plugin-node-polyfills';
import { optimizeCssModules } from 'vite-plugin-optimize-css-modules';
import tsconfigPaths from 'vite-tsconfig-paths';
import * as dotenv from 'dotenv';
import { execSync } from 'child_process';

// Instala os globais do Node conforme recomendado na seção 
// "Migrating from Remix App Server" da documentação oficial
installGlobals();

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

  return {
    define: {
      __COMMIT_HASH: JSON.stringify(getGitHash()),
      __APP_VERSION: JSON.stringify(process.env.npm_package_version),

      // Set NODE_ENV directly in Vite config instead of .env
      'process.env.NODE_ENV': JSON.stringify(config.mode),
    },
    // Configurar a porta do servidor para corresponder à porta do remix-serve (3000)
    server: {
      port: 5173, // Defina aqui a mesma porta que você usava com remix-serve
    },
    resolve: {
      // Adicionar aliases para módulos Node conforme recomendado no guia Remix + Vite
      alias: {
        path: 'path-browserify'
      }
    },
    build: {
      target: 'esnext',
      rollupOptions: {
        external: ['@remix-run/node'],
        output: isProd
          ? {
              manualChunks(id) {
                // Vendor dependencies
                if (id.includes('node_modules')) {
                  if (id.includes('marked') || id.includes('prismjs')) {
                    return 'vendor';
                  }

                  if (id.includes('emacs-lisp') || id.includes('cpp')) {
                    return 'editor-core';
                  }

                  // Split editor languages into separate chunks
                  if (id.includes('languages')) {
                    return 'editor-languages';
                  }
                }

                // Split UI components into smaller chunks
                if (id.includes('app/components')) {
                  if (id.includes('workbench')) {
                    return 'ui-workbench';
                  }

                  if (id.includes('chat')) {
                    return 'ui-chat';
                  }

                  return 'ui-core';
                }

                return undefined;
              },
            }
          : undefined,
      },
      chunkSizeWarningLimit: 2500,
      minify: isProd ? 'esbuild' : false,
      sourcemap: !isProd,
    },
    plugins: [
      // Configurar polyfills para Node.js no browser (recomendado no guia Remix + Vite)
      nodePolyfills({
        include: ['path', 'buffer', 'process', 'stream', 'util', 'fs', 'os', 'assert'],
        globals: {
          Buffer: true,
          global: true,
          process: true,
        },
        // Especificar explicitamente path-browserify para o path
        overrides: {
          path: 'path-browserify',
        }
      }),
      
      // Plugin Remix para Vite
      remixVitePlugin({
        future: {
          v3_fetcherPersist: true,
          v3_relativeSplatPath: true,
          v3_throwAbortReason: true,
          v3_lazyRouteDiscovery: true,
          v3_singleFetch: true, 
        },
      }),
      
      // UnoCSS plugin
      UnoCSS({
        mode: 'global'
      }),
      
      tsconfigPaths(),
      
      chrome129IssuePlugin(),
      
      config.mode === 'production' && optimizeCssModules({ apply: 'build' }),
    ],
    
    optimizeDeps: {
      include: ['marked', 'prismjs', 'path-browserify'],
      force: true,
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
      // Configuração para processar .scss e .module.scss
      modules: {
        // Configuração para CSS modules
        generateScopedName: '[name]__[local]___[hash:base64:5]',
      },
      preprocessorOptions: {
        scss: {
          // Configuração do SASS - seguindo o guia Remix + Vite
          outputStyle: 'compressed',
        }
      }
    },
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
