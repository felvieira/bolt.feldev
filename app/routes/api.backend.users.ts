/**
 * Internal backend API — list users from the instance's auth table.
 * Expects a table named `users` or `auth_users` in the public schema.
 */
import { json, type ActionFunctionArgs } from '@remix-run/cloudflare';

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed' }, { status: 405 });
  }

  try {
    // Try common user table conventions
    const res = await fetch(`${new URL(request.url).origin}/api/db-proxy`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-internal-secret': 'bolt-internal' },
      body: JSON.stringify({
        sql: `
          SELECT id, email,
            created_at,
            last_sign_in_at,
            email_confirmed_at AS confirmed_at
          FROM auth.users
          ORDER BY created_at DESC
          LIMIT 100
        `,
      }),
    });

    if (!res.ok) {
      // Fallback: try public.users
      const res2 = await fetch(`${new URL(request.url).origin}/api/db-proxy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-internal-secret': 'bolt-internal' },
        body: JSON.stringify({
          sql: `
            SELECT id, email, created_at, NULL AS last_sign_in_at, NULL AS confirmed_at
            FROM public.users
            ORDER BY created_at DESC
            LIMIT 100
          `,
        }),
      });

      if (res2.ok) {
        const data = await res2.json();
        return json({ users: data.rows ?? [] });
      }

      return json({ users: [] });
    }

    const data = await res.json();
    return json({ users: data.rows ?? [] });
  } catch (e: any) {
    return json({ error: e.message, users: [] }, { status: 500 });
  }
}
