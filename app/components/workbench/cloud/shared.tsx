/**
 * Shared UI primitives and helpers for CloudPanel sub-components.
 */

// ─── types ────────────────────────────────────────────────────────────────────

export type Section = 'overview' | 'database' | 'users' | 'secrets' | 'sql-editor' | 'logs' | 'deploy';

export interface TableRow {
  table_name: string;
  table_schema: string;
  row_count: number;
}

export interface UserRow {
  id: string;
  email: string;
  created_at: string;
  last_sign_in_at: string | null;
  confirmed_at: string | null;
}

export interface SecretRow {
  name: string;
}

export interface LogRow {
  id: string | number;
  created_at: string;
  level: string;
  source: string | null;
  message: string;
}

// ─── helpers ──────────────────────────────────────────────────────────────────

export function fmt(date: string | null) {
  if (!date) return '—';
  return new Date(date).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' });
}

/** POST to an internal API route */
export async function internalPost(path: string, body: object) {
  return fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

// ─── Shared UI ────────────────────────────────────────────────────────────────

export const Spinner = () => (
  <div className="flex justify-center py-8">
    <div className="i-ph:spinner-gap animate-spin text-2xl" style={{ color: 'var(--accent)' }} />
  </div>
);

export const EmptyState = ({ icon = 'i-ph:info', message }: { icon?: string; message: string }) => (
  <div className="flex flex-col items-center py-10 gap-2">
    <div className={`${icon} text-2xl`} style={{ color: 'var(--text-tertiary)' }} />
    <p className="text-xs text-center max-w-xs" style={{ color: 'var(--text-tertiary)' }}>
      {message}
    </p>
  </div>
);
