// app/utils/supabase.server.ts
export function getSupabaseClient(context?: ExpressAppContext) {
  if (supabaseClient) return supabaseClient;

  // Get credentials either from Express context or environment variables
  const supabaseUrl = context ? 
    getEnvVar(context, 'SUPABASE_URL') : 
    process.env.SUPABASE_URL;
  
  const supabaseKey = context ? 
    (getEnvVar(context, 'SUPABASE_ANON_KEY') || getEnvVar(context, 'SUPABASE_KEY')) : 
    (process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_KEY);
  
  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing Supabase credentials. Check SUPABASE_URL and SUPABASE_ANON_KEY/SUPABASE_KEY environment variables.');
  }

  // Create and return the Supabase client
  supabaseClient = createClient(supabaseUrl, supabaseKey);
  return supabaseClient;
}
