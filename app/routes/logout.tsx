// app/routes/logout.tsx
import { Request, Response } from 'express';
import type { ExpressAppContext } from '~/utils/express-context-adapter.server';

export const loader = async (args: { context: ExpressAppContext, request: Request }) => {
  // Dynamically import server modules
  const { redirect } = await import('@remix-run/node');
  const { createApiHandler } = await import('~/utils/api-utils.server');
  const { getSession, destroySession } = await import('~/session.server');
  const { getSupabaseClient } = await import('~/utils/supabase.server');
  
  const handler = createApiHandler(async (context: ExpressAppContext, request: Request, response: Response) => {
    const cookieHeader = request.headers.cookie || '';
    const session = await getSession(cookieHeader, context);
    
    // Sign out from Supabase if there's an access token
    const accessToken = session.get('access_token');
    if (accessToken) {
      try {
        const supabase = getSupabaseClient(context);
        await supabase.auth.signOut();
      } catch (error) {
        console.error("Error signing out from Supabase:", error);
      }
    }
    
    // Set destroyed session cookie and redirect
    const cookie = await destroySession(session);
    return redirect('/login', {
      headers: {
        'Set-Cookie': cookie
      }
    });
  });

  return handler(args.context, args.request, args.context.res);
};

export default function Logout() {
  return <p>Logging out...</p>;
}
