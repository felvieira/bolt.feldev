import { createClient } from '@supabase/supabase-js';

// Print environment variables for debugging (remove in production)
console.log('Environment check in supabase.server.ts:');
console.log('SUPABASE_URL exists?', !!process.env.SUPABASE_URL);
console.log('SUPABASE_ANON_KEY exists?', !!process.env.SUPABASE_ANON_KEY);

// Try both process.env and direct globals
const supabaseUrl = process.env.SUPABASE_URL || globalThis.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || globalThis.SUPABASE_ANON_KEY;

// Add fallbacks for development/testing if needed
const finalSupabaseUrl = supabaseUrl || '';
const finalSupabaseAnonKey = supabaseAnonKey || '';

// Check if we have credentials
if (!finalSupabaseUrl || !finalSupabaseAnonKey) {
  console.error('Supabase credentials missing:', { 
    urlExists: !!finalSupabaseUrl, 
    keyExists: !!finalSupabaseAnonKey 
  });
  throw new Error('Supabase credentials not available. Please check environment variables.');
}

// Export the client instance
export const supabase = createClient(finalSupabaseUrl, finalSupabaseAnonKey);

// Also export the factory function for tests or other scenarios
export function getSupabaseClient() {
  return createClient(finalSupabaseUrl, finalSupabaseAnonKey);
}
