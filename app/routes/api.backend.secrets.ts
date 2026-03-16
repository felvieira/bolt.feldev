/**
 * Internal backend API — manage instance secrets / environment variables.
 * GET: list secret names (values are never returned)
 * PUT: upsert a secret
 * DELETE: remove a secret
 *
 * Secrets are stored in a `instance_secrets` table:
 *   CREATE TABLE IF NOT EXISTS instance_secrets (name TEXT PRIMARY KEY, value TEXT NOT NULL);
 */
import { json, type ActionFunctionArgs } from '@remix-run/cloudflare';

async function dbProxy(origin: string, sql: string, params?: unknown[]) {
  const res = await fetch(`${origin}/api/db-proxy`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-internal-secret': 'bolt-internal' },
    body: JSON.stringify({ sql, params }),
  });
  return res;
}

export async function action({ request }: ActionFunctionArgs) {
  const origin = new URL(request.url).origin;

  if (request.method === 'POST') {
    // List secrets (names only)
    const res = await dbProxy(origin, `SELECT name FROM instance_secrets ORDER BY name`);
    if (!res.ok) return json({ secrets: [] });
    const data = await res.json();
    return json({ secrets: (data.rows ?? []).map((r: any) => ({ name: r.name })) });
  }

  if (request.method === 'PUT') {
    const { secrets } = (await request.json()) as { secrets: { name: string; value: string }[] };

    for (const s of secrets) {
      await dbProxy(
        origin,
        `INSERT INTO instance_secrets (name, value)
         VALUES ($1, $2)
         ON CONFLICT (name) DO UPDATE SET value = EXCLUDED.value`,
        [s.name, s.value],
      );
    }
    return json({ ok: true });
  }

  if (request.method === 'DELETE') {
    const { name } = (await request.json()) as { name: string };
    await dbProxy(origin, `DELETE FROM instance_secrets WHERE name = $1`, [name]);
    return json({ ok: true });
  }

  return json({ error: 'Method not allowed' }, { status: 405 });
}
