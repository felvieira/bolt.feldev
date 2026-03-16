/**
 * Internal backend API — fetch recent logs from instance_logs table.
 * Apps can insert logs via a simple SDK or the AI can scaffold it.
 *
 * Table schema (auto-created if not exists):
 *   CREATE TABLE IF NOT EXISTS instance_logs (
 *     id BIGSERIAL PRIMARY KEY,
 *     created_at TIMESTAMPTZ DEFAULT now(),
 *     level TEXT DEFAULT 'info',
 *     source TEXT,
 *     message TEXT,
 *     metadata JSONB
 *   );
 */
import { json, type ActionFunctionArgs } from '@remix-run/cloudflare';

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed' }, { status: 405 });
  }

  const origin = new URL(request.url).origin;
  const { level, source, limit = 100 } = (await request.json()) as {
    level?: string;
    source?: string;
    limit?: number;
  };

  // Build filter
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (level) {
    params.push(level);
    conditions.push(`level = $${params.length}`);
  }

  if (source) {
    params.push(source);
    conditions.push(`source = $${params.length}`);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  params.push(Math.min(limit, 500));

  const sql = `
    SELECT id, created_at, level, source, message, metadata
    FROM instance_logs
    ${where}
    ORDER BY created_at DESC
    LIMIT $${params.length}
  `;

  try {
    const res = await fetch(`${origin}/api/db-proxy`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-internal-secret': 'bolt-internal' },
      body: JSON.stringify({ sql, params }),
    });

    if (!res.ok) {
      return json({ logs: [] });
    }

    const data = await res.json();
    return json({ logs: data.rows ?? [] });
  } catch {
    return json({ logs: [] });
  }
}
