import type { ActionFunctionArgs, LoaderFunctionArgs } from '@remix-run/cloudflare';

const AUTH_URL = process.env.AUTH_SERVICE_URL || 'http://auth-service:3200';

function getToken(request: Request): string | null {
  const cookie = request.headers.get('Cookie') || '';
  const match = cookie.match(/bolt_session=([^;]+)/);
  return match ? match[1] : null;
}

// GET /api/projects/:id — get project
export async function loader({ request, params }: LoaderFunctionArgs) {
  const token = getToken(request);

  if (!token) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  const res = await fetch(`${AUTH_URL}/projects/${params.id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  return new Response(res.body, {
    status: res.status,
    headers: { 'Content-Type': 'application/json' },
  });
}

// PATCH /api/projects/:id — update project
// DELETE /api/projects/:id — delete project
export async function action({ request, params }: ActionFunctionArgs) {
  const token = getToken(request);

  if (!token) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  const method = request.method;

  if (method !== 'PATCH' && method !== 'DELETE') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }

  const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
  let body: string | undefined;

  if (method === 'PATCH') {
    headers['Content-Type'] = 'application/json';
    body = await request.text();
  }

  const res = await fetch(`${AUTH_URL}/projects/${params.id}`, {
    method,
    headers,
    body,
  });

  return new Response(res.body, {
    status: res.status,
    headers: { 'Content-Type': 'application/json' },
  });
}
