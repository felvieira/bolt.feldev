/**
 * Internal backend API — execute raw SQL against the instance's Postgres.
 * Accepts { schema?, sql, params? } in the POST body.
 * If `schema` is provided, sets the search_path before executing.
 */
import { json, type ActionFunctionArgs } from '@remix-run/cloudflare';

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed' }, { status: 405 });
  }

  const origin = new URL(request.url).origin;

  try {
    const { sql, schema, params } = (await request.json()) as {
      sql: string;
      schema?: string;
      params?: unknown[];
    };

    if (!sql?.trim()) {
      return json({ error: 'No SQL provided' }, { status: 400 });
    }

    // Prepend search_path if schema is given
    const fullSql = schema ? `SET search_path TO "${schema}",public; ${sql}` : sql;

    const res = await fetch(`${origin}/api/db-proxy`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-internal-secret': 'bolt-internal' },
      body: JSON.stringify({ sql: fullSql, params }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Query failed' }));
      return json(err, { status: res.status });
    }

    return json(await res.json());
  } catch (e: any) {
    return json({ error: e.message || 'Internal error' }, { status: 500 });
  }
}
