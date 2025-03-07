// app/utils/env-bridge.server.ts

/**
 * This module bridges Cloudflare Worker environment variables to process.env
 * It should be imported at the top of any server-side module that needs 
 * environment variables, particularly before supabase.server.ts
 */

// In Cloudflare Workers, environment variables are available via the global 'env' object
// We need to copy them to process.env for compatibility
declare global {
  // Define the env from Cloudflare Workers
  var env: Record<string, string> | undefined;
}

// Bridge environment variables from Cloudflare Worker context to Node.js process.env
if (typeof globalThis.env !== 'undefined') {
  console.log('Bridging Cloudflare Worker environment variables to process.env');
  
  // Copy env variables to process.env
  Object.keys(globalThis.env).forEach(key => {
    if (!process.env[key]) {
      process.env[key] = globalThis.env[key];
    }
  });
}

// Export a dummy object to ensure this module is executed when imported
export const envBridge = { initialized: true };
