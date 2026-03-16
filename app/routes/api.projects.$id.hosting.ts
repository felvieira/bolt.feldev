import type { ActionFunctionArgs } from '@remix-run/cloudflare';

const AUTH_URL = process.env.AUTH_SERVICE_URL || 'http://auth-service:3200';

function getToken(request: Request): string | null {
  const cookie = request.headers.get('Cookie') || '';
  const match = cookie.match(/bolt_session=([^;]+)/);
  return match ? match[1] : null;
}

// PUT /api/projects/:id/hosting — configure hosting
export async function action({ request, params }: ActionFunctionArgs) {
  const token = getToken(request);

  if (!token) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  if (request.method !== 'PUT') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }

  const body = await request.text();

  const res = await fetch(`${AUTH_URL}/projects/${params.id}/hosting`, {
    method: 'PUT',
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
