// app/utils/env-bridge.server.js

/**
 * Express-compatible environment bridge for transition from Cloudflare
 * 
 * This module ensures environment variables are consistently available across
 * various contexts when using Express backend instead of Cloudflare Workers
 */

// Initialize the environment bridge
function initializeEnvBridge() {
  console.log('Initializing Express environment bridge...');

  // Create a global.env fallback if needed for compatibility
  if (typeof globalThis.env === 'undefined') {
    globalThis.env = {};
    console.log('Created globalThis.env for compatibility');
  }

  // Critical environment variables to ensure availability
  const criticalVars = [
    'SUPABASE_URL',
    'SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_KEY',
    'SESSION_SECRET',
    'DATABASE_URL',
    'NODE_ENV'
  ];

  // Check and bridge variables between contexts
  criticalVars.forEach(key => {
    // Get from process.env (Express standard)
    if (process.env[key]) {
      // Mirror to globalThis.env for legacy code
      globalThis.env[key] = process.env[key];
      
      // Set directly on globalThis for deepest compatibility
      globalThis[key] = process.env[key];
    } 
    // Get from globalThis.env (Cloudflare pages pattern)
    else if (globalThis.env && globalThis.env[key]) {
      // Mirror to process.env for Express code
      process.env[key] = globalThis.env[key];
      
      // Set directly on globalThis
      globalThis[key] = globalThis.env[key];
    }
    // Get directly from globalThis (another Cloudflare pattern)
    else if (globalThis[key]) {
      // Mirror to process.env for Express code
      process.env[key] = globalThis[key];
      
      // Mirror to globalThis.env for legacy code
      globalThis.env[key] = globalThis[key];
    }
  });

  // Log environment status (without revealing values)
  console.log('Environment Bridge Status:');
  criticalVars.forEach(key => {
    console.log(`- ${key}: ${!!process.env[key] ? '✓' : '✗'}`);
  });
}

// Run initialization
initializeEnvBridge();

// Export to support import statements
export const envBridge = {
  initialized: true,
  refresh: initializeEnvBridge
};
