// app/session.server.ts
import { createCookieSessionStorage } from '@remix-run/node';
import { getEnvVar } from './utils/express-context-adapter.server';
import type { ExpressAppContext } from './utils/express-context-adapter.server';

/*
 * Helper function to generate a simple random string without crypto
 * This is safe to use in global scope
 */
function generateSimpleSecret(): string {
  return `temp-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
}

/*
 * Get initial session secret from environment or fall back to simple generation
 * Only use methods that are allowed in global scope
 */
const initialSessionSecret = process.env.SESSION_SECRET ?? generateSimpleSecret();

// Create the session storage with the initial secret
export const sessionStorage = createCookieSessionStorage({
  cookie: {
    name: '__session',
    httpOnly: true,
    path: '/',
    sameSite: 'lax',
    secrets: [initialSessionSecret],
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60 * 8, // 8 hours (in seconds)
  },
});

// Exported functions for session management
export const getSession = (cookie: string | null) => sessionStorage.getSession(cookie);
export const commitSession = (session: any) => sessionStorage.commitSession(session);
export const destroySession = (session: any) => sessionStorage.destroySession(session);

// Helper method to get session from Express request
export const getSessionFromRequest = async (req: Express.Request) => {
  // For Express requests that already have req.session
  if (req.session) {
    return req.session;
  }
  
  // Fall back to cookie-based session for Remix compatibility
  const cookie = req.headers.cookie || '';
  return await getSession(cookie);
};
