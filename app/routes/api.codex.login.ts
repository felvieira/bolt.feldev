import type { ActionFunctionArgs } from '@remix-run/cloudflare';
import { getSessionToken, verifySession } from '~/lib/auth.server';

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

  // Resolve user id for multi-session
  const token = getSessionToken(request);
  const user = token ? await verifySession(token).catch(() => null) : null;
  const userId = user?.id || 'anonymous';

  try {
    const response = await fetch(`${codexProxyUrl}/codex/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': userId,
      },
    });

    const data = (await response.json()) as Record<string, any>;

    if (!response.ok) {
      return Response.json(data, { status: response.status });
    }

    return Response.json(data);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to connect to codex-proxy';
    return Response.json({ error: message }, { status: 502 });
  }
}
