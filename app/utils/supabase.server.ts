// app/utils/supabase.server.js
import { createClient } from '@supabase/supabase-js';

// Function to get Supabase credentials, prioritizing environment variables
function getSupabaseCredentials() {
  // Get URL from environment
  const supabaseUrl = process.env.SUPABASE_URL || 
                     (typeof globalThis !== 'undefined' && globalThis.env?.SUPABASE_URL) ||
                     'https://replace-with-actual-supabase-url.supabase.co';
  
  // Get anon key from environment
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || 
                         (typeof globalThis !== 'undefined' && globalThis.env?.SUPABASE_ANON_KEY) ||
                         'replace-with-actual-supabase-key';
  
  return { supabaseUrl, supabaseAnonKey };
}

// Log environment status without revealing sensitive values
console.log('Supabase Client Initialization:');
console.log('- SUPABASE_URL available:', !!process.env.SUPABASE_URL);
console.log('- SUPABASE_ANON_KEY available:', !!process.env.SUPABASE_ANON_KEY);

// Get credentials
const { supabaseUrl, supabaseAnonKey } = getSupabaseCredentials();

// Create Supabase client
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Export factory function for tests or other scenarios
export function getSupabaseClient() {
  return createClient(supabaseUrl, supabaseAnonKey);
}
