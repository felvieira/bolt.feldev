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
  
  return { supabaseUrl, supabaseAnonKey
