import { createClient } from '@supabase/supabase-js';

// Access environment variables directly from multiple possible sources
// to handle Cloudflare Workers environment
const getEnv = (key: string): string | undefined => {
  // Try all possible sources
  const sources = [
    // 1. Standard Node.js process.env
    process.env[key],
    // 2. Cloudflare Workers global env
    typeof globalThis.env !== 'undefined' ? globalThis.env[key] : undefined,
    // 3. Direct global properties (sometimes set by Cloudflare)
    (globalThis as any)[key],
    // 4. Try to access from self (another Cloudflare pattern)
    typeof self !== 'undefined' && 'env' in self ? (self as any).env[key] : undefined
  ];
  
  // Return the first non-empty value
  return sources.find(val => val !== undefined && val !== null && val !== '');
};

// Log environment access attempts (without showing values)
console.log('Supabase Client Initialization (with Cloudflare support):');
console.log('- process.env.SUPABASE_URL exists:', !!process.env.SUPABASE_URL);
console.log('- process.env.SUPABASE_ANON_KEY exists:', !!process.env.SUPABASE_ANON_KEY);
console.log('- globalThis.env exists:', typeof globalThis.env !== 'undefined');
if (typeof globalThis.env !== 'undefined') {
  console.log('- globalThis.env.SUPABASE_URL exists:', !!globalThis.env.SUPABASE_URL);
  console.log('- globalThis.env.SUPABASE_ANON_KEY exists:', !!globalThis.env.SUPABASE_ANON_KEY);
}

// Get environment variables using our helper
const supabaseUrl = getEnv('SUPABASE_URL');
const supabaseAnonKey = getEnv('SUPABASE_ANON_KEY');

// Log what we found (without showing values)
console.log('- After getEnv, SUPABASE_URL exists:', !!supabaseUrl);
console.log('- After getEnv, SUPABASE_ANON_KEY exists:', !!supabaseAnonKey);

// Check if we have all the required variables
if (!supabaseUrl || !supabaseAnonKey) {
  // For development environment, allow using dummy values
  if (process.env.NODE_ENV !== 'production') {
    console.warn('WARNING: Using development fallbacks for Supabase credentials');
    const devUrl = 'http://localhost:54321';
    const devKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJneWJ3Z2Jsb3d3Ynpjcm5qeXd3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MDk4NDg1NjAsImV4cCI6MjAyNTQyNDU2MH0.S60I_ygAPJ5XmMwW9q0yIiKGQFYlhqXXwlLFfGYbPt4';
    
    // Export the client with development fallbacks
    export const supabase = createClient(
      supabaseUrl || devUrl,
      supabaseAnonKey || devKey
    );
    
    // Export the factory function
    export function getSupabaseClient() {
      return createClient(supabaseUrl || devUrl, supabaseAnonKey || devKey);
    }
  } else {
    // In production, fail if credentials are missing
    console.error('Missing Supabase credentials!', {
      urlExists: !!supabaseUrl,
      keyExists: !!supabaseAnonKey
    });
    throw new Error('Supabase credentials not available. Please check environment variables.');
  }
} else {
  // We have credentials, create the client normally
  console.log('Supabase credentials found, creating client');
  
  // Export the client instance
  export const supabase = createClient(supabaseUrl, supabaseAnonKey);
  
  // Export the factory function
  export function getSupabaseClient() {
    return createClient(supabaseUrl, supabaseAnonKey);
  }
}
