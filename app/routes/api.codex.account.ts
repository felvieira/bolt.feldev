import type { LoaderFunctionArgs } from '@remix-run/cloudflare';
import { parseCookies } from '~/lib/api/cookies';
import { getSessionToken, verifySession } from '~/lib/auth.server';

function getCodexProxyUrl(context: any): string {
  return (
    process.env.CODEX_PROXY_URL ||
    (context?.cloudflare?.env as Record<string, string>)?.CODEX_PROXY_URL ||
    'http://localhost:3100'
  );
}

export async function loader({ request, context }: LoaderFunctionArgs) {
  const codexProxyUrl = getCodexProxyUrl(context);

  // Resolve user id for multi-session
  const authToken = getSessionToken(request);
  const user = authToken ? await verifySession(authToken).catch(() => null) : null;
  const userId = user?.id || 'anonymous';

  try {
    const cookieHeader = request.headers.get('Cookie') || '';
    const cookies = parseCookies(cookieHeader);
    const sessionToken = cookies.codexSession || '';

    const response = await fetch(`${codexProxyUrl}/codex/account`, {
      headers: {
        'x-codex-session': sessionToken,
        'x-user-id': userId,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      return Response.json(data, { status: response.status });
    }

    // Include the resolved userId so the frontend can store it and send
    // the correct x-user-id in chat requests via the ChatGPT provider.
    return Response.json({ ...data, userId });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to connect to codex-proxy';
    return Response.json({ error: message }, { status: 502 });
  }
}
