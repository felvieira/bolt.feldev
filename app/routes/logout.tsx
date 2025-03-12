// app/routes/logout.tsx
import { Request, Response } from 'express';
import type { ExpressAppContext } from '~/utils/express-context-adapter.server';

export const loader = async (args: { context: ExpressAppContext, request: Request }) => {
  // Dynamically import server modules
  const { redirect } = await import('@remix-run/node');
  const { createApiHandler } = await import('~/utils/api-utils.server');
  const { getSession, destroySession } = await import('~/session.server');
  
  const handler = createApiHandler(async (context: ExpressAppContext, request: Request, response: Response) => {
    const cookieHeader = request.headers.cookie || '';
    const session = await getSession(cookieHeader);
    
    // Set destroyed session cookie and redirect using Remix pattern
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
