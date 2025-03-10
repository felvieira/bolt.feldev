// app/utils/auth.server.ts
import { redirect } from '@remix-run/node';
import { getSessionFromRequest, getSession } from '~/session.server';
import { getSupabaseClientFromRequest, getSupabaseClient } from './supabase.server';
import type { ExpressAppContext } from './express-context-adapter.server';

/**
 * Check if a user is authenticated and redirect to login if not.
 * Compatible with both Express and Remix request objects.
 */
export async function requireAuth(request: Request | Express.Request) {
  // Get session - works with either Express or Remix requests
  const session = 'headers' in request && typeof request.headers.get !== 'function' 
    ? await getSessionFromRequest(request)
    : await getSession(request.headers.get('Cookie'));

  const accessToken = session?.access_token;
  
  // If no access token, redirect to login
  if (!accessToken) {
    throw redirect('/login');
  }

  // Verify token is valid with Supabase
  try {
    let supabaseClient;
    
    // Use appropriate client based on request type
    if ('headers' in request && typeof request.headers.get !== 'function') {
      // Express request
      supabaseClient = getSupabaseClientFromRequest(request);
    } else {
      // Remix request
      supabaseClient = getSupabaseClient();
      
      // Set auth manually for Remix requests
      supabaseClient.auth.setSession({
        access_token: accessToken,
        refresh_token: '',
      });
    }
    
    const { data, error } = await supabaseClient.auth.getUser();
    
    if (error || !data.user) {
      throw redirect('/login');
    }
    
    return data.user;
  } catch (error) {
    // Clear invalid session and redirect to login
    throw redirect('/login');
  }
}

/**
 * Get current user if authenticated, or return null
 */
export async function getCurrentUser(request: Request | Express.Request) {
  try {
    return await requireAuth(request);
  } catch (error) {
    return null;
  }
}
