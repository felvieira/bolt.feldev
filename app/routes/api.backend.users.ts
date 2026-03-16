/**
 * Internal backend API — list users from app's schema.
 * Accepts { schema } in the POST body.
 * Looks for a `users` table in the given schema.
 */
import { json, type ActionFunctionArgs } from '@remix-run/cloudflare';

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed' }, { status: 405 });
  }

  const origin = new URL(request.url).origin;
  const { schema = 'public' } = (await request.json()) as { schema?: string };

  const trySql = async (sql: string) => {
    const res = await fetch(`${origin}/api/db-proxy`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-internal-secret': 'bolt-internal' },
      body: JSON.stringify({ sql }),
    });
    return res;
  };

  // Try the app schema's users table first
  try {
    const res = await trySql(`
      SELECT id, email, created_at, last_sign_in_at, email_confirmed_at AS confirmed_at
      FROM "${schema}".users
      ORDER BY created_at DESC
      LIMIT 100
    `);

    if (res.ok) {
      const data = await res.json();
      return json({ users: data.rows ?? [] });
    }
  } catch { /* fall through */ }

  // Fallback: auth.users (Supabase-compatible schema)
  try {
    const res = await trySql(`
      SELECT id, email, created_at, last_sign_in_at, email_confirmed_at AS confirmed_at
      FROM auth.users
      ORDER BY created_at DESC
      LIMIT 100
    `);
    if (res.ok) {
      const data = await res.json();
      return json({ users: data.rows ?? [] });
    }
  } catch { /* fall through */ }

  return json({ users: [] });
}
