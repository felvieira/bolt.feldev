// app/utils/env-bridge.server.mjs

/**
 * Environment variable bridge to make process.env available in the global scope
 * and ensure compatibility between Express and Remix environments
 */

// Ensure global environment object exists
if (typeof globalThis !== 'undefined' && !globalThis.env) {
  globalThis.env = {};
  
  // Copy process.env values to global.env
  if (typeof process !== 'undefined' && process.env) {
    // Environment variables that should be available to the client
    const SHARED_ENV_VARS = [
      'NODE_ENV',
      'SUPABASE_URL',
      'SUPABASE_ANON_KEY',
      'RUNNING_IN_DOCKER',
    ];
    
    // Only copy necessary environment variables
    for (const key of SHARED_ENV_VARS) {
      if (process.env[key]) {
        globalThis.env[key] = process.env[key];
      }
    }
  }
}

// Log available keys for debugging
if (typeof globalThis !== 'undefined' && globalThis.env) {
  const availableKeys = Object.keys(globalThis.env);
  console.log(`[env-bridge] Available environment variables: ${availableKeys.length}`);
}

export default {};
