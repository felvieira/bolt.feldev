// supabase.server.ts
import { createClient } from '@supabase/supabase-js';

// Hardcoded credentials - will be replaced at build/runtime
const HARDCODED_SUPABASE_URL = 'https://replace-with-actual-supabase-url.supabase.co';
const HARDCODED_SUPABASE_KEY = 'replace-with-actual-supabase-key';

// Log environment status
console.log('Supabase Client Initialization:');
console.log('- Using hardcoded credentials that will be replaced at runtime');

// Create and export the Supabase client directly with hardcoded values
// These values will be replaced by the update-supabase-creds.sh script
export const supabase = createClient(
  HARDCODED_SUPABASE_URL,
  HARDCODED_SUPABASE_KEY
);

// Export the factory function for tests or other scenarios
export function getSupabaseClient() {
  return createClient(HARDCODED_SUPABASE_URL, HARDCODED_SUPABASE_KEY);
}
