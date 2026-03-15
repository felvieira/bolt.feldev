import type { LoaderFunctionArgs } from '@remix-run/cloudflare';
import { parseCookies } from '~/lib/api/cookies';

function getCodexProxyUrl(context: any): string {
  return (
    process.env.CODEX_PROXY_URL ||
    (context?.cloudflare?.env as Record<string, string>)?.CODEX_PROXY_URL ||
    'http://localhost:3100'
  );
}

export async function loader({ request, context }: LoaderFunctionArgs) {
  const codexProxyUrl = getCodexProxyUrl(context);

  try {
    const cookieHeader = request.headers.get('Cookie') || '';
    const cookies = parseCookies(cookieHeader);
    const sessionToken = cookies.codexSession || '';

    const response = await fetch(`${codexProxyUrl}/codex/account`, {
      headers: {
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
