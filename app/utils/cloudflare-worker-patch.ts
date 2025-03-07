// Add this as app/utils/cloudflare-worker-patch.ts

/**
 * Cloudflare Worker Runtime Patch
 * 
 * This file directly modifies the Cloudflare Worker context to make
 * environment variables available in the format expected by the application.
 */

// Define globals for TypeScript
declare global {
  var env: Record<string, string> | undefined;
  // Added for Cloudflare specific access patterns
  var SUPABASE_URL: string | undefined;
  var SUPABASE_ANON_KEY: string | undefined;
  var SUPABASE_SERVICE_KEY: string | undefined;
}

// Function to copy environment variables to all possible locations
function ensureEnvAvailable() {
  console.log('Applying Cloudflare Worker Runtime Patch');
  
  // 1. Create env if it doesn't exist
  if (typeof globalThis.env === 'undefined') {
    globalThis.env = {} as Record<string, string>;
  }
  
  // 2. Create process if it doesn't exist (some Cloudflare contexts don't have it)
  if (typeof process === 'undefined') {
    (globalThis as any).process = { env: {} };
  } else if (!process.env) {
    process.env = {};
  }
  
  // List of critical environment variables
  const criticalEnvVars = [
    'SUPABASE_URL',
    'SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_KEY',
    'SESSION_SECRET',
    'DATABASE_URL'
  ];

  // 3. For each of our critical variables, ensure they're available everywhere
  criticalEnvVars.forEach(key => {
    // Find the value from any source
    let value: string | undefined;
    
    // Try globalThis.env first (Cloudflare Workers)
    if (globalThis.env && globalThis.env[key]) {
      value = globalThis.env[key];
    }
    // Try direct globalThis properties
    else if ((globalThis as any)[key]) {
      value = (globalThis as any)[key];
    }
    // Try process.env (Node.js)
    else if (process.env[key]) {
      value = process.env[key];
    }
    // Try self.env (another Cloudflare pattern)
    else if (typeof self !== 'undefined' && 'env' in self && (self as any).env[key]) {
      value = (self as any).env[key];
    }
    
    // If we found a value, ensure it's available in all locations
    if (value) {
      // Set it in globalThis.env
      if (globalThis.env) {
        globalThis.env[key] = value;
      }
      
      // Set it directly on globalThis
      (globalThis as any)[key] = value;
      
      // Set it in process.env
      process.env[key] = value;
      
      // Set it in self.env if available
      if (typeof self !== 'undefined' && 'env' in self) {
        (self as any).env[key] = value;
      }
    }
  });
  
  // 4. Log status (without revealing values)
  console.log('Environment variables status after patch:');
  criticalEnvVars.forEach(key => {
    console.log(`- ${key} available in process.env: ${!!process.env[key]}`);
    console.log(`- ${key} available in globalThis.env: ${!!(globalThis.env && globalThis.env[key])}`);
    console.log(`- ${key} available in globalThis: ${!!(globalThis as any)[key]}`);
  });
}

// Apply the patch immediately
ensureEnvAvailable();

// Export a refresh function that can be called again if needed
export const refreshEnvironment = ensureEnvAvailable;
