import { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-toastify';
import { type Section, Spinner, internalPost } from './shared';

interface Props {
  schema: string;
  chatId: string;
  onNavigate: (s: Section) => void;
}

export const OverviewSection = ({ schema, onNavigate }: Props) => {
  const [status, setStatus] = useState<'loading' | 'ok' | 'error'>('loading');
  const [provisioned, setProvisioned] = useState(false);

  const provision = useCallback(async () => {
    setStatus('loading');
    try {
      const res = await internalPost('/api/backend/provision', { schema });
      if (res.ok) {
        setProvisioned(true);
        setStatus('ok');
        toast.success(`Schema "${schema}" ready!`);
      } else {
        setStatus('error');
      }
    } catch {
      setStatus('error');
    }
  }, [schema]);

  useEffect(() => {
    internalPost('/api/backend/query', {
      schema,
      sql: `SELECT schema_name FROM information_schema.schemata WHERE schema_name = '${schema}'`,
    })
      .then((r) => r.json())
      .then((d) => {
        const exists = (d.rows ?? []).length > 0;
        setProvisioned(exists);
        setStatus('ok');
      })
      .catch(() => setStatus('error'));
  }, [schema]);

  const cards = [
    { label: 'Database', icon: 'i-ph:database', section: 'database' as Section },
    { label: 'Users', icon: 'i-ph:users', section: 'users' as Section },
    { label: 'Secrets', icon: 'i-ph:key', section: 'secrets' as Section },
    { label: 'SQL editor', icon: 'i-ph:terminal-window', section: 'sql-editor' as Section },
  ];

  return (
    <div className="flex flex-col gap-4 p-6">
      <div>
        <h3 className="text-sm font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
          Internal database
        </h3>
        <div className="flex items-center gap-2">
          <div
            className="w-2 h-2 rounded-full"
            style={{
              background:
                status === 'ok' ? 'var(--success)' : status === 'error' ? 'var(--error)' : 'var(--warning)',
            }}
          />
          <code className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            schema: {schema}
          </code>
          {status === 'ok' && !provisioned && (
            <span
              className="text-xs px-1.5 py-0.5 rounded"
              style={{ background: 'var(--warning-muted)', color: 'var(--warning)' }}
            >
              not provisioned
            </span>
          )}
          {provisioned && (
            <span
              className="text-xs px-1.5 py-0.5 rounded"
              style={{ background: 'var(--accent-muted)', color: 'var(--accent)' }}
            >
              ready
            </span>
          )}
        </div>
      </div>

      {status === 'error' && (
        <div
          className="p-3 rounded-lg text-xs"
          style={{ background: 'var(--error-muted)', border: '1px solid var(--error-border)', color: 'var(--error)' }}
        >
          Cannot reach internal database. Make sure <code className="font-mono">DATABASE_URL</code> is configured.
        </div>
      )}

      {status === 'ok' && !provisioned && (
        <button
          onClick={provision}
          className="py-2 rounded-lg text-sm font-medium"
          style={{ background: 'var(--accent)', color: '#fff' }}
        >
          Provision database for this app
        </button>
      )}

      <div className="grid grid-cols-2 gap-2">
        {cards.map((c) => (
          <button
            key={c.section}
            onClick={() => onNavigate(c.section)}
            disabled={!provisioned}
            className="flex flex-col gap-2 p-3 rounded-lg text-left transition-all duration-150 disabled:opacity-40 hover:scale-[1.01]"
            style={{
              background: 'var(--surface-2)',
              border: '1px solid var(--border-subtle)',
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            <div className={`${c.icon} text-xl`} style={{ color: 'var(--accent)' }} />
            <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
              {c.label}
            </span>
          </button>
        ))}
      </div>

      <div
        className="p-3 rounded-lg text-xs"
        style={{ background: 'var(--surface-2)', border: '1px solid var(--border-subtle)' }}
      >
        <p className="font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
          How it works
        </p>
        <p style={{ color: 'var(--text-tertiary)' }}>
          Each app gets its own isolated Postgres schema (<code className="font-mono">{schema}</code>). Tables, users,
          and secrets are scoped to this app only. The AI can scaffold the full backend here.
        </p>
      </div>
    </div>
  );
};
