// app/session.server.ts
import { createCookieSessionStorage } from '@remix-run/cloudflare';
import * as fs from 'fs';
import { join } from 'path';

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

// Function to get the session secret with persistence (synchronous version)
const getSessionSecret = (): string => {
  // First check environment variables
  if (process.env.SESSION_SECRET) {
    return process.env.SESSION_SECRET;
  }

  let sessionSecret: string;

  // Only run file operations on the server, not in the browser
  if (typeof window === 'undefined') {
    try {
      // Create the session-data directory if it doesn't exist
      const sessionDir = join(process.cwd(), 'session-data');

      try {
        if (!fs.existsSync(sessionDir)) {
          fs.mkdirSync(sessionDir, { recursive: true });
        }
      } catch (err) {
        console.warn('Could not create session-data directory:', err);
      }

      const secretFilePath = join(sessionDir, 'session-secret');

      // Check if we already have a stored secret
      if (fs.existsSync(secretFilePath)) {
        try {
          sessionSecret = fs.readFileSync(secretFilePath, 'utf8').trim();
          console.log('Using persisted SESSION_SECRET from volume');

          return sessionSecret;
        } catch (err) {
          console.warn('Error reading session secret file:', err);
        }
      }

      // If we get here, we need to generate and store a new secret
      console.warn('Generating new persistent SESSION_SECRET');
      sessionSecret = generateRandomSecret();

      try {
        fs.writeFileSync(secretFilePath, sessionSecret, 'utf8');
        console.log('New SESSION_SECRET saved to persistent volume');
      } catch (err) {
        console.warn('Could not save SESSION_SECRET to file:', err);
      }

      return sessionSecret;
    } catch (err) {
      console.warn('Error in file operations:', err);
    }
  }

  // Fallback if all else fails
  console.warn('Using non-persistent SESSION_SECRET as fallback');

  return generateRandomSecret();
};

// Get or create a session secret (synchronously)
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
