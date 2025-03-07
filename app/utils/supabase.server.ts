// supabase.server.ts
import { createClient } from '@supabase/supabase-js';

// For Cloudflare Workers compatibility, directly try to access from globalThis first
const getEnvVar = (name: string): string | undefined => {
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
