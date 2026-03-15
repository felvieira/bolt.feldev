import type { ActionFunctionArgs } from '@remix-run/cloudflare';

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
    const response = await fetch(`${codexProxyUrl}/codex/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });

    const data = (await response.json()) as Record<string, any>;

    if (!response.ok) {
      return Response.json(data, { status: response.status });
    }

    // Rewrite the authUrl's redirect_uri from localhost:PORT to the bolt app's
    // public URL. This ensures the OAuth callback arrives at the bolt app
    // instead of the user's localhost (which can't reach the Docker container).
    if (data.authUrl && typeof data.authUrl === 'string') {
      const requestUrl = new URL(request.url);
      const appOrigin = `${requestUrl.protocol}//${requestUrl.host}`;

      // Replace redirect_uri in the auth URL
      // The codex sidecar uses localhost:1455 (or similar) as the callback
      data.authUrl = data.authUrl.replace(
        /redirect_uri=http%3A%2F%2Flocalhost%3A\d+%2Fauth%2Fcallback/,
        `redirect_uri=${encodeURIComponent(`${appOrigin}/auth/callback`)}`,
      );
    }

    return Response.json(data);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to connect to codex-proxy';
    return Response.json({ error: message }, { status: 502 });
  }
}
