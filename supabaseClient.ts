// supabaseClient.ts
import { createClient } from '@supabase/supabase-js';

// Factory function to create Supabase client
export function getSupabaseClient() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Supabase credentials not available. Please check environment variables.');
  }

  return createClient(supabaseUrl, supabaseAnonKey);
}
