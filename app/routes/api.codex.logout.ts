import type { ActionFunctionArgs } from '@remix-run/cloudflare';
import { parseCookies } from '~/lib/api/cookies';

function getCodexProxyUrl(context: any): string {
  return (
    process.env.CODEX_PROXY_URL ||
    (context?.cloudflare?.env as Record<string, string>)?.CODEX_PROXY_URL ||
    'http://localhost:3100'
  );
}

export async function action({ request, context }: ActionFunctionArgs) {
  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const codexProxyUrl = getCodexProxyUrl(context);

  try {
    const cookieHeader = request.headers.get('Cookie') || '';
    const cookies = parseCookies(cookieHeader);
    const sessionToken = cookies.codexSession || '';

    const response = await fetch(`${codexProxyUrl}/codex/logout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-codex-session': sessionToken,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      return Response.json(data, { status: response.status });
    }

    return Response.json(data);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to connect to codex-proxy';
    return Response.json({ error: message }, { status: 502 });
  }
}
