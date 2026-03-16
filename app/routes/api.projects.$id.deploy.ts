import type { ActionFunctionArgs } from '@remix-run/cloudflare';

const AUTH_URL = process.env.AUTH_SERVICE_URL || 'http://auth-service:3200';

function getToken(request: Request): string | null {
  const cookie = request.headers.get('Cookie') || '';
  const match = cookie.match(/bolt_session=([^;]+)/);
  return match ? match[1] : null;
}

export async function action({ request, params }: ActionFunctionArgs) {
  const token = getToken(request);

  if (!token) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  if (request.method === 'POST') {
    // Trigger deploy
    const { files, projectSlug } = await request.json();

    // For now, proxy to auth-service which will handle Docker operations
    // The actual container creation would need server-side Docker API access
    // which isn't available in Cloudflare Workers

    // Update hosting status to 'building'
    await fetch(`${AUTH_URL}/projects/${params.id}/hosting`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ provider: 'self', deployStatus: 'building' }),
    });

    // TODO: In production, this would call a deployment service
    // that has Docker socket access to:
    // 1. Write files to a temp directory
    // 2. Generate a Dockerfile (node:20-alpine, copy files, npm install, npm start)
    // 3. docker build -t project-{slug} .
    // 4. docker run with Traefik labels: Host(`{slug}.localhost`)
    // 5. Update hosting with container ID and status 'live'

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Deploy initiated',
        note: 'Self-hosted deployment requires Docker socket access. Configure deployment service for full functionality.',
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  }

  if (request.method === 'GET') {
    // Get deploy status
    const res = await fetch(`${AUTH_URL}/projects/${params.id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return new Response(res.body, { status: res.status, headers: { 'Content-Type': 'application/json' } });
  }

  return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
}
