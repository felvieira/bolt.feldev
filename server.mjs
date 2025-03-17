import express from "express";
import compression from "compression";
import session from "express-session";
import RedisStore from "connect-redis";
import { createClient } from "redis";
import { createRequestHandler } from "@remix-run/express";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import "dotenv/config";
import cookieParser from "cookie-parser";
import crypto from "crypto";
import { execSync } from "child_process";

// -----------------------------------------------------------------------------
// Inicializa __dirname (já que usamos ESM)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Log básico
console.log("=== Starting Express server (ESM version) ===");
console.log("- Current directory:", process.cwd());
console.log("- __dirname:", __dirname);
console.log("- NODE_ENV:", process.env.NODE_ENV || "development");
console.log("- Expecting Remix build at:", path.join(__dirname, "build/server/index.js"));

// -----------------------------------------------------------------------------
// Direct Redis implementation
// Redis client setup directly in server.mjs
const getRedis = async () => {
  console.log("=== REDIS CONNECTION SETUP ===");
  
  // Try multiple ways to get the Redis URL
  let redisUrl = process.env.REDIS_URL;
  
  // If not available directly, try using child_process
  if (!redisUrl) {
    console.log("REDIS_URL not found in process.env, trying child_process...");
    try {
      redisUrl = execSync('echo $REDIS_URL').toString().trim();
      if (redisUrl) {
        console.log("Retrieved REDIS_URL using child_process");
      }
    } catch (error) {
      console.error("Failed to retrieve REDIS_URL using child_process:", error);
    }
  }
  
  if (!redisUrl) {
    throw new Error("REDIS_URL environment variable is required but not found");
  }
  
  // Log a sanitized version of the URL (hide credentials)
  const sanitizedUrl = redisUrl.replace(/\/\/(.*):(.*)@/, '//***:***@');
  console.log(`Using Redis URL: ${sanitizedUrl}`);
  
  const client = createClient({
    url: redisUrl,
    socket: {
      reconnectStrategy: (retries) => {
        console.log(`Redis connection retry attempt ${retries}`);
        return Math.min(retries * 50, 2000);
      }
    }
  });
  
  // Handle connection errors
  client.on('error', (err) => {
    console.error('Redis connection error:', err);
    
    // Provide more helpful messages for common errors
    if (err.message && err.message.includes('WRONGPASS')) {
      console.error('Authentication failed. Check your Redis credentials in REDIS_URL.');
    } else if (err.message && err.message.includes('ECONNREFUSED')) {
      console.error('Connection refused. Check if Redis server is running and accessible.');
    }
  });
  
  try {
    await client.connect();
    console.log("Successfully connected to Redis server");
    return client;
  } catch (err) {
    console.error("Failed to connect to Redis:", err);
    throw err;
  }
};

// -----------------------------------------------------------------------------
// Verifica se build do Remix existe
const buildServerDir = path.join(__dirname, "build", "server");
const buildFilePath = path.join(buildServerDir, "index.js");

if (!fs.existsSync(buildServerDir)) {
  console.error("ERRO: Pasta de build do servidor não existe:", buildServerDir);
  process.exit(1);
}
if (!fs.existsSync(buildFilePath)) {
  console.error("ERRO: Arquivo build/server/index.js não existe:", buildFilePath);
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
// Redis client setup
let redisClient;
let redisStore;

try {
  console.log("Setting up Redis client and session store...");
  redisClient = await getRedis();
  
  // Create Redis store for sessions
  redisStore = new RedisStore({
    client: redisClient,
    prefix: "bolt:sess:",
  });
  console.log("Redis session store initialized successfully");
} catch (error) {
  console.warn("Failed to connect to Redis:", error);
  console.warn("The application will run without Redis, some features may not work correctly");
}

// -----------------------------------------------------------------------------
// Cria app Express
const app = express();

// Configura session secret
let sessionSecret = process.env.SESSION_SECRET;
if (!sessionSecret) {
  console.warn("SESSION_SECRET não definido; gerando valor aleatório (não é seguro em produção).");
  sessionSecret = crypto.randomBytes(32).toString("hex");
}

// Middlewares básicos
app.use(cookieParser());
app.use(
  session({
    store: redisStore || undefined, // Fall back to default MemoryStore if Redis not available
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
// Serve arquivos estáticos
const staticDirs = [
  { path: "/assets", dir: path.join(__dirname, "build", "client", "assets"), options: { immutable: true, maxAge: "1y" } },
  { path: "/", dir: path.join(__dirname, "public"), options: { 
    maxAge: "1h", 
    setHeaders: (res, filePath) => {
      if (filePath.endsWith(".html")) {
        res.setHeader("Cache-Control", "public, max-age=0");
      }
    }
  }}
];

// Configura as rotas para servir os arquivos estáticos
staticDirs.forEach(({ path: routePath, dir, options }) => {
  app.use(routePath, express.static(dir, options));
});

console.log("Serving static files from:", staticDirs.map(dir => dir.dir));

// -----------------------------------------------------------------------------
// Rota simples de health check
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "healthy",
    environment: process.env.NODE_ENV || "development",
    version: process.env.npm_package_version || "unknown",
    uptime: process.uptime(),
    redis: {
      connected: redisClient?.isReady || false
    },
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
      return { 
        env: { ...process.env }, 
        req, 
        res,
        // Provide redis client to the context if available
        redis: redisClient?.isReady ? redisClient : undefined
      };
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

// Graceful shutdown to close Redis connection
process.on('SIGINT', async () => {
  console.log('Shutting down server...');
  if (redisClient?.isReady) {
    console.log('Closing Redis connection...');
    await redisClient.quit();
  }
  process.exit(0);
});

// -----------------------------------------------------------------------------
// Sobe servidor
const port = process.env.PORT || 5173;
app.listen(port, () => {
  console.log(`
★═══════════════════════════════════════★
          B O L T . D I Y
      Express Server Running (ESM)
★═══════════════════════════════════════★
  `);
  console.log(`Server listening on port ${port}`);
  console.log(`NODE_ENV: ${process.env.NODE_ENV || "development"}`);
  console.log(`SESSION_SECRET: ${sessionSecret ? "Set ✓" : "Not set ✗"}`);
  console.log(`SUPABASE_URL: ${process.env.SUPABASE_URL ? "Set ✓" : "Not set ✗"}`);
  console.log(`REDIS_URL: ${process.env.REDIS_URL ? "Set ✓" : "Default (localhost:6379)"}`);
  console.log(`REDIS Connected: ${redisClient?.isReady ? "Yes ✓" : "No ✗ (using memory store)"}`);
  console.log("★═══════════════════════════════════════★");
});
