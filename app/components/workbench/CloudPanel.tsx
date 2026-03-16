/**
 * CloudPanel — Backend management panel for bolt.feldev.
 *
 * Each app can use:
 *   - Internal Postgres (isolated schema per app, provisioned on demand)
 *   - External Supabase project
 *
 * The provider toggle at the top switches between modes.
 * All queries are scoped to the app's schema when using internal mode.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { useStore } from '@nanostores/react';
import { toast } from 'react-toastify';
import {
  activeAppDb,
  updateActiveAppDb,
  setActiveApp,
  type DbProvider,
} from '~/lib/stores/appDatabase';
import {
  supabaseConnection,
  updateSupabaseConnection,
  fetchSupabaseStats,
  fetchProjectApiKeys,
} from '~/lib/stores/supabase';
import { chatId as chatIdStore } from '~/lib/persistence/useChatHistory';

// ─── types ────────────────────────────────────────────────────────────────────

type Section = 'overview' | 'database' | 'users' | 'secrets' | 'sql-editor' | 'logs' | 'deploy';

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

interface SecretRow { name: string }

interface LogRow {
  id: string | number;
  created_at: string;
  level: string;
  source: string | null;
  message: string;
}

// ─── helpers ──────────────────────────────────────────────────────────────────

function fmt(date: string | null) {
  if (!date) return '—';
  return new Date(date).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' });
}

/** POST to an internal API route */
async function internalPost(path: string, body: object) {
  return fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

// ─── Shared UI ────────────────────────────────────────────────────────────────

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
  id, label, icon, active, onClick,
}: {
  id: Section; label: string; icon: string; active: boolean; onClick: (s: Section) => void;
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

// ─── Provider toggle ──────────────────────────────────────────────────────────

const ProviderToggle = ({ provider, onChange }: { provider: DbProvider; onChange: (p: DbProvider) => void }) => (
  <div
    className="flex p-0.5 rounded-lg"
    style={{ background: 'var(--surface-2)', border: '1px solid var(--border-subtle)' }}
  >
    {(['internal', 'supabase'] as DbProvider[]).map((p) => (
      <button
        key={p}
        onClick={() => onChange(p)}
        className="flex-1 px-3 py-1 text-xs font-medium rounded-md transition-colors capitalize"
        style={{
          background: provider === p ? 'var(--surface-3)' : 'transparent',
          color: provider === p ? 'var(--text-primary)' : 'var(--text-tertiary)',
        }}
      >
        {p === 'internal' ? '🏠 Internal' : '⚡ Supabase'}
      </button>
    ))}
  </div>
);

// ─── Internal: Overview ───────────────────────────────────────────────────────

const InternalOverview = ({ schema, onNavigate }: { schema: string; onNavigate: (s: Section) => void }) => {
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
    // Check if schema exists
    internalPost('/api/backend/query', { schema, sql: `SELECT schema_name FROM information_schema.schemata WHERE schema_name = '${schema}'` })
      .then(r => r.json())
      .then(d => {
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
    <div className="flex flex-col gap-4 p-4">
      <div>
        <h3 className="text-sm font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
          Internal database
        </h3>
        <div className="flex items-center gap-2">
          <div
            className="w-2 h-2 rounded-full"
            style={{ background: status === 'ok' ? 'var(--success)' : status === 'error' ? 'var(--error)' : 'var(--warning)' }}
          />
          <code className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            schema: {schema}
          </code>
          {status === 'ok' && !provisioned && (
            <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'rgba(245,158,11,0.1)', color: 'var(--warning)' }}>
              not provisioned
            </span>
          )}
          {provisioned && (
            <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'var(--accent-muted)', color: 'var(--accent)' }}>
              ready
            </span>
          )}
        </div>
      </div>

      {status === 'error' && (
        <div className="p-3 rounded-lg text-xs" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: 'var(--error)' }}>
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
            className="flex flex-col gap-2 p-3 rounded-lg text-left transition-colors disabled:opacity-40"
            style={{ background: 'var(--surface-2)', border: '1px solid var(--border-subtle)' }}
          >
            <div className={`${c.icon} text-xl`} style={{ color: 'var(--accent)' }} />
            <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
              {c.label}
            </span>
          </button>
        ))}
      </div>

      <div className="p-3 rounded-lg text-xs" style={{ background: 'var(--surface-2)', border: '1px solid var(--border-subtle)' }}>
        <p className="font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>How it works</p>
        <p style={{ color: 'var(--text-tertiary)' }}>
          Each app gets its own isolated Postgres schema (<code className="font-mono">{schema}</code>). Tables, users, and secrets are scoped to this app only. The AI can scaffold the full backend here.
        </p>
      </div>
    </div>
  );
};

