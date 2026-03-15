import type { ActionFunctionArgs } from '@remix-run/cloudflare';

function getCodexProxyUrl(context: any): string {
  return (
    process.env.CODEX_PROXY_URL ||
    (context?.cloudflare?.env as Record<string, string>)?.CODEX_PROXY_URL ||
    'http://localhost:3100'
  );
}

/**
 * Receives the OAuth callback URL pasted by the user.
 *
 * When bolt is deployed remotely, Auth0 redirects to localhost:1455
 * which the user's browser can't reach. Instead, the user copies the
 * failed URL from the address bar and pastes it into bolt's UI.
 * This route extracts the code+state and forwards them server-side
 * to the codex-proxy, which passes them to the Codex sidecar.
 */
export async function action({ request, context }: ActionFunctionArgs) {
  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const codexProxyUrl = getCodexProxyUrl(context);

  try {
    const body = (await request.json()) as { callbackUrl: string };
    const callbackUrl = body.callbackUrl;

    if (!callbackUrl) {
      return Response.json({ error: 'callbackUrl is required' }, { status: 400 });
    }

    // Extract query params from the pasted URL
    let url: URL;

    try {
      url = new URL(callbackUrl);
    } catch {
      return Response.json({ error: 'Invalid URL format' }, { status: 400 });
    }

    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    const scope = url.searchParams.get('scope');

    if (!code || !state) {
      return Response.json({ error: 'URL must contain code and state parameters' }, { status: 400 });
    }

    // Forward to codex-proxy's /auth/callback
    const params = new URLSearchParams();
    params.set('code', code);
    params.set('state', state);

    if (scope) {
      params.set('scope', scope);
    }

    const response = await fetch(`${codexProxyUrl}/auth/callback?${params.toString()}`, {
      redirect: 'manual',
    });

    // Check if the callback was successful
    if (response.ok || (response.status >= 300 && response.status < 400)) {
      return Response.json({ success: true });
    }

    const text = await response.text();

    return Response.json(
      { error: `Callback failed: ${text.substring(0, 200)}` },
      { status: response.status },
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to process callback';
    return Response.json({ error: message }, { status: 502 });
  }
}
