// supabase.server.ts
import { createClient } from '@supabase/supabase-js';

// For Cloudflare Workers compatibility, directly try to access from all possible sources
const getEnvVar = (name: string): string | undefined => {
  // Try hardcoded constants (injected by our script)
  if (typeof HARDCODED_URL !== 'undefined' && name === 'SUPABASE_URL') {
    return HARDCODED_URL;
  }
  if (typeof HARDCODED_KEY !== 'undefined' && name === 'SUPABASE_ANON_KEY') {
    return HARDCODED_KEY;
  }
  
  // Try Cloudflare Worker env
  if (typeof globalThis !== 'undefined' && globalThis.env && globalThis.env[name]) {
    return globalThis.env[name];
  }
  
  // Try process.env
  if (typeof process !== 'undefined' && process.env && process.env[name]) {
    return process.env[name];
  }
  
  // Try direct globalThis properties
  if (typeof globalThis !== 'undefined' && (globalThis as any)[name]) {
    return (globalThis as any)[name];
  }
  
  // Try browser-specific __ENV__ global
  if (typeof globalThis !== 'undefined' && 
      (globalThis as any).__ENV__ && 
      (globalThis as any).__ENV__[name]) {
    return (globalThis as any).__ENV__[name];
  }
  
  return undefined;
};

// Log environment status
console.log('Supabase Client Initialization:');
console.log('- Checking environment variables');

// Get Supabase credentials
const supabaseUrl = getEnvVar('SUPABASE_URL');
const supabaseAnonKey = getEnvVar('SUPABASE_ANON_KEY');

// Log result (without showing values)
console.log('- SUPABASE_URL available:', !!supabaseUrl);
console.log('- SUPABASE_ANON_KEY available:', !!supabaseAnonKey);

// Check if we have the necessary credentials
if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase credentials!');
  throw new Error('Supabase credentials not available. Please check environment variables.');
}

// Create and export the Supabase client
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Export the factory function for tests or other scenarios
export function getSupabaseClient() {
  return createClient(supabaseUrl, supabaseAnonKey);
}
