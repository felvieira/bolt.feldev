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

// Initialize __dirname (needed in ESM)
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Import the build - use dynamic import with error handling
let build;
try {
  build = await import('./build/server/index.js');
  console.log('Successfully imported production build');
} catch (error) {
  console.error('Failed to import build:', error);
  process.exit(1);
}

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

// Remix request handler
app.all(
  '*',
  createRequestHandler({
    build,
    mode: 'production', // Force production mode
    getLoadContext(req, res) {
      // Inline implementation of context adapter
      return {
        env: { ...process.env },
        req,
        res
      };
    },
  })
);

// Error handling
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ 
    message: 'Internal Server Error',
    ...(process.env.NODE_ENV !== 'production' && { error: err.message })
  });
});

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
