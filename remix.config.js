/**
 * @type {import('@remix-run/dev').AppConfig}
 */
module.exports = {
  appDirectory: "app",
  assetsBuildDirectory: "public/build",
  serverBuildPath: "build/server/index.js",
  publicPath: "/build/",
  serverBuildTarget: "cloudflare-pages"
};
