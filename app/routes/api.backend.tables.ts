/**
 * Internal backend API — list tables in the instance's Postgres.
 */
import { json, type ActionFunctionArgs } from '@remix-run/cloudflare';

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed' }, { status: 405 });
  }

  try {
    const { schema = 'public' } = (await request.json()) as { schema?: string };

    const res = await fetch(`${new URL(request.url).origin}/api/db-proxy`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-internal-secret': 'bolt-internal' },
      body: JSON.stringify({
        sql: `
          SELECT
            t.table_name,
            t.table_schema,
            COALESCE(s.n_live_tup, 0)::int AS row_count
          FROM information_schema.tables t
          LEFT JOIN pg_stat_user_tables s ON s.relname = t.table_name
          WHERE t.table_schema = $1
            AND t.table_type = 'BASE TABLE'
          ORDER BY t.table_name
        `,
        params: [schema],
      }),
    });

    if (!res.ok) {
      return json(await res.json().catch(() => ({ error: 'Failed' })), { status: res.status });
    }

    return json(await res.json());
  } catch (e: any) {
    return json({ error: e.message }, { status: 500 });
  }
}
