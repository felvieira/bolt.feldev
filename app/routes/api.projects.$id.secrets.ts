import type { ActionFunctionArgs, LoaderFunctionArgs } from '@remix-run/cloudflare';

const AUTH_URL = process.env.AUTH_SERVICE_URL || 'http://auth-service:3200';

function getToken(request: Request): string | null {
  const cookie = request.headers.get('Cookie') || '';
  const match = cookie.match(/bolt_session=([^;]+)/);
  return match ? match[1] : null;
}

// GET /api/projects/:id/secrets — list secrets
export async function loader({ request, params }: LoaderFunctionArgs) {
  const token = getToken(request);

  if (!token) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  const res = await fetch(`${AUTH_URL}/projects/${params.id}/secrets`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  return new Response(res.body, {
    status: res.status,
    headers: { 'Content-Type': 'application/json' },
  });
}

// PUT /api/projects/:id/secrets — upsert secret
// DELETE /api/projects/:id/secrets — delete secret
export async function action({ request, params }: ActionFunctionArgs) {
  const token = getToken(request);

  if (!token) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  const method = request.method;

  if (method !== 'PUT' && method !== 'DELETE') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
  const body = await request.text();

  const res = await fetch(`${AUTH_URL}/projects/${params.id}/secrets`, {
    method,
    headers,
    body,
  });

  return new Response(res.body, {
    status: res.status,
    headers: { 'Content-Type': 'application/json' },
  });
}
