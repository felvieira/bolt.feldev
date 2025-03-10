// supabaseClient.ts
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

// Function to get Supabase credentials from environment variables
function getSupabaseCredentials() {
  // Get URL from environment variables with fallbacks
  const supabaseUrl = process.env.SUPABASE_URL || 
                     (typeof globalThis !== 'undefined' && globalThis.env?.SUPABASE_URL) ||
                     'https://replace-with-actual-supabase-url.supabase.co';
  
  // Get anon key from environment variables with fallbacks
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || 
                         (typeof globalThis !== 'undefined' && globalThis.env?.SUPABASE_ANON_KEY) ||
                         'replace-with-actual-supabase-key';
  
  return { supabaseUrl, supabaseAnonKey };
}

// Create client with environment variables
export function getSupabaseClient() {
  const { supabaseUrl, supabaseAnonKey } = getSupabaseCredentials();
  return createClient(supabaseUrl, supabaseAnonKey);
}

// For compatibility with existing code
export const supabase = getSupabaseClient();

// Log status (without revealing actual values)
console.log('Supabase Client Initialization:');
console.log('- SUPABASE_URL available:', !!process.env.SUPABASE_URL || !!(typeof globalThis !== 'undefined' && globalThis.env?.SUPABASE_URL));
console.log('- SUPABASE_ANON_KEY available:', !!process.env.SUPABASE_ANON_KEY || !!(typeof globalThis !== 'undefined' && globalThis.env?.SUPABASE_ANON_KEY));
