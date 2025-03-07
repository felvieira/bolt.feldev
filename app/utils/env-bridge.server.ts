/**
 * Environment Bridge for Cloudflare Workers
 * 
 * This module bridges environment variables between various contexts:
 * - Cloudflare Worker env object
 * - process.env for Node.js compatibility
 * - globalThis for global access
 */

// Define the Cloudflare Worker global env variable
declare global {
  var env: Record<string, string> | undefined;
}

// Logging helper that won't reveal sensitive values
const logEnvStatus = () => {
  console.log("Environment Status:");
  
  // Check process.env
  console.log("- process.env.SUPABASE_URL:", process.env.SUPABASE_URL ? "✓" : "✗");
  console.log("- process.env.SUPABASE_ANON_KEY:", process.env.SUPABASE_ANON_KEY ? "✓" : "✗");
  
  // Check globalThis.env
  if (typeof globalThis.env !== 'undefined') {
    console.log("- globalThis.env.SUPABASE_URL:", globalThis.env.SUPABASE_URL ? "✓" : "✗");
    console.log("- globalThis.env.SUPABASE_ANON_KEY:", globalThis.env.SUPABASE_ANON_KEY ? "✓" : "✗");
  } else {
    console.log("- globalThis.env: not available");
  }
  
  // Check direct globalThis properties
  console.log("- globalThis.SUPABASE_URL:", (globalThis as any).SUPABASE_URL ? "✓" : "✗");
  console.log("- globalThis.SUPABASE_ANON_KEY:", (globalThis as any).SUPABASE_ANON_KEY ? "✓" : "✗");
};

// Main bridging function
const bridgeEnvironmentVariables = () => {
  console.log("Bridging environment variables across contexts...");

  // APPROACH 1: Bridge from Cloudflare Worker env to process.env
  if (typeof globalThis.env !== 'undefined') {
    console.log("Found Cloudflare Worker env object, copying to process.env");
    
    Object.keys(globalThis.env).forEach(key => {
      if (process.env[key] === undefined || process.env[key] === null || process.env[key] === '') {
        process.env[key] = globalThis.env[key];
      }
    });
  }
  
  // APPROACH 2: Access direct properties on globalThis (sometimes Cloudflare does this)
  for (const key of ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_KEY', 'SESSION_SECRET']) {
    if ((globalThis as any)[key] && (!process.env[key] || process.env[key] === '')) {
      process.env[key] = (globalThis as any)[key];
    }
  }
  
  // APPROACH 3: Copy from process.env to globalThis for other modules that might use it
  for (const key of ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_KEY', 'SESSION_SECRET']) {
    if (process.env[key] && (!(globalThis as any)[key] || (globalThis as any)[key] === '')) {
      (globalThis as any)[key] = process.env[key];
    }
  }
  
  // If we're in the Cloudflare Worker context, ensure env is populated
  if (typeof globalThis.env === 'undefined') {
    // Create an env object if it doesn't exist
    globalThis.env = {} as Record<string, string>;
  }
  
  // APPROACH 4: Ensure globalThis.env has values from process.env
  for (const key of ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_KEY', 'SESSION_SECRET']) {
    if (process.env[key] && (!globalThis.env[key] || globalThis.env[key] === '')) {
      globalThis.env[key] = process.env[key];
    }
  }
  
  // Log the final status after all bridging
  logEnvStatus();
};

// Execute the bridging
bridgeEnvironmentVariables();

// Export a dummy object to ensure this module is executed when imported
export const envBridge = { 
  initialized: true,
  // Expose a function to manually re-bridge if needed
  refresh: bridgeEnvironmentVariables
};
