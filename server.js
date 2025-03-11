// server.js
import express from 'express';
import compression from 'compression';
import session from 'express-session';
import { createRequestHandler } from '@remix-run/express';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import 'dotenv/config';
import cookieParser from 'cookie-parser';

// Use dynamic import for the build to support both dev and production
let build;
async function importBuild() {
  try {
    // In production, the build is in ./build/server/index.js
    if (process.env.NODE_ENV === 'production') {
      build = await import('./build/server/index.js');
      console.log('Loaded production build');
    } else {
      // In development, the build is in @remix-run/dev/server-build
      build = await import('@remix-run/dev/server-build');
      console.log('Loaded development build');
    }
  } catch (error) {
    console.error('Failed to import build:', error);
    process.exit(1);
  }
}

// Import the context adapter dynamically to avoid it being included in client bundles
let createExpressContext;
async function importAdapter() {
  try {
    const adapter = await import('./app/utils/express-context-adapter.server.js');
    createExpressContext = adapter.createExpressContext;
    console.log('Loaded Express context adapter');
  } catch (error) {
    console.error('Failed to import Express context adapter:', error);
    // Provide a fallback adapter if the import fails
    createExpressContext = (req, res) => ({ req, res, env: process.env });
  }
}

// Initialize __dirname (needed in ESM)
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();

// Session configuration
let sessionSecret = process.env.SESSION_SECRET;

// Generate a session secret if not available
if (!sessionSecret) {
  console.warn('SESSION_SECRET not defined; using a generated value. This is not secure for production.');
  sessionSecret = require('crypto').randomBytes(32).toString('hex');
  
  // Save to session-data if running in Docker
  if (process.env.RUNNING_IN_DOCKER === 'true') {
    const sessionDataPath = '/app/session-data';
    if (fs.existsSync(sessionDataPath)) {
      fs.writeFileSync(path.join(sessionDataPath, 'session-secret'), sessionSecret);
      console.log('Generated and saved new SESSION_SECRET to session-data');
    }
  }
}

// Cookie parser middleware
app.use(cookieParser());

// Session middleware
app.use(
  session({
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    },
  })
);

// Configure compression
app.use(compression({
  level: 6,
  threshold: 0,
  filter: (req, res) => {
    if (res.getHeader('Content-Type')?.includes('image/')) {
      return false;
    }
    return compression.filter(req, res);
  }
}));

// Standard middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORS headers for compatibility with browser APIs
app.use((req, res, next) => {
  res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  next();
});

// Serve static files
app.use(
  '/build',
  express.static(path.join(__dirname, 'public', 'build'), { 
    immutable: true, 
    maxAge: '1y' 
  })
);

app.use(
  express.static(path.join(__dirname, 'public'), { 
    maxAge: '1h',
    setHeaders: (res, path) => {
      if (path.endsWith('.html')) {
        res.setHeader('Cache-Control', 'public, max-age=0');
      }
    }
  })
);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    version: process.env.npm_package_version || 'unknown',
    environment: process.env.NODE_ENV || 'development',
    uptime: process.uptime(),
    supabase: {
      url: process.env.SUPABASE_URL ? 'set ✓' : 'not set ✗',
      anonKey: process.env.SUPABASE_ANON_KEY ? 'set ✓' : 'not set ✗',
      serviceKey: process.env.SUPABASE_SERVICE_KEY ? 'set ✓' : 'not set ✗'
    }
  });
});

// Error handling
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ 
    message: 'Internal Server Error',
    ...(process.env.NODE_ENV !== 'production' && { error: err.message })
  });
});

// Start function to import modules and start the server
async function startServer() {
  // Import the build and adapter
  await importBuild();
  await importAdapter();
  
  // Remix request handler
  app.all(
    '*',
    createRequestHandler({
      build,
      mode: process.env.NODE_ENV,
      getLoadContext(req, res) {
        // Use our context adapter to maintain compatibility
        return createExpressContext(req, res);
      },
    })
  );

  // Start server
  const port = process.env.PORT || 5173;
  app.listen(port, () => {
    console.log(`
★═══════════════════════════════════════★
          B O L T . D I Y
      Express Server Running
★═══════════════════════════════════════★
    `);
    console.log(`Server listening on port ${port}`);
    console.log(`NODE_ENV: ${process.env.NODE_ENV || 'development'}`);
    console.log(`SESSION_SECRET: ${sessionSecret ? 'Set ✓' : 'Not set ✗'}`);
    console.log(`SUPABASE_URL: ${process.env.SUPABASE_URL ? 'Set ✓' : 'Not set ✗'}`);
    console.log('★═══════════════════════════════════════★');
  });
}

// Start the server
startServer().catch(error => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
