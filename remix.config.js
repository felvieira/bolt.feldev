// remix.config.js

/**
 * @type {import('@remix-run/dev').AppConfig}
 */
module.exports = {
  // Diretório do seu código Remix
  appDirectory: "app",

  // Altere para "build/client" para que os assets fiquem gerados lá
  assetsBuildDirectory: "build/client",

  // A build do servidor continua em build/server/index.js
  serverBuildPath: "build/server/index.js",

  // O prefixo público dos assets será "/assets/"
  publicPath: "/assets/",

  serverBuildTarget: "node",

  future: {
    v2_dev: true,
    v2_errorBoundary: true,
    v2_headers: true,
    v2_meta: true,
    v2_normalizeFormMethod: true,
    v2_routeConvention: true,
  },

  // Outras configurações
  serverDependenciesToBundle: "all",
  watchPaths: ["./public"],
  serverMinify: false,
  serverModuleFormat: "cjs",
  tailwind: true,
  postcss: true,
  sourcemap: true,
  devServerPort: 8002,
  server: "./app/entry.server.tsx"
};
