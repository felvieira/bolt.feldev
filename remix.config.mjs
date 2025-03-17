/**
 * @type {import('@remix-run/dev').AppConfig}
 */
export default {
  appDirectory: "app",

  // Novos caminhos de build para o Vite conforme documentação:
  // https://remix.run/docs/en/main/guides/vite#migrating-from-remix-app-server
  assetsBuildDirectory: "build/client/assets",
  publicPath: "/assets/",
  serverBuildPath: "build/server/index.js",
  serverBuildTarget: "node",

  // Mantém apenas flags de futuro relevantes e remove os obsoletos
  future: {
    v3_fetcherPersist: true,
    v3_relativeSplatPath: true,
    v3_throwAbortReason: true,
    v3_lazyRouteDiscovery: true,
    v3_singleFetch: true,
  },
  
  serverDependenciesToBundle: "all",
  watchPaths: ["./public"],
  serverMinify: false,
  serverModuleFormat: "esm", // Formato ESM para o servidor
  tailwind: false, // Desabilitamos já que estamos usando UnoCSS
  postcss: true,
  sourcemap: true,
  devServerPort: 8002,
  server: "./app/entry.server.tsx"
};
