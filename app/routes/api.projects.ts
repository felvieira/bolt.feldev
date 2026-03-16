import type { ActionFunctionArgs, LoaderFunctionArgs } from '@remix-run/cloudflare';

const AUTH_URL = process.env.AUTH_SERVICE_URL || 'http://auth-service:3200';

function getToken(request: Request): string | null {
  const cookie = request.headers.get('Cookie') || '';
  const match = cookie.match(/bolt_session=([^;]+)/);
  return match ? match[1] : null;
}

// GET /api/projects — list projects
export async function loader({ request }: LoaderFunctionArgs) {
  const token = getToken(request);

  if (!token) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  const res = await fetch(`${AUTH_URL}/projects`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  return new Response(res.body, {
    status: res.status,
    headers: { 'Content-Type': 'application/json' },
  });
}

// POST /api/projects — create project
export async function action({ request }: ActionFunctionArgs) {
  const token = getToken(request);

  if (!token) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }

  const body = await request.text();

  const res = await fetch(`${AUTH_URL}/projects`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body,
  });

  return new Response(res.body, {
    status: res.status,
    headers: { 'Content-Type': 'application/json' },
  });
}
