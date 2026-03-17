import { useState, useEffect, useCallback } from 'react';
import { type UserRow, Spinner, EmptyState, internalPost, fmt } from './shared';

interface Props {
  schema: string;
  chatId: string;
}

export const UsersSection = ({ schema }: Props) => {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await internalPost('/api/backend/users', { schema });
      if (res.ok) setUsers((await res.json()).users ?? []);
    } finally { setLoading(false); }
  }, [schema]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="flex flex-col gap-3 p-6">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Users ({users.length})</h3>
        <button onClick={load} className="w-6 h-6 flex items-center justify-center rounded" style={{ background: 'var(--surface-2)', color: 'var(--text-secondary)' }}>
          <div className="i-ph:arrow-clockwise text-sm" />
        </button>
      </div>
      {loading ? <Spinner /> : users.length === 0 ? (
        <EmptyState icon="i-ph:users" message="No users yet. Once your app has auth, users appear here." />
      ) : (
        <div className="flex flex-col gap-1">
          {users.map(u => (
            <div key={u.id} className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm" style={{ background: 'var(--surface-2)', border: '1px solid var(--border-subtle)' }}>
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold shrink-0" style={{ background: 'var(--accent-muted)', color: 'var(--accent)' }}>
                {(u.email?.[0] ?? '?').toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate" style={{ color: 'var(--text-primary)' }}>{u.email}</p>
                <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Joined {fmt(u.created_at)}</p>
              </div>
              {u.confirmed_at && <div className="i-ph:check-circle text-sm" style={{ color: 'var(--success)' }} />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
