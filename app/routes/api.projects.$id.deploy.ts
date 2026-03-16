import type { ActionFunctionArgs } from '@remix-run/cloudflare';

const AUTH_URL = process.env.AUTH_SERVICE_URL || 'http://auth-service:3200';
const DEPLOY_URL = process.env.DEPLOY_SERVICE_URL || 'http://deploy-service:3300';
const INTERNAL_SECRET = 'bolt-internal';

function getToken(request: Request): string | null {
  const cookie = request.headers.get('Cookie') || '';
  const match = cookie.match(/bolt_session=([^;]+)/);
  return match ? match[1] : null;
}

export async function action({ request, params }: ActionFunctionArgs) {
  const token = getToken(request);
  if (!token) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
  }

  if (request.method === 'POST') {
    const { files } = (await request.json()) as { files?: Record<string, string> };
    const projectId = params.id;

    // 1. Get hosting config (slug)
    let slug: string;
    try {
      const hostRes = await fetch(`${AUTH_URL}/hosting/${projectId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const hostData = await hostRes.json();
      slug = hostData.slug;
      if (!slug) throw new Error('No slug configured');
    } catch {
      return new Response(JSON.stringify({ error: 'Configure hosting first (Publish button)' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    // 2. Update status to building
    await fetch(`${AUTH_URL}/hosting/${projectId}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ deploy_status: 'building' }),
    });

    // 3. Send to deploy-service
    try {
      const deployRes = await fetch(`${DEPLOY_URL}/deploy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-internal-secret': INTERNAL_SECRET },
        body: JSON.stringify({ projectId, slug, files: files || {} }),
      });

      const result = await deployRes.json();

      if (result.success) {
        // 4. Update status to live
        await fetch(`${AUTH_URL}/hosting/${projectId}`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ deploy_status: 'live' }),
        });

        return new Response(JSON.stringify({
          success: true,
          slug,
          url: `https://${slug}.${process.env.DOMAIN || 'localhost'}`,
          statusUrl: `/api/projects/${projectId}/deploy`,
        }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      } else {
        // Build failed
        await fetch(`${AUTH_URL}/hosting/${projectId}`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ deploy_status: 'error' }),
        });

        return new Response(JSON.stringify({ success: false, error: result.error, logs: result.logs }), { status: 500, headers: { 'Content-Type': 'application/json' } });
      }
    } catch (e: any) {
      await fetch(`${AUTH_URL}/hosting/${projectId}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ deploy_status: 'error' }),
      });
      return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }
  }

  if (request.method === 'GET') {
    // Get deploy status from deploy-service
    const hostRes = await fetch(`${AUTH_URL}/hosting/${params.id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return new Response(hostRes.body, { status: hostRes.status, headers: { 'Content-Type': 'application/json' } });
  }

  return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
}
