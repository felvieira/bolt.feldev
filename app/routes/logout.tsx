// app/routes/logout.tsx
import { Request, Response } from 'express';
import { getSession, destroySession } from '~/session.server';
import { createApiHandler } from '~/utils/api-utils.server';
import type { ExpressAppContext } from '~/utils/express-context-adapter.server';
import { redirect } from '@remix-run/node';

export const loader = createApiHandler(async (context: ExpressAppContext, request: Request, response: Response) => {
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

export default function Logout() {
  return <p>Logging out...</p>;
}
