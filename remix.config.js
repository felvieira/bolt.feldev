// remix.config.js

/**
 * @type {import('@remix-run/dev').AppConfig}
 */
module.exports = {
  appDirectory: "app",
  assetsBuildDirectory: "public/build",
  serverBuildPath: "build/server/index.js",
  publicPath: "/build/",
  // Atualizamos o alvo para Cloudflare Workers para garantir que as variáveis sejam injetadas
  serverBuildTarget: "cloudflare-workers",
  future: {
    v2_dev: true,
    v2_errorBoundary: true,
    v2_headers: true,
    v2_meta: true,
    v2_normalizeFormMethod: true,
    v2_routeConvention: true,
  },
  // Adicionamos o 'server-env.js' para ser bundleado no processo de build
  serverDependenciesToBundle: ["marked", "prismjs", "server-env.js"],
  watchPaths: ["./public"],
  serverMinify: true,
  serverModuleFormat: "esm",
  tailwind: true,
  postcss: true,
  sourcemap: false,
  devServerPort: 8002,
  // Define um entry point customizado para garantir que o 'server-env.js' seja importado antes do restante da aplicação
  server: "./server-entry.js"
};
