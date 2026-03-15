import type { ActionFunctionArgs } from '@remix-run/cloudflare';

const CODEX_PROXY_URL = process.env.CODEX_PROXY_URL || 'http://localhost:3100';

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    const response = await fetch(`${CODEX_PROXY_URL}/codex/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });

    const data = await response.json();

    if (!response.ok) {
      return Response.json(data, { status: response.status });
    }

    // Return sessionToken to frontend — it will store it in a cookie
    return Response.json(data);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to connect to codex-proxy';
    return Response.json({ error: message }, { status: 502 });
  }
}
