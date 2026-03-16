import type { ActionFunctionArgs } from '@remix-run/cloudflare';
import { json } from '@remix-run/cloudflare';
import { getSessionToken } from '~/lib/auth.server';

const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL || 'http://auth-service:3200';

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed' }, { status: 405 });
  }

  const token = getSessionToken(request);

  if (!token) {
    return json({ error: 'No session' }, { status: 401 });
  }

  try {
    const res = await fetch(`${AUTH_SERVICE_URL}/auth/refresh`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      // Clear the expired cookie
      return json({ error: 'Token refresh failed' }, {
        status: 401,
        headers: {
          'Set-Cookie': `bolt_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`,
        },
      });
    }

    const data = await res.json();

    return json({ success: true }, {
      headers: {
        'Set-Cookie': `bolt_session=${data.token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${60 * 60 * 24 * 7}${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`,
      },
    });
  } catch {
    return json({ error: 'Auth service unavailable' }, { status: 502 });
  }
}
