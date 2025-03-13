/**
 * @type {import('@remix-run/dev').AppConfig}
 */
module.exports = {
  appDirectory: "app",

  // Gere a saída do frontend em "build/client/assets"
  assetsBuildDirectory: "build/client/assets",

  // Quando o navegador requisita "/assets/algumArquivo.js", 
  // o Remix gerará esse "algumArquivo.js" dentro de "build/client/assets/"
  publicPath: "/assets/",

  // Onde sairão os arquivos do backend
  serverBuildPath: "build/server/index.js",
  serverBuildTarget: "node",

  // Pode manter o resto igual
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
  serverModuleFormat: "esm", // Alterado de "cjs" para "esm"
  tailwind: true,
  postcss: true,
  sourcemap: true,
  devServerPort: 8002,
  server: "./app/entry.server.tsx"
};
