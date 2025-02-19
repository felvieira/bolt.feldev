/**
 * @type {import('@remix-run/dev').AppConfig}
 */
module.exports = {
  appDirectory: "app",
  assetsBuildDirectory: "public/build",
  serverBuildPath: "build/server/index.js",
  publicPath: "/build/",
  serverBuildTarget: "cloudflare-pages",
  future: {
    v2_dev: true,
    v2_errorBoundary: true,
    v2_headers: true,
    v2_meta: true,
    v2_normalizeFormMethod: true,
    v2_routeConvention: true,
  },
  serverDependenciesToBundle: ["marked", "prismjs"],
  watchPaths: ["./public"],
  serverMinify: true,
  serverModuleFormat: "esm",
  tailwind: true,
  postcss: true,
  sourcemap: false,
  devServerPort: 8002
};
