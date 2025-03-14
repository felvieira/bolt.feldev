/**
 * @type {import('@remix-run/dev').AppConfig}
 */
export default {
  appDirectory: "app",

  // Gere a saída do frontend em "build/client/assets"
  assetsBuildDirectory: "build/client/assets",

  // Quando o navegador requisita "/assets/algumArquivo.js", 
  // o Remix gerará esse "algumArquivo.js" dentro de "build/client/assets/"
  publicPath: "/assets/",

  // Onde sairão os arquivos do backend
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
  serverModuleFormat: "esm", // Alterado de "cjs" para "esm"
  tailwind: true,  // Mantido habilitado para preservar a aparência
  postcss: true,   // Mantido habilitado para preservar a aparência
  sourcemap: true,
  devServerPort: 8002,
  server: "./app/entry.server.tsx"
};
