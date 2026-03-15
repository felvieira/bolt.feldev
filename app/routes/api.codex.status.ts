import type { LoaderFunctionArgs } from '@remix-run/cloudflare';

const CODEX_PROXY_URL = process.env.CODEX_PROXY_URL || 'http://localhost:3100';

export async function loader({ request: _request }: LoaderFunctionArgs) {
  try {
    const response = await fetch(`${CODEX_PROXY_URL}/codex/status`);
    const data = await response.json();

    if (!response.ok) {
      return Response.json(data, { status: response.status });
    }

    return Response.json(data);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to connect to codex-proxy';
    return Response.json({ error: message, running: false, available: false }, { status: 200 });
  }
}
