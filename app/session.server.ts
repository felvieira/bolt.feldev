// app/session.server.ts
import { createCookieSessionStorage } from '@remix-run/cloudflare';

// Helper function to generate a secure random string
function generateRandomSecret(length = 32): string {
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const array = new Uint8Array(length);
    crypto.getRandomValues(array);

    return Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join('');
  }

  return `temp-${Date.now()}-${Math.random()
    .toString(36)
    .repeat(5)
    .substring(2, length + 2)}`;
}

// Get or create a session secret
const sessionSecret = process.env.SESSION_SECRET ?? generateRandomSecret();

export const sessionStorage = createCookieSessionStorage({
  cookie: {
    name: '__session',
    httpOnly: true,
    path: '/',
    sameSite: 'lax',
    secrets: [sessionSecret],
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60 * 8, // 8 hours (in seconds)
  },
});

export const getSession = (cookie: string | null) => sessionStorage.getSession(cookie);
export const commitSession = (session: any) => sessionStorage.commitSession(session);
export const destroySession = (session: any) => sessionStorage.destroySession(session);
