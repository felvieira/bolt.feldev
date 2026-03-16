/**
 * Internal database proxy — executes SQL against the instance Postgres.
 *
 * Only reachable from internal backend routes via `x-internal-secret` header
 * or from the auth-service. NOT exposed publicly.
 *
 * Uses DATABASE_URL env var (set in docker-compose for the app service).
 * Falls back to AUTH_SERVICE_URL + /db/query for proxied execution.
 */
import { json, type ActionFunctionArgs } from '@remix-run/cloudflare';

const INTERNAL_SECRET = 'bolt-internal';

export async function action({ request, context }: ActionFunctionArgs) {
  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed' }, { status: 405 });
  }

  // Verify internal caller
  const secret = request.headers.get('x-internal-secret');

  if (secret !== INTERNAL_SECRET) {
    return json({ error: 'Forbidden' }, { status: 403 });
  }

  const { sql, params } = (await request.json()) as { sql: string; params?: unknown[] };

  if (!sql?.trim()) {
    return json({ error: 'No SQL provided' }, { status: 400 });
  }

  // Strategy 1: Direct Postgres via env var DATABASE_URL
  // In Cloudflare Workers / Remix we can't use node-postgres directly,
  // so we proxy through the auth-service which HAS direct Postgres access.
  const authServiceUrl =
    (context?.cloudflare?.env as any)?.AUTH_SERVICE_URL ||
    (typeof process !== 'undefined' ? process.env?.AUTH_SERVICE_URL : null) ||
    'http://auth-service:3200';

  try {
    const res = await fetch(`${authServiceUrl}/db/query`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-internal-secret': INTERNAL_SECRET,
      },
      body: JSON.stringify({ sql, params }),
    });

    if (!res.ok) {
      const errText = await res.text();
      let errData;

      try {
        errData = JSON.parse(errText);
      } catch {
        errData = { error: errText };
      }

      return json(errData, { status: res.status });
    }

    const data = await res.json();
    return json(data);
  } catch (e: any) {
    console.error('[db-proxy] Failed to reach auth-service:', e.message);
    return json(
      { error: `Database unreachable: ${e.message}. Ensure AUTH_SERVICE_URL is configured.` },
      { status: 503 },
    );
  }
}
