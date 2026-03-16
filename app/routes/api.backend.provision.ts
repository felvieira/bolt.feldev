/**
 * Provision an isolated Postgres schema for an app.
 *
 * Called once when a new app activates the Internal backend.
 * Creates: the schema itself + core tables (users, secrets, logs).
 */
import { json, type ActionFunctionArgs } from '@remix-run/cloudflare';

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed' }, { status: 405 });
  }

  const { schema } = (await request.json()) as { schema: string };

  if (!schema || !/^[a-z][a-z0-9_]{0,62}$/.test(schema)) {
    return json({ error: 'Invalid schema name' }, { status: 400 });
  }

  const origin = new URL(request.url).origin;

  const setupSql = `
    -- Create isolated schema for this app
    CREATE SCHEMA IF NOT EXISTS "${schema}";

    -- Auth users table
    CREATE TABLE IF NOT EXISTS "${schema}".users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT,
      email_confirmed_at TIMESTAMPTZ,
      last_sign_in_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now(),
      metadata JSONB DEFAULT '{}'
    );

    -- App secrets / env vars table
    CREATE TABLE IF NOT EXISTS "${schema}".secrets (
      name TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT now()
    );

    -- App logs table
    CREATE TABLE IF NOT EXISTS "${schema}".logs (
      id BIGSERIAL PRIMARY KEY,
      created_at TIMESTAMPTZ DEFAULT now(),
      level TEXT DEFAULT 'info',
      source TEXT,
      message TEXT NOT NULL,
      metadata JSONB
    );
  `;

  try {
    const res = await fetch(`${origin}/api/db-proxy`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-internal-secret': 'bolt-internal' },
      body: JSON.stringify({ sql: setupSql }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed' }));
      return json(err, { status: res.status });
    }

    return json({ ok: true, schema });
  } catch (e: any) {
    return json({ error: e.message }, { status: 500 });
  }
}
