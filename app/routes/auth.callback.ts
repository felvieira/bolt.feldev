import type { LoaderFunctionArgs } from '@remix-run/cloudflare';

function getCodexProxyUrl(context: any): string {
  return (
    process.env.CODEX_PROXY_URL ||
    (context?.cloudflare?.env as Record<string, string>)?.CODEX_PROXY_URL ||
    'http://localhost:3100'
  );
}

/**
 * OAuth callback route.
 *
 * Auth0 redirects the user here after they authenticate with ChatGPT.
 * This route proxies the callback (with code + state query params) to
 * the codex-proxy, which forwards it to the Codex sidecar's internal
 * HTTP server for token exchange.
 */
export async function loader({ request, context }: LoaderFunctionArgs) {
  const codexProxyUrl = getCodexProxyUrl(context);
  const url = new URL(request.url);
  const queryString = url.search; // includes the leading '?'

  try {
    const response = await fetch(`${codexProxyUrl}/auth/callback${queryString}`, {
      redirect: 'manual',
    });

    // Forward redirect responses
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');

      if (location) {
        return Response.redirect(location, response.status);
      }
    }

    // Forward the HTML response from codex-proxy
    const body = await response.text();

    return new Response(body, {
      status: response.status,
      headers: { 'Content-Type': 'text/html' },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to connect to codex-proxy';

    return new Response(
      `<!DOCTYPE html>
<html>
  <head><title>Authentication Error</title></head>
  <body style="display:flex;align-items:center;justify-content:center;height:100vh;font-family:system-ui;background:#1a1a2e;color:#fff;">
    <div style="text-align:center">
      <h2 style="color:#ef4444">Authentication Error</h2>
      <p>${message}</p>
      <p>Please ensure the Codex proxy service is running and try again.</p>
    </div>
  </body>
</html>`,
      {
        status: 502,
        headers: { 'Content-Type': 'text/html' },
      },
    );
  }
}
