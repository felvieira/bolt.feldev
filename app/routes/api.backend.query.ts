/**
 * Internal backend API — SQL query execution
 * Connects to the instance's own Postgres via DATABASE_URL env var.
 */
import { json, type ActionFunctionArgs } from '@remix-run/cloudflare';

export async function action({ request, context }: ActionFunctionArgs) {
  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed' }, { status: 405 });
  }

  try {
    const { sql } = (await request.json()) as { sql: string };

    if (!sql?.trim()) {
      return json({ error: 'No SQL provided' }, { status: 400 });
    }

    // Use DATABASE_URL from environment
    const dbUrl = (context.cloudflare?.env as any)?.DATABASE_URL || process.env?.DATABASE_URL;

    if (!dbUrl) {
      return json({ error: 'DATABASE_URL not configured on this instance' }, { status: 503 });
    }

    // Execute via pg-compatible HTTP proxy or direct connection
    // We forward to /api/db-proxy which handles the actual pg connection server-side
    const proxyRes = await fetch(`${new URL(request.url).origin}/api/db-proxy`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-internal-secret': 'bolt-internal' },
      body: JSON.stringify({ sql, dbUrl }),
    });

    if (!proxyRes.ok) {
      const err = await proxyRes.json().catch(() => ({ error: 'Query failed' }));
      return json(err, { status: proxyRes.status });
    }

    return json(await proxyRes.json());
  } catch (e: any) {
    return json({ error: e.message || 'Internal error' }, { status: 500 });
  }
}
