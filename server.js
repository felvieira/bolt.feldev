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

// Log server startup info
console.log('Starting Express server with:');
console.log('- Current directory:', process.cwd());
console.log('- __dirname:', __dirname);
console.log('- NODE_ENV:', process.env.NODE_ENV || 'development');
console.log('- Expected build path:', path.join(__dirname, 'build/server/index.js'));

// Check if build directory exists
const buildServerDir = path.join(__dirname, 'build/server');
const buildFilePath = path.join(buildServerDir, 'index.js');

if (!fs.existsSync(buildServerDir)) {
  console.error('ERROR: Build directory does not exist:', buildServerDir);
  console.error('Please run "npm run build" to generate the server build');
  process.exit(1);
}

if (!fs.existsSync(buildFilePath)) {
  console.error('ERROR: Build output file does not exist:', buildFilePath);
  console.error('Available files in build/server directory:');
  
  try {
    const files = fs.readdirSync(buildServerDir);
    console.error(files.join('\n'));
  } catch (error) {
    console.error('Could not read directory contents:', error);
  }
  
  console.error('Please run "npm run build" to generate the server build');
  process.exit(1);
}

// Import the build with better error handling
let build;
try {
  console.log('Attempting to import build from:', buildFilePath);
  build = await import('./build/server/index.js');
  console.log('Successfully imported build module');
} catch (error) {
  console.error('Failed to import build:', error);
  
  // Check for common ESM/CJS issues
  if (error.code === 'ERR_MODULE_NOT_FOUND') {
    console.error('\nPossible solutions:');
    console.error('1. Make sure you have run "npm run build" before starting the server');
    console.error('2. Check remix.config.js and ensure serverModuleFormat is set correctly');
    console.error('3. Verify that your remix.config.js serverBuildPath matches where server.js is looking');
  }
  
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

// Serve static files from the "public/assets" directory under the "/assets" route
app.use(
  '/assets',
  express.static(path.join(__dirname, 'public', 'assets'), { 
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
    mode: process.env.NODE_ENV || 'production',
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
