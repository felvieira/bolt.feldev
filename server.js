import express from "express";
import compression from "compression";
import session from "express-session";
import { createRequestHandler } from "@remix-run/express";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import "dotenv/config";
import cookieParser from "cookie-parser";

// Initialize __dirname (needed in ESM)
const __dirname = path.dirname(fileURLToPath(import.meta.url));

console.log("Starting Express server with:");
console.log("- Current directory:", process.cwd());
console.log("- __dirname:", __dirname);
console.log("- NODE_ENV:", process.env.NODE_ENV || "development");
console.log("- Expected build path:", path.join(__dirname, "build/server/index.js"));

const buildServerDir = path.join(__dirname, "build/server");
const buildFilePath = path.join(buildServerDir, "index.js");

if (!fs.existsSync(buildServerDir)) {
  console.error("ERROR: Build directory does not exist:", buildServerDir);
  console.error('Please run "npm run build" to generate the server build');
  process.exit(1);
}

if (!fs.existsSync(buildFilePath)) {
  console.error("ERROR: Build output file does not exist:", buildFilePath);
  try {
    const files = fs.readdirSync(buildServerDir);
    console.error(files.join("\n"));
  } catch (error) {
    console.error("Could not read directory contents:", error);
  }
  console.error('Please run "npm run build" to generate the server build');
  process.exit(1);
}

let build;
try {
  console.log("Attempting to import build from:", buildFilePath);
  build = await import("./build/server/index.js");
  console.log("Successfully imported build module");
} catch (error) {
  console.error("Failed to import build:", error);
  if (error.code === "ERR_MODULE_NOT_FOUND") {
    console.error("\nPossible solutions:");
    console.error('1. Make sure you have run "npm run build" before starting the server');
    console.error("2. Check remix.config.js and ensure serverModuleFormat is set correctly");
    console.error("3. Verify that your remix.config.js serverBuildPath matches where server.js is looking");
  }
  process.exit(1);
}

const app = express();

let sessionSecret = process.env.SESSION_SECRET;
if (!sessionSecret) {
  console.warn(
    "SESSION_SECRET not defined; using a generated value. This is not secure for production."
  );
  sessionSecret = require("crypto").randomBytes(32).toString("hex");
  if (process.env.RUNNING_IN_DOCKER === "true") {
    const sessionDataPath = "/app/session-data";
    if (fs.existsSync(sessionDataPath)) {
      fs.writeFileSync(path.join(sessionDataPath, "session-secret"), sessionSecret);
      console.log("Generated and saved new SESSION_SECRET to session-data");
    }
  }
}

app.use(cookieParser());
app.use(
  session({
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 7 * 24 * 60 * 60 * 1000
    }
  })
);

app.use(
  compression({
    level: 6,
    threshold: 0,
    filter: (req, res) => {
      if (res.getHeader("Content-Type")?.includes("image/")) {
        return false;
      }
      return compression.filter(req, res);
    }
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => {
  res.setHeader("Cross-Origin-Embedder-Policy", "require-corp");
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
  next();
});

// Serve estático em "/assets" diretamente de "build/client"
app.use(
  "/assets",
  express.static(path.join(__dirname, "build", "client"), {
    immutable: true,
    maxAge: "1y"
  })
);

// Servir a pasta "public" no root (ex.: imagens e favicon)
app.use(
  express.static(path.join(__dirname, "public"), {
    maxAge: "1h",
    setHeaders: (res, filePath) => {
      if (filePath.endsWith(".html")) {
        res.setHeader("Cache-Control", "public, max-age=0");
      }
    }
  })
);

// Health check endpoint
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "healthy",
    version: process.env.npm_package_version || "unknown",
    environment: process.env.NODE_ENV || "development",
    uptime: process.uptime(),
    supabase: {
      url: process.env.SUPABASE_URL ? "set ✓" : "not set ✗",
      anonKey: process.env.SUPABASE_ANON_KEY ? "set ✓" : "not set ✗",
      serviceKey: process.env.SUPABASE_SERVICE_KEY ? "set ✓" : "not set ✗"
    }
  });
});

// Remix request handler
app.all(
  "*",
  createRequestHandler({
    build,
    mode: process.env.NODE_ENV || "production",
    getLoadContext(req, res) {
      return {
        env: { ...process.env },
        req,
        res
      };
    }
  })
);

// Error handling
app.use((err, req, res, next) => {
  console.error("Server error:", err);
  res.status(500).json({
    message: "Internal Server Error",
    ...(process.env.NODE_ENV !== "production" && { error: err.message })
  });
});

const port = process.env.PORT || 5173;
app.listen(port, () => {
  console.log(`
★═══════════════════════════════════════★
          B O L T . D I Y
      Express Server Running
★═══════════════════════════════════════★
  `);
  console.log(`Server listening on port ${port}`);
  console.log(`NODE_ENV: ${process.env.NODE_ENV || "development"}`);
  console.log(`SESSION_SECRET: ${sessionSecret ? "Set ✓" : "Not set ✗"}`);
  console.log(`SUPABASE_URL: ${process.env.SUPABASE_URL ? "Set ✓" : "Not set ✗"}`);
  console.log("★═══════════════════════════════════════★");
});
