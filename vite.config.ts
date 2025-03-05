import { cloudflareDevProxyVitePlugin as remixCloudflareDevProxy, vitePlugin as remixVitePlugin } from '@remix-run/dev';
import UnoCSS from 'unocss/vite';
import { defineConfig, type ViteDevServer } from 'vite';
import { nodePolyfills } from 'vite-plugin-node-polyfills';
import { optimizeCssModules } from 'vite-plugin-optimize-css-modules';
import tsconfigPaths from 'vite-tsconfig-paths';
import * as dotenv from 'dotenv';
import { execSync } from 'child_process';

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
      // Note: Type Stripping warning is expected and can be ignored
      //       or suppressed by running with NODE_NO_WARNINGS=1
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
      chunkSizeWarningLimit: 2500, // Increased to reduce warnings
      minify: isProd ? 'esbuild' : false,
      sourcemap: !isProd,
    },
    plugins: [
      nodePolyfills({
        include: ['path', 'buffer', 'process'],
      }),
      config.mode !== 'test' && remixCloudflareDevProxy(),
      remixVitePlugin({
        future: {
          v3_fetcherPersist: true,
          v3_relativeSplatPath: true,
          v3_throwAbortReason: true,
          v3_lazyRouteDiscovery: true,
          v3_singleFetch: true, // Add support for React Router v7's single fetch
        },
      }),
      UnoCSS(),
      tsconfigPaths(),
      chrome129IssuePlugin(),
      config.mode === 'production' && optimizeCssModules({ apply: 'build' }),
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
          api: 'modern-compiler',
        },
      },
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