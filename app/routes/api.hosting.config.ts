/**
 * /api/hosting/config — Configure hosting for a project.
 *
 * POST: { projectId, slug?, customDomain?, buildCommand?, outputDir? }
 * → Returns { autoUrl, customUrl, slug }
 *
 * GET?projectId=xxx → Returns current hosting config
 */
import { json, type ActionFunctionArgs, type LoaderFunctionArgs } from '@remix-run/cloudflare';

function getAuthUrl(context: any) {
  return (context?.cloudflare?.env as any)?.AUTH_SERVICE_URL
    || (typeof process !== 'undefined' ? process.env?.AUTH_SERVICE_URL : null)
    || 'http://auth-service:3200';
}

export async function loader({ request, context }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const projectId = url.searchParams.get('projectId');
  if (!projectId) return json({ error: 'projectId required' }, { status: 400 });

  const authUrl = getAuthUrl(context);
  const res = await fetch(`${authUrl}/hosting/${projectId}`);
  return json(await res.json());
}

export async function action({ request, context }: ActionFunctionArgs) {
  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed' }, { status: 405 });
  }

  const body = await request.json();
  const authUrl = getAuthUrl(context);

  const res = await fetch(`${authUrl}/hosting/${body.projectId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  return json(await res.json(), { status: res.status });
}
