// app/routes/logout.tsx
import { Request, Response } from 'express';
import { getSession, destroySession } from '~/session.server';
import { createApiHandler } from '~/utils/api-utils.server';
import type { ExpressAppContext } from '~/utils/express-context-adapter.server';

export const loader = createApiHandler(async (context: ExpressAppContext, request: Request, response: Response) => {
  const cookieHeader = request.headers.cookie || '';
  const session = await getSession(cookieHeader);
  
  // Set destroyed session cookie and redirect
  const cookie = await destroySession(session);
  response.setHeader('Set-Cookie', cookie);
  response.redirect(302, '/login');
  
  return response;
});

export default function Logout() {
  return <p>Logging out...</p>;
}
