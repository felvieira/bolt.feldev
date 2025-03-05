// app/session.server.ts
import { createCookieSessionStorage } from '@remix-run/cloudflare';

// Try multiple ways to access SESSION_SECRET
const getSessionSecret = () => {
  // Try to get SESSION_SECRET from various possible locations
  const secret = process.env.SESSION_SECRET;

  if (secret) {
    return secret;
  }

  console.warn('WARNING: SESSION_SECRET not found in environment!');
  console.warn('Using a randomly generated temporary secret. Sessions will not persist across application restarts.');

  // Generate a random secret as fallback
  try {
    // Use Web Crypto API if available
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
      const array = new Uint8Array(32);
      crypto.getRandomValues(array);

      return Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join('');
    }

    // Fallback to simpler random generation
    return `temp-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
  } catch (error) {
    console.error('Error generating fallback SESSION_SECRET:', error);
    return `temp-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
  }
};

// Get session secret with fallback
const sessionSecret = getSessionSecret();

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
