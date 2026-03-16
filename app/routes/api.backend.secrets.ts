/**
 * Internal backend API — manage secrets scoped to an app's schema.
 * POST  { schema }                       → list secret names
 * PUT   { schema, secrets: [{name,value}] } → upsert
 * DELETE { schema, name }                → delete
 *
 * Secrets are stored in `<schema>.secrets` (provisioned by /api/backend/provision).
 */
import { json, type ActionFunctionArgs } from '@remix-run/cloudflare';

async function dbProxy(origin: string, sql: string, params?: unknown[]) {
  return fetch(`${origin}/api/db-proxy`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-internal-secret': 'bolt-internal' },
    body: JSON.stringify({ sql, params }),
  });
}

export async function action({ request }: ActionFunctionArgs) {
  const origin = new URL(request.url).origin;

  if (request.method === 'POST') {
    const { schema = 'public' } = (await request.json()) as { schema?: string };
    const res = await dbProxy(origin, `SELECT name FROM "${schema}".secrets ORDER BY name`);
    if (!res.ok) return json({ secrets: [] });
    const data = await res.json();
    return json({ secrets: (data.rows ?? []).map((r: any) => ({ name: r.name })) });
  }

  if (request.method === 'PUT') {
    const { schema = 'public', secrets } = (await request.json()) as {
      schema?: string;
      secrets: { name: string; value: string }[];
    };
    for (const s of secrets) {
      await dbProxy(
        origin,
        `INSERT INTO "${schema}".secrets (name, value) VALUES ($1, $2) ON CONFLICT (name) DO UPDATE SET value = EXCLUDED.value`,
        [s.name, s.value],
      );
    }
    return json({ ok: true });
  }

  if (request.method === 'DELETE') {
    const { schema = 'public', name } = (await request.json()) as { schema?: string; name: string };
    await dbProxy(origin, `DELETE FROM "${schema}".secrets WHERE name = $1`, [name]);
    return json({ ok: true });
  }

  return json({ error: 'Method not allowed' }, { status: 405 });
}
