/**
 * /admin — Instance administration page.
 *
 * Lets the VPS owner configure:
 * - Database connectivity (status + health check)
 * - Deployed apps overview
 * - Domain / SSL settings
 * - Instance environment variables
 */
import { useState, useEffect, useCallback } from 'react';

interface DbStatus {
  ok: boolean;
  version?: string;
  error?: string;
}

interface AppInfo {
  schema_name: string;
}

export default function AdminPage() {
  const [dbStatus, setDbStatus] = useState<DbStatus | null>(null);
  const [apps, setApps] = useState<AppInfo[]>([]);
  const [loadingDb, setLoadingDb] = useState(true);
  const [testSql, setTestSql] = useState('');
  const [testResult, setTestResult] = useState<string | null>(null);

  const checkDb = useCallback(async () => {
    setLoadingDb(true);

    try {
      const res = await fetch('/api/db-proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-internal-secret': 'bolt-internal' },
        body: JSON.stringify({ sql: 'SELECT version() AS v' }),
      });

      if (res.ok) {
        const data = await res.json();
        setDbStatus({ ok: true, version: data.rows?.[0]?.v });
      } else {
        const err = await res.json().catch(() => ({}));
        setDbStatus({ ok: false, error: err.error || 'Connection failed' });
      }
    } catch (e: any) {
      setDbStatus({ ok: false, error: e.message });
    } finally {
      setLoadingDb(false);
    }
  }, []);

  const loadApps = useCallback(async () => {
    try {
      const res = await fetch('/api/db-proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-internal-secret': 'bolt-internal' },
        body: JSON.stringify({
          sql: `SELECT schema_name FROM information_schema.schemata WHERE schema_name LIKE 'app_%' ORDER BY schema_name`,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setApps(data.rows ?? []);
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    checkDb();
    loadApps();
  }, [checkDb, loadApps]);

  const runTest = async () => {
    if (!testSql.trim()) return;

    try {
      const res = await fetch('/api/db-proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-internal-secret': 'bolt-internal' },
        body: JSON.stringify({ sql: testSql }),
      });
      const data = await res.json();
      setTestResult(JSON.stringify(data, null, 2));
    } catch (e: any) {
      setTestResult(`Error: ${e.message}`);
    }
  };

  // Parse test result for table rendering
  const parsedResult = (() => {
    if (!testResult) return null;
    try {
      const data = JSON.parse(testResult);
      if (data.rows && Array.isArray(data.rows) && data.rows.length > 0) {
        const columns = Object.keys(data.rows[0]);
        return { columns, rows: data.rows };
      }
    } catch { /* not JSON or no rows */ }
    return null;
  })();

  return (
    <div
      className="min-h-screen p-8"
      style={{ background: 'var(--background)', color: 'var(--text-primary)' }}
    >
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-10 pb-6" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
          <a
            href="/"
            className="flex items-center justify-center w-9 h-9 rounded-lg transition-all hover:scale-105"
            style={{ background: 'var(--surface-2)', color: 'var(--text-secondary)', border: '1px solid var(--border-subtle)' }}
          >
            <div className="i-ph:arrow-left text-sm" />
          </a>
          <div>
            <h1 className="text-xl font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>
              Instance Administration
            </h1>
            <p className="text-sm mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
              Manage your bolt.feldev instance
            </p>
          </div>
        </div>

        {/* Infrastructure Checklist */}
        <details open className="group mb-8">
          <summary className="flex items-center gap-2 cursor-pointer select-none py-2 text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
            <div className="i-ph:caret-right text-xs transition-transform group-open:rotate-90" style={{ color: 'var(--text-tertiary)' }} />
            <div className="i-ph:check-square text-base" style={{ color: 'var(--accent)' }} />
            Infrastructure Checklist
          </summary>
          <div className="mt-3">
            <div className="grid grid-cols-2 gap-3">
              <CheckCard icon="i-ph:database" label="Postgres" ok={dbStatus?.ok ?? false} />
              <CheckCard icon="i-ph:shield-check" label="Auth Service" ok={dbStatus?.ok ?? false} />
              <CheckCard icon="i-ph:package" label="Docker Compose" ok />
              <CheckCard icon="i-ph:globe" label="Reverse Proxy" ok={false} hint="Add Caddy to docker-compose" />
              <CheckCard icon="i-ph:link" label="Custom Domain" ok={false} hint="Point DNS A record to VPS IP" />
              <CheckCard icon="i-ph:lock-key" label="SSL Certificate" ok={false} hint="Auto-provisioned by Caddy" />
            </div>
          </div>
        </details>

        {/* Database Status */}
        <details open className="group mb-8">
          <summary className="flex items-center gap-2 cursor-pointer select-none py-2 text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
            <div className="i-ph:caret-right text-xs transition-transform group-open:rotate-90" style={{ color: 'var(--text-tertiary)' }} />
            <div className="i-ph:database text-base" style={{ color: 'var(--accent)' }} />
            Database
          </summary>
          <div className="mt-3">
            <div
              className="rounded-xl p-5"
              style={{ background: 'var(--surface-1)', border: '1px solid var(--border-subtle)', boxShadow: 'var(--shadow-sm)' }}
            >
              {loadingDb ? (
                <div className="flex items-center gap-2">
                  <div className="i-ph:spinner-gap animate-spin" style={{ color: 'var(--accent)' }} />
                  <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                    Checking database…
                  </span>
                </div>
              ) : dbStatus?.ok ? (
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ background: 'var(--success)', boxShadow: '0 0 8px var(--success)' }}
                    />
                    <span className="text-sm font-medium" style={{ color: 'var(--success)' }}>
                      Connected
                    </span>
                  </div>
                  <p className="text-xs font-mono" style={{ color: 'var(--text-tertiary)' }}>
                    {dbStatus.version}
                  </p>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ background: 'var(--error)', boxShadow: '0 0 8px var(--error)' }}
                    />
                    <span className="text-sm font-medium" style={{ color: 'var(--error)' }}>
                      Not connected
                    </span>
                  </div>
                  <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                    {dbStatus?.error}
                  </p>
                  <div
                    className="text-xs p-3 rounded-lg mt-1"
                    style={{
                      background: 'var(--error-muted)',
                      border: '1px solid var(--error-border)',
                      color: 'var(--text-secondary)',
                    }}
                  >
                    <p className="font-medium mb-1">How to fix:</p>
                    <ol className="list-decimal list-inside space-y-0.5">
                      <li>
                        Ensure <code className="font-mono" style={{ color: 'var(--accent)' }}>DATABASE_URL</code> is set in your <code>.env</code>
                      </li>
                      <li>
                        Ensure <code className="font-mono" style={{ color: 'var(--accent)' }}>AUTH_SERVICE_URL</code> is set (default: <code>http://auth-service:3200</code>)
                      </li>
                      <li>Run <code className="font-mono">docker compose up postgres auth-service</code></li>
                    </ol>
                  </div>
                </div>
              )}
              <button
                onClick={checkDb}
                className="mt-4 text-xs px-4 py-2 rounded-lg font-medium transition-colors hover:opacity-80"
                style={{ background: 'var(--surface-2)', color: 'var(--text-secondary)', border: '1px solid var(--border-default)' }}
              >
                Refresh
              </button>
            </div>
          </div>
        </details>

        {/* App Databases */}
        <details open className="group mb-8">
          <summary className="flex items-center gap-2 cursor-pointer select-none py-2 text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
            <div className="i-ph:caret-right text-xs transition-transform group-open:rotate-90" style={{ color: 'var(--text-tertiary)' }} />
            <div className="i-ph:squares-four text-base" style={{ color: 'var(--accent)' }} />
            App Databases ({apps.length})
          </summary>
          <div className="mt-3">
            <div
              className="rounded-xl overflow-hidden"
              style={{ border: '1px solid var(--border-subtle)', boxShadow: 'var(--shadow-sm)' }}
            >
              {apps.length === 0 ? (
                <div className="p-5" style={{ background: 'var(--surface-1)' }}>
                  <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                    No apps provisioned yet. Create an app and click "Provision database" in the Backend panel.
                  </p>
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ background: 'var(--surface-2)', borderBottom: '1px solid var(--border-subtle)' }}>
                      <th className="text-left px-4 py-3 text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>Schema</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>Tables</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {apps.map((a, i) => (
                      <tr
                        key={a.schema_name}
                        style={{
                          background: i % 2 === 0 ? 'var(--surface-1)' : 'var(--surface-2)',
                          borderBottom: '1px solid var(--border-subtle)',
                        }}
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="i-ph:database text-sm" style={{ color: 'var(--accent)' }} />
                            <code className="font-mono text-xs" style={{ color: 'var(--text-primary)' }}>
                              {a.schema_name}
                            </code>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-xs" style={{ color: 'var(--text-tertiary)' }}>—</td>
                        <td className="px-4 py-3 text-right">
                          <button
                            className="text-xs px-2.5 py-1 rounded-md font-medium"
                            style={{ background: 'var(--surface-3)', color: 'var(--text-secondary)', border: '1px solid var(--border-subtle)' }}
                            onClick={() => setTestSql(`SELECT table_name FROM information_schema.tables WHERE table_schema = '${a.schema_name}'`)}
                          >
                            Inspect
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </details>

        {/* SQL Editor */}
        <details open className="group mb-8">
          <summary className="flex items-center gap-2 cursor-pointer select-none py-2 text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
            <div className="i-ph:caret-right text-xs transition-transform group-open:rotate-90" style={{ color: 'var(--text-tertiary)' }} />
            <div className="i-ph:terminal-window text-base" style={{ color: 'var(--accent)' }} />
            SQL Editor
          </summary>
          <div className="mt-3">
            <div
              className="rounded-xl p-5 flex flex-col gap-4"
              style={{ background: 'var(--surface-1)', border: '1px solid var(--border-subtle)', boxShadow: 'var(--shadow-sm)' }}
            >
              <textarea
                value={testSql}
                onChange={(e) => setTestSql(e.target.value)}
                placeholder="SELECT 1 + 1 AS result;"
                spellCheck={false}
                className="p-3 rounded-lg text-xs font-mono resize-none focus:outline-none h-24"
                style={{
                  background: 'var(--surface-2)',
                  border: '1px solid var(--border-default)',
                  color: 'var(--text-primary)',
                }}
              />
              <div className="flex items-center justify-between">
                <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                  Results are read-only views. Use caution with write queries.
                </span>
                <button
                  onClick={runTest}
                  className="px-4 py-2 rounded-lg text-xs font-medium transition-colors hover:opacity-90"
                  style={{ background: 'var(--accent)', color: '#fff' }}
                >
                  Run Query
                </button>
              </div>
              {testResult && (
                <div
                  className="rounded-lg overflow-auto max-h-72"
                  style={{
                    border: '1px solid var(--border-subtle)',
                  }}
                >
                  {parsedResult ? (
                    <table className="w-full text-xs font-mono">
                      <thead>
                        <tr style={{ background: 'var(--surface-2)', position: 'sticky', top: 0 }}>
                          {parsedResult.columns.map((col) => (
                            <th
                              key={col}
                              className="text-left px-3 py-2 font-semibold"
                              style={{ color: 'var(--text-secondary)', borderBottom: '1px solid var(--border-subtle)' }}
                            >
                              {col}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {parsedResult.rows.map((row: Record<string, any>, i: number) => (
                          <tr
                            key={i}
                            style={{
                              background: i % 2 === 0 ? 'var(--surface-1)' : 'var(--surface-2)',
                            }}
                          >
                            {parsedResult.columns.map((col) => (
                              <td
                                key={col}
                                className="px-3 py-2"
                                style={{ color: 'var(--text-primary)', borderBottom: '1px solid var(--border-subtle)' }}
                              >
                                {row[col] === null ? <span style={{ color: 'var(--text-tertiary)' }}>NULL</span> : String(row[col])}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <pre
                      className="text-xs font-mono p-3 overflow-auto"
                      style={{
                        background: 'var(--surface-2)',
                        color: 'var(--text-primary)',
                      }}
                    >
                      {testResult}
                    </pre>
                  )}
                </div>
              )}
            </div>
          </div>
        </details>

        {/* Deploy Guide */}
        <details open className="group mb-8">
          <summary className="flex items-center gap-2 cursor-pointer select-none py-2 text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
            <div className="i-ph:caret-right text-xs transition-transform group-open:rotate-90" style={{ color: 'var(--text-tertiary)' }} />
            <div className="i-ph:rocket-launch text-base" style={{ color: 'var(--accent)' }} />
            Deploy Guide
          </summary>
          <div className="mt-3">
            <div
              className="rounded-xl p-5 text-xs flex flex-col gap-3"
              style={{ background: 'var(--surface-1)', border: '1px solid var(--border-subtle)', boxShadow: 'var(--shadow-sm)', color: 'var(--text-secondary)' }}
            >
              <p>
                <strong>1.</strong> Clone the repo and copy <code className="font-mono">.env.example</code> to <code className="font-mono">.env</code>
              </p>
              <p>
                <strong>2.</strong> Set your API keys and <code className="font-mono">POSTGRES_PASSWORD</code>
              </p>
              <p>
                <strong>3.</strong> Run:{' '}
                <code className="font-mono px-1.5 py-0.5 rounded" style={{ background: 'var(--surface-2)' }}>
                  docker compose --profile production up -d
                </code>
              </p>
              <p>
                <strong>4.</strong> Access the app at <code className="font-mono">http://your-vps-ip:5173</code>
              </p>
              <p>
                <strong>5.</strong> For SSL, add Caddy to docker-compose (see docs/deploy.md)
              </p>
            </div>
          </div>
        </details>
      </div>
    </div>
  );
}

function CheckCard({ icon, label, ok, hint }: { icon: string; label: string; ok: boolean; hint?: string }) {
  return (
    <div
      className="rounded-xl p-4 flex items-start gap-3"
      style={{
        background: ok ? 'var(--success-muted)' : 'var(--error-muted)',
        border: `1px solid ${ok ? 'var(--success-border)' : 'var(--error-border)'}`,
        boxShadow: 'var(--shadow-sm)',
      }}
    >
      <div className={`${icon} text-lg mt-0.5`} style={{ color: ok ? 'var(--success)' : 'var(--error)' }} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
            {label}
          </span>
          <div
            className="w-2 h-2 rounded-full shrink-0"
            style={{
              background: ok ? 'var(--success)' : 'var(--error)',
              boxShadow: `0 0 8px ${ok ? 'var(--success)' : 'var(--error)'}`,
            }}
          />
        </div>
        {!ok && hint && (
          <p className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>
            {hint}
          </p>
        )}
      </div>
    </div>
  );
}