// ─── Internal: Database ───────────────────────────────────────────────────────

const InternalDatabase = ({ schema }: { schema: string }) => {
  const [tables, setTables] = useState<TableRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [tableRows, setTableRows] = useState<{ columns: string[]; rows: Record<string, unknown>[] } | null>(null);
  const [loadingRows, setLoadingRows] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await internalPost('/api/backend/tables', { schema });
      if (res.ok) setTables((await res.json()).rows ?? []);
    } finally {
      setLoading(false);
    }
  }, [schema]);

  useEffect(() => { load(); }, [load]);

  const loadTableRows = async (table: string) => {
    if (expanded === table) { setExpanded(null); setTableRows(null); return; }
    setExpanded(table);
    setTableRows(null);
    setLoadingRows(true);
    try {
      const res = await internalPost('/api/backend/query', { schema, sql: `SELECT * FROM "${schema}"."${table}" LIMIT 50` });
      if (res.ok) {
        const rows = (await res.json()).rows ?? [];
        setTableRows({ columns: rows.length > 0 ? Object.keys(rows[0]) : [], rows });
      }
    } finally { setLoadingRows(false); }
  };

  return (
    <div className="flex flex-col gap-3 p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Tables</h3>
        <button onClick={load} className="w-6 h-6 flex items-center justify-center rounded" style={{ background: 'var(--surface-2)', color: 'var(--text-secondary)' }}>
          <div className="i-ph:arrow-clockwise text-sm" />
        </button>
      </div>
      {loading ? <Spinner /> : tables.length === 0 ? (
        <EmptyState icon="i-ph:table" message={`No tables in schema "${schema}" yet. Ask the AI to scaffold your schema.`} />
      ) : (
        <div className="flex flex-col gap-1">
          {tables.map((t) => (
            <div key={t.table_name} className="rounded-lg overflow-hidden" style={{ border: '1px solid var(--border-subtle)' }}>
              <button
                onClick={() => loadTableRows(t.table_name)}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-left"
                style={{ background: expanded === t.table_name ? 'var(--surface-3)' : 'var(--surface-2)' }}
              >
                <div className="i-ph:table text-sm shrink-0" style={{ color: 'var(--accent)' }} />
                <span className="flex-1 font-medium" style={{ color: 'var(--text-primary)' }}>{t.table_name}</span>
                <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{t.row_count} rows</span>
                <div className={`i-ph:caret-right text-xs transition-transform ${expanded === t.table_name ? 'rotate-90' : ''}`} style={{ color: 'var(--text-tertiary)' }} />
              </button>
              {expanded === t.table_name && (
                <div style={{ borderTop: '1px solid var(--border-subtle)' }}>
                  {loadingRows ? <Spinner /> : tableRows && tableRows.rows.length > 0 ? (
                    <div className="overflow-x-auto max-h-48">
                      <table className="text-xs w-full" style={{ borderCollapse: 'collapse' }}>
                        <thead>
                          <tr style={{ borderBottom: '1px solid var(--border-subtle)', background: 'var(--surface-1)' }}>
                            {tableRows.columns.map(c => (
                              <th key={c} className="text-left px-3 py-1.5 font-medium whitespace-nowrap" style={{ color: 'var(--text-secondary)' }}>{c}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {tableRows.rows.map((row, i) => (
                            <tr key={i} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                              {tableRows.columns.map(c => (
                                <td key={c} className="px-3 py-1.5 font-mono whitespace-nowrap max-w-xs truncate" style={{ color: 'var(--text-primary)' }}>
                                  {row[c] == null ? <span style={{ color: 'var(--text-tertiary)' }}>null</span> : String(row[c])}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : <p className="text-xs px-3 py-3" style={{ color: 'var(--text-tertiary)' }}>No rows</p>}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ─── Internal: SQL Editor ─────────────────────────────────────────────────────

const InternalSqlEditor = ({ schema }: { schema: string }) => {
  const [sql, setSql] = useState(`-- Schema: ${schema}\n-- Ctrl+Enter to run\n\nSELECT * FROM information_schema.tables WHERE table_schema = '${schema}';\n`);
  const [result, setResult] = useState<{ columns: string[]; rows: Record<string, unknown>[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const run = useCallback(async () => {
    if (!sql.trim()) return;
    setRunning(true); setError(null); setResult(null);
    try {
      const res = await internalPost('/api/backend/query', { schema, sql });
      const data = await res.json();
      if (!res.ok || data.error) { setError(data.error || 'Query failed'); }
      else {
        const rows: Record<string, unknown>[] = data.rows ?? [];
        setResult({ columns: rows.length > 0 ? Object.keys(rows[0]) : [], rows });
      }
    } catch (e: any) { setError(e.message); }
    finally { setRunning(false); }
  }, [schema, sql]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); run(); }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 flex flex-col gap-2" style={{ flex: '1 1 0', minHeight: 0 }}>
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>SQL editor</h3>
            <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>schema: {schema}</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => { setResult(null); setError(null); setSql(''); }} className="text-xs px-2.5 py-1 rounded-lg" style={{ background: 'var(--surface-2)', color: 'var(--text-secondary)', border: '1px solid var(--border-default)' }}>Clear</button>
            <button onClick={run} disabled={running} className="text-xs px-3 py-1 rounded-lg font-medium flex items-center gap-1.5 disabled:opacity-50" style={{ background: 'var(--accent)', color: '#fff' }}>
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
          className="flex-1 p-3 rounded-lg text-xs font-mono resize-none focus:outline-none"
          style={{ background: 'var(--surface-2)', border: '1px solid var(--border-default)', color: 'var(--text-primary)', minHeight: '140px' }}
        />
      </div>
      <div className="flex flex-col gap-2 px-4 py-3" style={{ borderTop: '1px solid var(--border-subtle)', background: 'var(--surface-1)' }}>
        <p className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>Results</p>
        {error && <div className="text-xs font-mono p-2.5 rounded-lg whitespace-pre-wrap" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: 'var(--error)' }}>{error}</div>}
        {result && result.rows.length === 0 && <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>✓ 0 rows returned</p>}
        {result && result.rows.length > 0 && (
          <div className="overflow-auto max-h-44 rounded-lg" style={{ border: '1px solid var(--border-subtle)' }}>
            <table className="text-xs w-full" style={{ borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--surface-2)', borderBottom: '1px solid var(--border-subtle)' }}>
                  {result.columns.map(c => <th key={c} className="text-left px-3 py-1.5 font-medium whitespace-nowrap" style={{ color: 'var(--text-secondary)' }}>{c}</th>)}
                </tr>
              </thead>
              <tbody>
                {result.rows.map((row, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                    {result.columns.map(c => (
                      <td key={c} className="px-3 py-1.5 font-mono whitespace-nowrap" style={{ color: 'var(--text-primary)' }}>
                        {row[c] == null ? <span style={{ color: 'var(--text-tertiary)' }}>null</span> : String(row[c])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {!result && !error && !running && <p className="text-xs py-2 text-center" style={{ color: 'var(--text-tertiary)' }}>Press Run or Ctrl+Enter</p>}
        {running && <Spinner />}
      </div>
    </div>
  );
};

// ─── Internal: Secrets ────────────────────────────────────────────────────────

const InternalSecrets = ({ schema }: { schema: string }) => {
  const [secrets, setSecrets] = useState<SecretRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [newKey, setNewKey] = useState('');
  const [newVal, setNewVal] = useState('');
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await internalPost('/api/backend/secrets', { schema });
      if (res.ok) setSecrets((await res.json()).secrets ?? []);
    } finally { setLoading(false); }
  }, [schema]);

  useEffect(() => { load(); }, [load]);

  const handleAdd = async () => {
    if (!newKey || !newVal) return;
    setAdding(true);
    try {
      const res = await fetch('/api/backend/secrets', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ schema, secrets: [{ name: newKey, value: newVal }] }) });
      if (res.ok) { toast.success('Secret saved!'); setNewKey(''); setNewVal(''); load(); }
      else toast.error('Failed to save');
    } finally { setAdding(false); }
  };

  const handleDelete = async (name: string) => {
    await fetch('/api/backend/secrets', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ schema, name }) });
    load();
  };

  return (
    <div className="flex flex-col gap-3 p-4">
      <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Secrets</h3>
      <div className="flex flex-col gap-2 p-3 rounded-lg" style={{ background: 'var(--surface-2)', border: '1px solid var(--border-subtle)' }}>
        <p className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>Add / update</p>
        <input placeholder="SECRET_NAME" value={newKey} onChange={e => setNewKey(e.target.value.toUpperCase().replace(/\s/g, '_'))} className="px-2.5 py-1.5 rounded-lg text-xs font-mono focus:outline-none" style={{ background: 'var(--surface-1)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }} />
        <input placeholder="value" type="password" value={newVal} onChange={e => setNewVal(e.target.value)} className="px-2.5 py-1.5 rounded-lg text-xs focus:outline-none" style={{ background: 'var(--surface-1)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }} />
        <button onClick={handleAdd} disabled={adding || !newKey || !newVal} className="py-1.5 rounded-lg text-xs font-medium disabled:opacity-50" style={{ background: 'var(--accent)', color: '#fff' }}>{adding ? 'Saving…' : 'Save secret'}</button>
      </div>
      {loading ? <Spinner /> : secrets.length === 0 ? <EmptyState icon="i-ph:key" message="No secrets yet" /> : (
        <div className="flex flex-col gap-1">
          {secrets.map(s => (
            <div key={s.name} className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm group" style={{ background: 'var(--surface-2)', border: '1px solid var(--border-subtle)' }}>
              <div className="i-ph:key text-sm shrink-0" style={{ color: 'var(--accent)' }} />
              <span className="flex-1 font-mono text-xs" style={{ color: 'var(--text-primary)' }}>{s.name}</span>
              <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>••••••••</span>
              <button onClick={() => handleDelete(s.name)} className="ml-2 w-5 h-5 flex items-center justify-center rounded opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: 'var(--error)' }} title="Delete">
                <div className="i-ph:trash text-xs" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ─── Internal: Users ──────────────────────────────────────────────────────────

const InternalUsers = ({ schema }: { schema: string }) => {
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
    <div className="flex flex-col gap-3 p-4">
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

// ─── Supabase: Connect ────────────────────────────────────────────────────────

const SupabaseConnect = () => {
  const conn = useStore(supabaseConnection);
  const [token, setToken] = useState(conn.token || '');
  const [loading, setLoading] = useState(false);

  if (conn.isConnected) {
    const projects = conn.stats?.projects ?? [];
    return (
      <div className="flex flex-col gap-4 p-4">
        <div>
          <h3 className="text-sm font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>Supabase</h3>
          <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{conn.user?.email}</p>
        </div>
        <div>
          <p className="text-xs mb-1.5 font-medium" style={{ color: 'var(--text-secondary)' }}>Active project</p>
          <select
            value={conn.selectedProjectId ?? ''}
            onChange={e => {
              updateSupabaseConnection({ selectedProjectId: e.target.value });
              if (e.target.value && conn.token) fetchProjectApiKeys(e.target.value, conn.token).catch(() => {});
            }}
            className="w-full px-3 py-2 rounded-lg text-sm focus:outline-none"
            style={{ background: 'var(--surface-2)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }}
          >
            <option value="">— select project —</option>
            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        {conn.project && (
          <div className="flex flex-col gap-1.5 p-3 rounded-lg text-xs" style={{ background: 'var(--surface-2)', border: '1px solid var(--border-subtle)' }}>
            {[
              ['Region', conn.project.region],
              ['Status', conn.project.status],
              ['Tables', String(conn.project.stats?.database?.tables ?? '—')],
              ['Users', String(conn.project.stats?.auth?.users ?? '—')],
            ].map(([l, v]) => (
              <div key={l} className="flex justify-between">
                <span style={{ color: 'var(--text-tertiary)' }}>{l}</span>
                <span style={{ color: 'var(--text-primary)' }}>{v}</span>
              </div>
            ))}
          </div>
        )}
        <button
          onClick={() => { updateSupabaseConnection({ user: null, token: '', isConnected: false, project: undefined, selectedProjectId: '' }); }}
          className="text-xs py-1.5 px-3 rounded-lg"
          style={{ color: 'var(--error)', border: '1px solid var(--error)' }}
        >
          Disconnect
        </button>
      </div>
    );
  }

  const connect = async () => {
    if (!token.trim()) return;
    setLoading(true);
    try {
      await fetchSupabaseStats(token.trim());
      toast.success('Connected to Supabase!');
    } catch {
      toast.error('Failed — check your token');
    } finally { setLoading(false); }
  };

  return (
    <div className="flex flex-col items-center justify-center h-full gap-5 p-6">
      <div className="flex flex-col items-center gap-2 text-center">
        <div className="i-ph:lightning text-4xl" style={{ color: 'var(--accent)' }} />
        <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Connect Supabase</h2>
        <p className="text-xs max-w-xs" style={{ color: 'var(--text-secondary)' }}>Enter your personal access token to link an external Supabase project to this app.</p>
      </div>
      <div className="w-full max-w-sm flex flex-col gap-2">
        <input type="password" placeholder="sbp_xxxxxxxxxxxxxxxxxxxxxxxxxxxx" value={token} onChange={e => setToken(e.target.value)} onKeyDown={e => e.key === 'Enter' && connect()} className="w-full px-3 py-2 rounded-lg text-sm focus:outline-none" style={{ background: 'var(--surface-2)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }} />
        <button onClick={connect} disabled={loading || !token.trim()} className="py-2 rounded-lg text-sm font-medium disabled:opacity-50" style={{ background: 'var(--accent)', color: '#fff' }}>
          {loading ? 'Connecting…' : 'Connect'}
        </button>
        <a href="https://supabase.com/dashboard/account/tokens" target="_blank" rel="noreferrer" className="text-xs text-center hover:underline" style={{ color: 'var(--accent)' }}>Generate a token ↗</a>
      </div>
    </div>
  );
};

// ─── Deploy / Domain section ──────────────────────────────────────────────────

const DeploySection = () => {
  const chatId = useStore(chatIdStore);
  const [loading, setLoading] = useState(false);
  const [hosting, setHosting] = useState<{
    slug?: string;
    autoUrl?: string;
    customUrl?: string;
    customDomain?: string;
    deploy_status?: string;
  } | null>(null);
  const [customDomain, setCustomDomain] = useState('');
  const [saving, setSaving] = useState(false);

  // Load hosting config
  const load = useCallback(async () => {
    if (!chatId) return;
    setLoading(true);
    try {
      // Find project linked to this chat
      const projRes = await fetch('/api/projects');
      if (projRes.ok) {
        const projects = await projRes.json();
        const linked = (Array.isArray(projects) ? projects : []).find((p: any) => p.chat_id === chatId);
        if (linked) {
          const hostRes = await fetch(`/api/hosting/config?projectId=${linked.id}`);
          if (hostRes.ok) {
            const data = await hostRes.json();
            setHosting(data.hosting);
            setCustomDomain(data.hosting?.custom_domain || '');
          }
        }
      }
    } finally { setLoading(false); }
  }, [chatId]);

  useEffect(() => { load(); }, [load]);

  const handleSetup = async () => {
    if (!chatId) return;
    setSaving(true);
    try {
      // Find linked project
      const projRes = await fetch('/api/projects');
      const projects = await projRes.json();
      const linked = (Array.isArray(projects) ? projects : []).find((p: any) => p.chat_id === chatId);
      if (!linked) {
        toast.error('Convert this chat to a project first (header button)');
        return;
      }
      const res = await fetch('/api/hosting/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: linked.id,
          customDomain: customDomain.trim() || undefined,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setHosting(data.hosting);
        toast.success('Hosting configured!');
      }
    } finally { setSaving(false); }
  };

  const handleSaveDomain = async () => {
    if (!chatId) return;
    setSaving(true);
    try {
      const projRes = await fetch('/api/projects');
      const projects = await projRes.json();
      const linked = (Array.isArray(projects) ? projects : []).find((p: any) => p.chat_id === chatId);
      if (!linked) return;
      const res = await fetch('/api/hosting/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: linked.id,
          customDomain: customDomain.trim() || null,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setHosting(data.hosting);
        toast.success('Domain updated!');
      }
    } finally { setSaving(false); }
  };

  return (
    <div className="flex flex-col gap-4 p-4">
      <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
        Deploy & Domain
      </h3>

      {loading ? <Spinner /> : !hosting ? (
        <div className="flex flex-col gap-3">
          <EmptyState icon="i-ph:globe" message="No hosting configured yet. Set up hosting to get a public URL." />
          <button
            onClick={handleSetup}
            disabled={saving}
            className="py-2 rounded-lg text-sm font-medium disabled:opacity-50"
            style={{ background: 'var(--accent)', color: '#fff' }}
          >
            {saving ? 'Setting up…' : 'Set up hosting'}
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {/* Auto-generated URL */}
          <div className="rounded-lg p-4" style={{ background: 'var(--surface-2)', border: '1px solid var(--border-subtle)' }}>
            <p className="text-xs font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
              App URL (auto-generated)
            </p>
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full" style={{ background: hosting.deploy_status === 'live' ? 'var(--success)' : 'var(--warning)' }} />
              <a
                href={hosting.autoUrl}
                target="_blank"
                rel="noreferrer"
                className="text-sm font-mono hover:underline truncate"
                style={{ color: 'var(--accent)' }}
              >
                {hosting.autoUrl}
              </a>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(hosting.autoUrl || '');
                  toast.success('URL copied!');
                }}
                className="shrink-0 w-6 h-6 flex items-center justify-center rounded"
                style={{ background: 'var(--surface-3)', color: 'var(--text-secondary)' }}
              >
                <div className="i-ph:copy text-xs" />
              </button>
            </div>
            <p className="text-xs mt-1.5" style={{ color: 'var(--text-tertiary)' }}>
              slug: <code className="font-mono">{hosting.slug}</code>
            </p>
          </div>

          {/* Custom domain */}
          <div className="rounded-lg p-4" style={{ background: 'var(--surface-2)', border: '1px solid var(--border-subtle)' }}>
            <p className="text-xs font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
              Custom domain (optional)
            </p>
            <div className="flex gap-2">
              <input
                value={customDomain}
                onChange={(e) => setCustomDomain(e.target.value)}
                placeholder="app.yourdomain.com"
                className="flex-1 px-3 py-1.5 rounded-lg text-sm font-mono focus:outline-none"
                style={{
                  background: 'var(--surface-1)',
                  border: '1px solid var(--border-default)',
                  color: 'var(--text-primary)',
                }}
              />
              <button
                onClick={handleSaveDomain}
                disabled={saving}
                className="px-3 py-1.5 rounded-lg text-xs font-medium disabled:opacity-50"
                style={{ background: 'var(--accent)', color: '#fff' }}
              >
                Save
              </button>
            </div>
            {hosting.customDomain && hosting.customUrl && (
              <a
                href={hosting.customUrl}
                target="_blank"
                rel="noreferrer"
                className="text-xs mt-2 inline-block hover:underline"
                style={{ color: 'var(--accent)' }}
              >
                {hosting.customUrl} ↗
              </a>
            )}
            <div className="mt-3 text-xs flex flex-col gap-1" style={{ color: 'var(--text-tertiary)' }}>
              <p className="font-medium" style={{ color: 'var(--text-secondary)' }}>DNS setup:</p>
              <p>1. Add a <code className="font-mono">CNAME</code> record pointing to your instance domain</p>
              <p>2. Or an <code className="font-mono">A</code> record pointing to your VPS IP</p>
              <p>3. SSL certificate is provisioned automatically by Caddy</p>
            </div>
          </div>

          {/* Deploy status */}
          <div className="rounded-lg p-4" style={{ background: 'var(--surface-2)', border: '1px solid var(--border-subtle)' }}>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>Deploy status</p>
              <span
                className="text-xs px-2 py-0.5 rounded capitalize"
                style={{
                  background: hosting.deploy_status === 'live' ? 'var(--accent-muted)' : 'rgba(245,158,11,0.1)',
                  color: hosting.deploy_status === 'live' ? 'var(--accent)' : 'var(--warning)',
                }}
              >
                {hosting.deploy_status || 'pending'}
              </span>
            </div>
            <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
              Push your code to GitHub and deploy will be triggered automatically, or use the deploy button in the toolbar.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Main CloudPanel ──────────────────────────────────────────────────────────

export const CloudPanel = () => {
  const appDb = useStore(activeAppDb);
  const chatId = useStore(chatIdStore);
  const [section, setSection] = useState<Section>('overview');

  // Sync active app when chat changes
  useEffect(() => {
    if (chatId) {
      setActiveApp(chatId);
    }
  }, [chatId]);

  const handleProviderChange = (provider: DbProvider) => {
    updateActiveAppDb({ provider });
    setSection('overview');
  };

  const nav: { id: Section; label: string; icon: string }[] = [
    { id: 'overview', label: 'Overview', icon: 'i-ph:squares-four' },
    { id: 'database', label: 'Database', icon: 'i-ph:database' },
    { id: 'users', label: 'Users', icon: 'i-ph:users' },
    { id: 'secrets', label: 'Secrets', icon: 'i-ph:key' },
    { id: 'sql-editor', label: 'SQL editor', icon: 'i-ph:terminal-window' },
    { id: 'logs', label: 'Logs', icon: 'i-ph:list-bullets' },
    { id: 'deploy', label: 'Deploy', icon: 'i-ph:globe' },
  ];

  const schema = appDb.schema || 'public';
  const provider = appDb.provider;

  const renderContent = () => {
    if (provider === 'supabase') {
      return <SupabaseConnect />;
    }

    // Internal provider
    switch (section) {
      case 'overview': return <InternalOverview schema={schema} onNavigate={setSection} />;
      case 'database': return <InternalDatabase schema={schema} />;
      case 'users': return <InternalUsers schema={schema} />;
      case 'secrets': return <InternalSecrets schema={schema} />;
      case 'sql-editor': return <InternalSqlEditor schema={schema} />;
      case 'logs': return (
        <div className="p-4">
          <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>Logs</h3>
          <EmptyState icon="i-ph:list-bullets" message={`App logs from schema "${schema}" will appear here.`} />
        </div>
      );
      case 'deploy': return <DeploySection />;
    }
  };

  return (
    <div className="flex h-full" style={{ background: 'var(--surface-1)' }}>
      {/* Left nav */}
      <nav className="w-44 shrink-0 flex flex-col gap-0.5 p-2 overflow-y-auto" style={{ borderRight: '1px solid var(--border-subtle)' }}>
        {/* Provider toggle */}
        <div className="mb-2">
          <ProviderToggle provider={provider} onChange={handleProviderChange} />
        </div>

        {provider === 'internal' && (
          <>
            <p className="text-xs font-semibold px-3 py-1 mb-0.5" style={{ color: 'var(--text-tertiary)' }}>
              {schema}
            </p>
            {nav.map(item => (
              <NavItem key={item.id} {...item} active={section === item.id} onClick={setSection} />
            ))}
          </>
        )}

        {provider === 'supabase' && (
          <p className="text-xs px-3 py-2" style={{ color: 'var(--text-tertiary)' }}>
            Connect your Supabase project on the right →
          </p>
        )}

        <div className="mt-auto pt-2" style={{ borderTop: '1px solid var(--border-subtle)' }}>
          <a href="/admin" className="flex items-center gap-2 px-3 py-2 rounded-md text-xs transition-colors" style={{ color: 'var(--text-tertiary)' }}>
            <div className="i-ph:gear text-sm" />
            Instance settings
          </a>
        </div>
      </nav>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {renderContent()}
      </div>
    </div>
  );
};
