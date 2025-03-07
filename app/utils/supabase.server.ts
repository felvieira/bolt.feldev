// Import the environment bridge first
import { envBridge } from './env-bridge.server';
import { createClient } from '@supabase/supabase-js';

// Debugging: Log environment variable status
console.log('Supabase Client Initialization:');
console.log('- SUPABASE_URL exists in process.env:', !!process.env.SUPABASE_URL);
console.log('- SUPABASE_ANON_KEY exists in process.env:', !!process.env.SUPABASE_ANON_KEY);

// Get variables from environment
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

// Validate required environment variables
if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase credentials!', {
    urlExists: !!supabaseUrl,
    keyExists: !!supabaseAnonKey
  });
  throw new Error('Supabase credentials not available. Please check environment variables.');
}

// Export the client instance
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Also export the factory function for tests or other scenarios
export function getSupabaseClient() {
  return createClient(supabaseUrl, supabaseAnonKey);
}
