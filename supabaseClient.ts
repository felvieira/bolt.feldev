// supabaseClient.ts
import { createClient } from '@supabase/supabase-js';

// Hardcoded credentials - will be replaced at build/runtime
const HARDCODED_SUPABASE_URL = 'https://replace-with-actual-supabase-url.supabase.co';
const HARDCODED_SUPABASE_KEY = 'replace-with-actual-supabase-key';

// Create client with hardcoded values that will be replaced
export function getSupabaseClient() {
  return createClient(HARDCODED_SUPABASE_URL, HARDCODED_SUPABASE_KEY);
}

// For compatibility with existing code
export const supabase = getSupabaseClient();
