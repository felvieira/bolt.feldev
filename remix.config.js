// remix.config.js

/**
 * @type {import('@remix-run/dev').AppConfig}
 */
module.exports = {
  appDirectory: "app",
  assetsBuildDirectory: "public/build",
  serverBuildPath: "build/server/index.js",
  publicPath: "/build/",
  serverBuildTarget: "node",
  future: {
    v2_dev: true,
    v2_errorBoundary: true,
    v2_headers: true,
    v2_meta: true,
    v2_normalizeFormMethod: true,
    v2_routeConvention: true,
  },
  // Bundle all dependencies to avoid ESM/CommonJS compatibility issues
  serverDependenciesToBundle: "all",
  watchPaths: ["./public"],
  // Disable minification temporarily for better debugging
  serverMinify: false,
  // Use cjs format for better compatibility with Express
  serverModuleFormat: "cjs",
  tailwind: true,
  postcss: true,
  // Enable sourcemaps for debugging
  sourcemap: true,
  devServerPort: 8002,
  // Use the standard entry server
  server: "./app/entry.server.tsx"
};
