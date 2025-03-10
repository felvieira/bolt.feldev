// app/utils/supabase.server.ts
import { createClient } from '@supabase/supabase-js';
import { getEnvVar } from './express-context-adapter.server';
import type { ExpressAppContext } from './express-context-adapter.server';

// This is a singleton pattern - we only want one Supabase client instance
let supabaseClient: ReturnType<typeof createClient> | null = null;

/**
 * Gets a Supabase client instance configured with the application's credentials
 * 
 * Uses environment variables to configure the client, with support for both
 * Express context-based access and direct process.env access
 * 
 * @param context Optional Express context for environment variable access
 * @returns Configured Supabase client
 */
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

/**
 * Gets a Supabase client from an authenticated session
 * 
 * This is used for authenticated operations where the user's session token
 * should be used instead of the anonymous key
 * 
 * @param accessToken User's access token from session
 * @param context Optional Express context for environment variable access
 * @returns Supabase client configured with user's access token
 */
export function getSupabaseClientWithAuth(accessToken: string, context?: ExpressAppContext) {
  // Get URL either from Express context or environment variables
  const supabaseUrl = context ? 
    getEnvVar(context, 'SUPABASE_URL') : 
    process.env.SUPABASE_URL;
  
  if (!supabaseUrl) {
    throw new Error('Missing Supabase URL. Check SUPABASE_URL environment variable.');
  }

  // Create and return a new Supabase client with the access token
  return createClient(supabaseUrl, accessToken);
}

/**
 * Gets a Supabase client from an Express request
 * 
 * Looks for the access token in the session and returns an authenticated
 * client if available, or falls back to the anonymous client
 * 
 * @param request Express request object with session
 * @param context Optional Express context for environment variable access
 * @returns Supabase client (authenticated if session contains access token)
 */
export function getSupabaseClientFromRequest(request: Express.Request, context?: ExpressAppContext) {
  // Check if we have an access token in the session
  if (request.session && request.session.access_token) {
    return getSupabaseClientWithAuth(request.session.access_token, context);
  }
  
  // Fall back to anonymous client
  return getSupabaseClient(context);
}
