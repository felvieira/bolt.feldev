import type { LoaderFunctionArgs } from '@remix-run/cloudflare';

function getCodexProxyUrl(context: any): string {
  return (
    process.env.CODEX_PROXY_URL ||
    (context?.cloudflare?.env as Record<string, string>)?.CODEX_PROXY_URL ||
    'http://localhost:3100'
  );
}

export async function loader({ request: _request, context }: LoaderFunctionArgs) {
  const codexProxyUrl = getCodexProxyUrl(context);

  try {
    const response = await fetch(`${codexProxyUrl}/codex/diag`);
    const data = await response.json();
    return Response.json(data);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to connect to codex-proxy';
    return Response.json({ error: message }, { status: 502 });
  }
}
