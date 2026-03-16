/**
 * CloudPanel — Backend management panel for the bolt.feldev instance.
 *
 * Connects to the *internal* Postgres database that ships with the instance
 * (configured via DATABASE_URL env var on the server).
 *
 * Sections: Overview · Database · Users · Secrets · SQL editor · Logs
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'react-toastify';

// ─── types ────────────────────────────────────────────────────────────────────

type Section = 'overview' | 'database' | 'users' | 'secrets' | 'sql-editor' | 'logs';

interface TableRow {
  table_name: string;
  table_schema: string;
  row_count: number;
}

interface UserRow {
  id: string;
  email: string;
  created_at: string;
  last_sign_in_at: string | null;
  confirmed_at: string | null;
}

interface SecretRow {
  name: string;
}

interface LogRow {
  id: string | number;
  created_at: string;
  level: string;
  source: string | null;
  message: string;
  metadata?: Record<string, unknown>;
}

// ─── helpers ──────────────────────────────────────────────────────────────────

async function internalPost(path: string, body: object) {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return res;
}

function fmt(date: string | null) {
  if (!date) return '—';
  return new Date(date).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' });
}

const Spinner = () => (
  <div className="flex justify-center py-8">
    <div className="i-ph:spinner-gap animate-spin text-2xl" style={{ color: 'var(--accent)' }} />
  </div>
);

const EmptyState = ({ icon = 'i-ph:info', message }: { icon?: string; message: string }) => (
  <div className="flex flex-col items-center py-10 gap-2">
    <div className={`${icon} text-2xl`} style={{ color: 'var(--text-tertiary)' }} />
    <p className="text-xs text-center max-w-xs" style={{ color: 'var(--text-tertiary)' }}>
      {message}
    </p>
  </div>
);

const NavItem = ({
  id,
  label,
  icon,
  active,
  onClick,
}: {
  id: Section;
  label: string;
  icon: string;
  active: boolean;
  onClick: (s: Section) => void;
}) => (
  <button
    onClick={() => onClick(id)}
    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm text-left transition-colors"
    style={{
      background: active ? 'var(--surface-3)' : 'transparent',
      color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
    }}
  >
    <div className={`${icon} text-base shrink-0`} style={{ color: active ? 'var(--accent)' : undefined }} />
    {label}
  </button>
);

// ─── Overview ─────────────────────────────────────────────────────────────────

const Overview = ({ onNavigate }: { onNavigate: (s: Section) => void }) => {
  const [status, setStatus] = useState<'loading' | 'ok' | 'error'>('loading');
  const [dbVersion, setDbVersion] = useState('');

  useEffect(() => {
    internalPost('/api/backend/query', { sql: 'SELECT version() AS v' })
      .then((r) => r.json())
      .then((d) => {
        const version = d.rows?.[0]?.v ?? '';
        setDbVersion(version.split(' ').slice(0, 2).join(' '));
        setStatus('ok');
      })
      .catch(() => setStatus('error'));
  }, []);

  const cards = [
    { label: 'Database', icon: 'i-ph:database', section: 'database' as Section },
    { label: 'Users', icon: 'i-ph:users', section: 'users' as Section },
    { label: 'Secrets', icon: 'i-ph:key', section: 'secrets' as Section },
    { label: 'SQL editor', icon: 'i-ph:terminal-window', section: 'sql-editor' as Section },
  ];

  return (
    <div className="flex flex-col gap-4 p-4">
      <div>
        <h3 className="text-sm font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
          Instance backend
        </h3>
        <div className="flex items-center gap-2">
          <div
            className="w-2 h-2 rounded-full"
            style={{ background: status === 'ok' ? 'var(--success)' : status === 'error' ? 'var(--error)' : 'var(--warning)' }}
          />
          <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            {status === 'loading' ? 'Connecting…' : status === 'ok' ? `Connected · ${dbVersion}` : 'Cannot reach internal database'}
          </span>
        </div>
      </div>

      {status === 'error' && (
        <div
          className="p-3 rounded-lg text-xs"
          style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: 'var(--error)' }}
        >
          Make sure <code className="font-mono">DATABASE_URL</code> is set in your instance environment variables and the database is reachable.
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        {cards.map((c) => (
          <button
            key={c.section}
            onClick={() => onNavigate(c.section)}
            className="flex flex-col gap-2 p-3 rounded-lg text-left transition-colors group"
            style={{ background: 'var(--surface-2)', border: '1px solid var(--border-subtle)' }}
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
          Every app built on this instance can use the internal Postgres database. Ask the AI to scaffold a backend with authentication, tables, and APIs — they'll all connect here automatically.
        </p>
      </div>
    </div>
  );
};

// ─── Database ─────────────────────────────────────────────────────────────────

const DatabaseSection = () => {
  const [tables, setTables] = useState<TableRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [schema, setSchema] = useState('public');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [tableRows, setTableRows] = useState<{ columns: string[]; rows: Record<string, unknown>[] } | null>(null);
  const [loadingRows, setLoadingRows] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await internalPost('/api/backend/tables', { schema });
      if (res.ok) {
        const data = await res.json();
        setTables(data.rows ?? []);
      } else {
        toast.error('Failed to load tables');
      }
    } finally {
      setLoading(false);
    }
  }, [schema]);

  useEffect(() => { load(); }, [load]);

  const loadTableRows = async (tableName: string) => {
    if (expanded === tableName) {
      setExpanded(null);
      setTableRows(null);
      return;
    }
    setExpanded(tableName);
    setTableRows(null);
    setLoadingRows(true);
    try {
      const res = await internalPost('/api/backend/query', {
        sql: `SELECT * FROM "${schema}"."${tableName}" LIMIT 50`,
      });
      if (res.ok) {
        const data = await res.json();
        const rows: Record<string, unknown>[] = data.rows ?? [];
        const columns = rows.length > 0 ? Object.keys(rows[0]) : [];
        setTableRows({ columns, rows });
      }
    } finally {
      setLoadingRows(false);
    }
  };

  return (
    <div className="flex flex-col gap-3 p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
          Tables
        </h3>
        <div className="flex items-center gap-2">
          <select
            value={schema}
            onChange={(e) => setSchema(e.target.value)}
            className="text-xs px-2 py-1 rounded focus:outline-none"
            style={{ background: 'var(--surface-2)', border: '1px solid var(--border-default)', color: 'var(--text-secondary)' }}
          >
            <option value="public">public</option>
            <option value="auth">auth</option>
          </select>
          <button
            onClick={load}
            className="w-6 h-6 flex items-center justify-center rounded"
            style={{ background: 'var(--surface-2)', color: 'var(--text-secondary)' }}
          >
            <div className="i-ph:arrow-clockwise text-sm" />
          </button>
        </div>
      </div>

      {loading ? (
        <Spinner />
      ) : tables.length === 0 ? (
        <EmptyState icon="i-ph:table" message="No tables found. Ask the AI to scaffold your database schema." />
      ) : (
        <div className="flex flex-col gap-1">
          {tables.map((t) => (
            <div key={t.table_name} className="rounded-lg overflow-hidden" style={{ border: '1px solid var(--border-subtle)' }}>
              <button
                onClick={() => loadTableRows(t.table_name)}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-left transition-colors"
                style={{ background: expanded === t.table_name ? 'var(--surface-3)' : 'var(--surface-2)' }}
              >
                <div className="i-ph:table text-sm shrink-0" style={{ color: 'var(--accent)' }} />
                <span className="flex-1 font-medium" style={{ color: 'var(--text-primary)' }}>
                  {t.table_name}
                </span>
                <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                  {t.row_count} rows
                </span>
                <div
                  className={`i-ph:caret-right text-xs transition-transform ${expanded === t.table_name ? 'rotate-90' : ''}`}
                  style={{ color: 'var(--text-tertiary)' }}
                />
              </button>

              {expanded === t.table_name && (
                <div style={{ borderTop: '1px solid var(--border-subtle)' }}>
                  {loadingRows ? (
                    <Spinner />
                  ) : tableRows && tableRows.rows.length > 0 ? (
                    <div className="overflow-x-auto max-h-48">
                      <table className="text-xs w-full" style={{ borderCollapse: 'collapse' }}>
                        <thead>
                          <tr style={{ borderBottom: '1px solid var(--border-subtle)', background: 'var(--surface-1)' }}>
                            {tableRows.columns.map((c) => (
                              <th key={c} className="text-left px-3 py-1.5 font-medium whitespace-nowrap" style={{ color: 'var(--text-secondary)' }}>
                                {c}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {tableRows.rows.map((row, i) => (
                            <tr key={i} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                              {tableRows.columns.map((c) => (
                                <td key={c} className="px-3 py-1.5 font-mono whitespace-nowrap max-w-xs truncate" style={{ color: 'var(--text-primary)' }}>
                                  {row[c] == null ? (
                                    <span style={{ color: 'var(--text-tertiary)' }}>null</span>
                                  ) : (
                                    String(row[c])
                                  )}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-xs px-3 py-3" style={{ color: 'var(--text-tertiary)' }}>
                      No rows
                    </p>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ─── Users ────────────────────────────────────────────────────────────────────

const UsersSection = () => {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await internalPost('/api/backend/users', {});
      if (res.ok) {
        const data = await res.json();
        setUsers(data.users ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="flex flex-col gap-3 p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
          Users ({users.length})
        </h3>
        <button
          onClick={load}
          className="w-6 h-6 flex items-center justify-center rounded"
          style={{ background: 'var(--surface-2)', color: 'var(--text-secondary)' }}
        >
          <div className="i-ph:arrow-clockwise text-sm" />
        </button>
      </div>

      {loading ? (
        <Spinner />
      ) : users.length === 0 ? (
        <EmptyState icon="i-ph:users" message="No users yet. Once your app has authentication, users will appear here." />
      ) : (
        <div className="flex flex-col gap-1">
          {users.map((u) => (
            <div
              key={u.id}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm"
              style={{ background: 'var(--surface-2)', border: '1px solid var(--border-subtle)' }}
            >
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold shrink-0"
                style={{ background: 'var(--accent-muted)', color: 'var(--accent)' }}
              >
                {(u.email?.[0] ?? '?').toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                  {u.email}
                </p>
                <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                  Joined {fmt(u.created_at)}
                  {u.last_sign_in_at && ` · Last login ${fmt(u.last_sign_in_at)}`}
                </p>
              </div>
              {u.confirmed_at && (
                <div className="i-ph:check-circle text-sm" style={{ color: 'var(--success)' }} title="Verified" />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ─── Secrets ──────────────────────────────────────────────────────────────────

const SecretsSection = () => {
  const [secrets, setSecrets] = useState<SecretRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [newKey, setNewKey] = useState('');
  const [newVal, setNewVal] = useState('');
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await internalPost('/api/backend/secrets', {});
      if (res.ok) {
        const data = await res.json();
        setSecrets(data.secrets ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleAdd = async () => {
    if (!newKey.trim() || !newVal.trim()) return;
    setAdding(true);
    try {
      const res = await fetch('/api/backend/secrets', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ secrets: [{ name: newKey.trim(), value: newVal.trim() }] }),
      });
      if (res.ok) {
        toast.success('Secret saved!');
        setNewKey('');
        setNewVal('');
        load();
      } else {
        toast.error('Failed to save secret');
      }
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = async (name: string) => {
    await fetch('/api/backend/secrets', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    load();
  };

  return (
    <div className="flex flex-col gap-3 p-4">
      <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
        Secrets
      </h3>

      {/* Add new */}
      <div
        className="flex flex-col gap-2 p-3 rounded-lg"
        style={{ background: 'var(--surface-2)', border: '1px solid var(--border-subtle)' }}
      >
        <p className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
          Add / update secret
        </p>
        <input
          placeholder="SECRET_NAME"
          value={newKey}
          onChange={(e) => setNewKey(e.target.value.toUpperCase().replace(/\s/g, '_'))}
          className="px-2.5 py-1.5 rounded-lg text-xs font-mono focus:outline-none"
          style={{ background: 'var(--surface-1)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }}
        />
        <input
          placeholder="value"
          type="password"
          value={newVal}
          onChange={(e) => setNewVal(e.target.value)}
          className="px-2.5 py-1.5 rounded-lg text-xs focus:outline-none"
          style={{ background: 'var(--surface-1)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }}
        />
        <button
          onClick={handleAdd}
          disabled={adding || !newKey || !newVal}
          className="py-1.5 rounded-lg text-xs font-medium disabled:opacity-50 transition-colors"
          style={{ background: 'var(--accent)', color: '#fff' }}
        >
          {adding ? 'Saving…' : 'Save secret'}
        </button>
      </div>

      {loading ? (
        <Spinner />
      ) : secrets.length === 0 ? (
        <EmptyState icon="i-ph:key" message="No secrets yet. Add environment variables for your app here." />
      ) : (
        <div className="flex flex-col gap-1">
          {secrets.map((s) => (
            <div
              key={s.name}
              className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm group"
              style={{ background: 'var(--surface-2)', border: '1px solid var(--border-subtle)' }}
            >
              <div className="i-ph:key text-sm shrink-0" style={{ color: 'var(--accent)' }} />
              <span className="flex-1 font-mono text-xs" style={{ color: 'var(--text-primary)' }}>
                {s.name}
              </span>
              <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                ••••••••
              </span>
              <button
                onClick={() => handleDelete(s.name)}
                className="ml-2 w-5 h-5 flex items-center justify-center rounded opacity-0 group-hover:opacity-100 transition-opacity"
                style={{ color: 'var(--error)' }}
                title="Delete secret"
              >
                <div className="i-ph:trash text-xs" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ─── SQL Editor ───────────────────────────────────────────────────────────────

const SqlEditor = () => {
  const [sql, setSql] = useState('-- Write SQL here\n-- Ctrl+Enter to run\n\nSELECT version();\n');
  const [result, setResult] = useState<{ columns: string[]; rows: Record<string, unknown>[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const run = useCallback(async () => {
    if (!sql.trim()) return;
    setRunning(true);
    setError(null);
    setResult(null);
    try {
      const res = await internalPost('/api/backend/query', { sql });
      const data = await res.json();
      if (!res.ok || data.error) {
        setError(data.error || 'Query failed');
      } else {
        const rows: Record<string, unknown>[] = data.rows ?? [];
        setResult({ columns: rows.length > 0 ? Object.keys(rows[0]) : [], rows });
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setRunning(false);
    }
  }, [sql]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      run();
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 flex flex-col gap-2" style={{ flex: '1 1 0', minHeight: 0 }}>
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
            SQL editor
          </h3>
          <div className="flex gap-2">
            <button
              onClick={() => { setResult(null); setError(null); setSql(''); }}
              className="text-xs px-2.5 py-1 rounded-lg"
              style={{ background: 'var(--surface-2)', color: 'var(--text-secondary)', border: '1px solid var(--border-default)' }}
            >
              Clear
            </button>
            <button
              onClick={run}
              disabled={running}
              className="text-xs px-3 py-1 rounded-lg font-medium flex items-center gap-1.5 disabled:opacity-50"
              style={{ background: 'var(--accent)', color: '#fff' }}
            >
              <div className="i-ph:play-fill text-xs" />
              {running ? 'Running…' : 'Run'}
            </button>
          </div>
        </div>

        <textarea
          ref={textareaRef}
          value={sql}
          onChange={(e) => setSql(e.target.value)}
          onKeyDown={handleKeyDown}
          spellCheck={false}
          placeholder="-- Write SQL here..."
          className="flex-1 p-3 rounded-lg text-xs font-mono resize-none focus:outline-none"
          style={{
            background: 'var(--surface-2)',
            border: '1px solid var(--border-default)',
            color: 'var(--text-primary)',
            minHeight: '160px',
          }}
        />
      </div>

      {/* Results area */}
      <div
        className="flex flex-col gap-2 px-4 py-3"
        style={{ borderTop: '1px solid var(--border-subtle)', background: 'var(--surface-1)' }}
      >
        <p className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
          Results
        </p>

        {error && (
          <div
            className="text-xs font-mono p-2.5 rounded-lg whitespace-pre-wrap"
            style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: 'var(--error)' }}
          >
            {error}
          </div>
        )}

        {result && result.rows.length === 0 && (
          <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
            ✓ Query executed — 0 rows returned
          </p>
        )}

        {result && result.rows.length > 0 && (
          <div className="overflow-auto max-h-44 rounded-lg" style={{ border: '1px solid var(--border-subtle)' }}>
            <table className="text-xs w-full" style={{ borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--surface-2)', borderBottom: '1px solid var(--border-subtle)' }}>
                  {result.columns.map((c) => (
                    <th key={c} className="text-left px-3 py-1.5 font-medium whitespace-nowrap" style={{ color: 'var(--text-secondary)' }}>
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {result.rows.map((row, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                    {result.columns.map((c) => (
                      <td key={c} className="px-3 py-1.5 font-mono whitespace-nowrap" style={{ color: 'var(--text-primary)' }}>
                        {row[c] == null ? (
                          <span style={{ color: 'var(--text-tertiary)' }}>null</span>
                        ) : (
                          String(row[c])
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!result && !error && !running && (
          <p className="text-xs py-3 text-center" style={{ color: 'var(--text-tertiary)' }}>
            Press Run or Ctrl+Enter to execute
          </p>
        )}

        {running && <Spinner />}
      </div>
    </div>
  );
};

// ─── Logs ─────────────────────────────────────────────────────────────────────

const LogsSection = () => {
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [level, setLevel] = useState('');
  const [source, setSource] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await internalPost('/api/backend/logs', { level: level || undefined, source: source || undefined });
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, [level, source]);

  useEffect(() => { load(); }, [load]);

  const levelColor = (l: string) => {
    if (l === 'error') return 'var(--error)';
    if (l === 'warn') return 'var(--warning)';
    if (l === 'info') return 'var(--accent)';
    return 'var(--text-tertiary)';
  };

  return (
    <div className="flex flex-col gap-3 p-4">
      <div className="flex items-center gap-2 flex-wrap">
        <h3 className="text-sm font-semibold flex-1" style={{ color: 'var(--text-primary)' }}>
          Logs
        </h3>
        <select
          value={level}
          onChange={(e) => setLevel(e.target.value)}
          className="text-xs px-2 py-1 rounded focus:outline-none"
          style={{ background: 'var(--surface-2)', border: '1px solid var(--border-default)', color: 'var(--text-secondary)' }}
        >
          <option value="">All levels</option>
          <option value="info">info</option>
          <option value="warn">warn</option>
          <option value="error">error</option>
          <option value="debug">debug</option>
        </select>
        <button
          onClick={load}
          className="w-6 h-6 flex items-center justify-center rounded"
          style={{ background: 'var(--surface-2)', color: 'var(--text-secondary)' }}
        >
          <div className="i-ph:arrow-clockwise text-sm" />
        </button>
      </div>

      {loading ? (
        <Spinner />
      ) : logs.length === 0 ? (
        <EmptyState
          icon="i-ph:list-bullets"
          message="No logs yet. Your app can write logs to the instance_logs table to see them here."
        />
      ) : (
        <div className="flex flex-col gap-1 max-h-96 overflow-y-auto">
          {logs.map((log) => (
            <div
              key={log.id}
              className="flex flex-col gap-0.5 px-3 py-2 rounded-lg text-xs"
              style={{ background: 'var(--surface-2)', border: '1px solid var(--border-subtle)' }}
            >
              <div className="flex items-center gap-2">
                <span
                  className="font-mono px-1 rounded text-xs"
                  style={{ background: 'var(--surface-3)', color: levelColor(log.level) }}
                >
                  {log.level}
                </span>
                <span style={{ color: 'var(--text-tertiary)' }}>{fmt(log.created_at)}</span>
                {log.source && (
                  <span style={{ color: 'var(--text-tertiary)' }}>· {log.source}</span>
                )}
              </div>
              <span className="font-mono break-all" style={{ color: 'var(--text-primary)' }}>
                {log.message}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ─── Main Cloud Panel ─────────────────────────────────────────────────────────

export const CloudPanel = () => {
  const [section, setSection] = useState<Section>('overview');

  const nav: { id: Section; label: string; icon: string }[] = [
    { id: 'overview', label: 'Overview', icon: 'i-ph:squares-four' },
    { id: 'database', label: 'Database', icon: 'i-ph:database' },
    { id: 'users', label: 'Users', icon: 'i-ph:users' },
    { id: 'secrets', label: 'Secrets', icon: 'i-ph:key' },
    { id: 'sql-editor', label: 'SQL editor', icon: 'i-ph:terminal-window' },
    { id: 'logs', label: 'Logs', icon: 'i-ph:list-bullets' },
  ];

  return (
    <div className="flex h-full" style={{ background: 'var(--surface-1)' }}>
      {/* Left nav */}
      <nav
        className="w-44 shrink-0 flex flex-col gap-0.5 p-2 overflow-y-auto"
        style={{ borderRight: '1px solid var(--border-subtle)' }}
      >
        <p className="text-xs font-semibold px-3 py-1.5 mb-0.5" style={{ color: 'var(--text-tertiary)' }}>
          BACKEND
        </p>
        {nav.map((item) => (
          <NavItem key={item.id} {...item} active={section === item.id} onClick={setSection} />
        ))}

        <div className="mt-auto pt-2" style={{ borderTop: '1px solid var(--border-subtle)' }}>
          <a
            href="/admin"
            className="flex items-center gap-2 px-3 py-2 rounded-md text-xs transition-colors"
            style={{ color: 'var(--text-tertiary)' }}
          >
            <div className="i-ph:gear text-sm" />
            Instance settings
          </a>
        </div>
      </nav>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {section === 'overview' && <Overview onNavigate={setSection} />}
        {section === 'database' && <DatabaseSection />}
        {section === 'users' && <UsersSection />}
        {section === 'secrets' && <SecretsSection />}
        {section === 'sql-editor' && <SqlEditor />}
        {section === 'logs' && <LogsSection />}
      </div>
    </div>
  );
};
