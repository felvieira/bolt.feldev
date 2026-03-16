import * as jose from 'jose';

const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL || 'http://auth-service:3200';

export interface AuthUser {
  id: string;
  email: string;
  displayName: string;
}

export async function loginUser(email: string, password: string): Promise<{ token: string; user: AuthUser }> {
  const res = await fetch(`${AUTH_SERVICE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error?.message || 'Login failed');
  }

  return res.json();
}

export async function registerUser(
  email: string,
  password: string,
  displayName?: string,
): Promise<{ token: string; user: AuthUser }> {
  const res = await fetch(`${AUTH_SERVICE_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, displayName }),
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error?.message || 'Registration failed');
  }

  return res.json();
}

export async function verifySession(token: string): Promise<AuthUser | null> {
  try {
    const res = await fetch(`${AUTH_SERVICE_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      return null;
    }

    const data = await res.json();
    return data.user;
  } catch {
    return null;
  }
}

export function getSessionToken(request: Request): string | null {
  const cookie = request.headers.get('Cookie') || '';
  const match = cookie.match(/bolt_session=([^;]+)/);
  return match ? match[1] : null;
}

export async function requireUser(request: Request): Promise<AuthUser> {
  const token = getSessionToken(request);

  if (!token) {
    throw new Response('Unauthorized', { status: 401 });
  }

  const user = await verifySession(token);

  if (!user) {
    throw new Response('Unauthorized', { status: 401 });
  }

  return user;
}
