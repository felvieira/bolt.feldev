/**
 * @type {import('@remix-run/dev').AppConfig}
 */
module.exports = {
  appDirectory: "app",
  // Em vez de "public/assets", vamos colocar "build/client"
  assetsBuildDirectory: "build/client",
  serverBuildPath: "build/server/index.js",
  // Prefixo público "/assets"
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
