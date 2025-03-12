import express from "express";
import compression from "compression";
import session from "express-session";
import { createRequestHandler } from "@remix-run/express";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import "dotenv/config";
import cookieParser from "cookie-parser";

// -----------------------------------------------------------------------------
// Inicializa __dirname (já que usamos ESM)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Log básico
console.log("=== Starting Express server ===");
console.log("- Current directory:", process.cwd());
console.log("- __dirname:", __dirname);
console.log("- NODE_ENV:", process.env.NODE_ENV || "development");
console.log("- Expecting Remix build at:", path.join(__dirname, "build/server/index.js"));

// -----------------------------------------------------------------------------
// Verifica se build do Remix existe
const buildServerDir = path.join(__dirname, "build", "server");
const buildFilePath = path.join(buildServerDir, "index.js");

if (!fs.existsSync(buildServerDir)) {
  console.error("ERRO: Pasta de build do servidor não existe:", buildServerDir);
  process.exit(1);
}
if (!fs.existsSync(buildFilePath)) {
  console.error("ERRO: Arquivo build/index.js não existe:", buildFilePath);
  process.exit(1);
}

// Importa build do Remix
let build;
try {
  build = await import(buildFilePath);
  console.log(">> Remix build importado com sucesso!");
} catch (error) {
  console.error("Falha ao importar Remix build:", error);
  process.exit(1);
}

// -----------------------------------------------------------------------------
// Cria app Express
const app = express();

// Configura session secret
let sessionSecret = process.env.SESSION_SECRET;
if (!sessionSecret) {
  console.warn("SESSION_SECRET não definido; gerando valor aleatório (não é seguro em produção).");
  sessionSecret = require("crypto").randomBytes(32).toString("hex");
}

// Middlewares básicos
app.use(cookieParser());
app.use(
  session({
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 dias
    }
  })
);
app.use(
  compression({
    level: 6,
    threshold: 0,
    filter: (req, res) => {
      if (res.getHeader("Content-Type")?.includes("image/")) return false;
      return compression.filter(req, res);
    }
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// -----------------------------------------------------------------------------
// Define cabeçalhos de segurança (para webcontainers, se precisar)
app.use((req, res, next) => {
  res.setHeader("Cross-Origin-Embedder-Policy", "require-corp");
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
  next();
});

// -----------------------------------------------------------------------------
// Serve ESTÁTICOS do front-end gerado pelo Remix em /assets
// -> Se Remix estiver gerando em "build/client/assets"
app.use(
  "/assets",
  express.static(path.join(__dirname, "build", "client", "assets"), {
    immutable: true,
    maxAge: "1y"
  })
);

// Serve a pasta "public" na raiz
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

// -----------------------------------------------------------------------------
// Rota simples de health check
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "healthy",
    environment: process.env.NODE_ENV || "development",
    version: process.env.npm_package_version || "unknown",
    uptime: process.uptime(),
    supabase: {
      url: process.env.SUPABASE_URL ? "set ✓" : "not set ✗",
      anonKey: process.env.SUPABASE_ANON_KEY ? "set ✓" : "not set ✗",
      serviceKey: process.env.SUPABASE_SERVICE_KEY ? "set ✓" : "not set ✗"
    }
  });
});

// -----------------------------------------------------------------------------
// Handler do Remix (para qualquer rota que não seja um arquivo estático)
app.all(
  "*",
  createRequestHandler({
    build,
    mode: process.env.NODE_ENV || "production",
    getLoadContext(req, res) {
      // Disponibiliza env e req/res se precisar
      return { env: { ...process.env }, req, res };
    }
  })
);

// -----------------------------------------------------------------------------
// Tratamento de erro genérico
app.use((err, req, res, next) => {
  console.error("Server error:", err);
  res.status(500).json({
    message: "Internal Server Error",
    ...(process.env.NODE_ENV !== "production" && { error: err?.message })
  });
});

// -----------------------------------------------------------------------------
// Sobe servidor
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
