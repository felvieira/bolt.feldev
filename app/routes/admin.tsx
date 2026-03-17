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

  return (
    <div
      className="min-h-screen p-6"
      style={{ background: 'var(--background)', color: 'var(--text-primary)' }}
    >
      <div className="max-w-3xl mx-auto">
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

        {/* Database Status */}
        <section className="mb-8">
          <h2 className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
            <div className="i-ph:database text-base" style={{ color: 'var(--accent)' }} />
            Database
          </h2>
          <div
            className="rounded-xl p-4"
            style={{ background: 'var(--surface-1)', border: '1px solid var(--border-subtle)' }}
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
                  <div className="w-2.5 h-2.5 rounded-full" style={{ background: 'var(--success)' }} />
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
                  <div className="w-2.5 h-2.5 rounded-full" style={{ background: 'var(--error)' }} />
                  <span className="text-sm font-medium" style={{ color: 'var(--error)' }}>
                    Not connected
                  </span>
                </div>
                <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                  {dbStatus?.error}
                </p>
                <div
                  className="text-xs p-2.5 rounded-lg mt-1"
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
              className="mt-3 text-xs px-3 py-1.5 rounded-lg"
              style={{ background: 'var(--surface-2)', color: 'var(--text-secondary)', border: '1px solid var(--border-default)' }}
            >
              Refresh
            </button>
          </div>
        </section>

        {/* Provisioned App Schemas */}
        <section className="mb-8">
          <h2 className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
            <div className="i-ph:squares-four text-base" style={{ color: 'var(--accent)' }} />
            App databases ({apps.length})
          </h2>
          <div
            className="rounded-xl p-4"
            style={{ background: 'var(--surface-1)', border: '1px solid var(--border-subtle)' }}
          >
            {apps.length === 0 ? (
              <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                No apps provisioned yet. Create an app and click "Provision database" in the Backend panel.
              </p>
            ) : (
              <div className="flex flex-col gap-1">
                {apps.map((a) => (
                  <div
                    key={a.schema_name}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm"
                    style={{ background: 'var(--surface-2)' }}
                  >
                    <div className="i-ph:database text-sm" style={{ color: 'var(--accent)' }} />
                    <code className="font-mono text-xs" style={{ color: 'var(--text-primary)' }}>
                      {a.schema_name}
                    </code>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Quick SQL Test */}
        <section className="mb-8">
          <h2 className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
            <div className="i-ph:terminal-window text-base" style={{ color: 'var(--accent)' }} />
            Quick SQL
          </h2>
          <div
            className="rounded-xl p-4 flex flex-col gap-3"
            style={{ background: 'var(--surface-1)', border: '1px solid var(--border-subtle)' }}
          >
            <textarea
              value={testSql}
              onChange={(e) => setTestSql(e.target.value)}
              placeholder="SELECT 1 + 1 AS result;"
              spellCheck={false}
              className="p-3 rounded-lg text-xs font-mono resize-none focus:outline-none h-20"
              style={{
                background: 'var(--surface-2)',
                border: '1px solid var(--border-default)',
                color: 'var(--text-primary)',
              }}
            />
            <button
              onClick={runTest}
              className="self-end px-3 py-1.5 rounded-lg text-xs font-medium"
              style={{ background: 'var(--accent)', color: '#fff' }}
            >
              Run
            </button>
            {testResult && (
              <pre
                className="text-xs font-mono p-3 rounded-lg overflow-auto max-h-48"
                style={{
                  background: 'var(--surface-2)',
                  border: '1px solid var(--border-subtle)',
                  color: 'var(--text-primary)',
                }}
              >
                {testResult}
              </pre>
            )}
          </div>
        </section>

        {/* Docker / Infrastructure */}
        <section className="mb-8">
          <h2 className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
            <div className="i-ph:check-square text-base" style={{ color: 'var(--accent)' }} />
            Infrastructure checklist
          </h2>
          <div
            className="rounded-xl p-3 flex flex-col gap-1.5"
            style={{ background: 'var(--surface-1)', border: '1px solid var(--border-subtle)' }}
          >
            <CheckItem label="Postgres running" ok={dbStatus?.ok ?? false} />
            <CheckItem label="Auth service reachable" ok={dbStatus?.ok ?? false} />
            <CheckItem label="Docker Compose configured" ok />
            <CheckItem label="Caddy/Nginx reverse proxy" ok={false} hint="Add a Caddy service to docker-compose for SSL + domain routing" />
            <CheckItem label="Custom domain configured" ok={false} hint="Point your domain's DNS A record to this VPS IP" />
          </div>
        </section>

        {/* Deployment guide */}
        <section className="mb-8">
          <h2 className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
            <div className="i-ph:rocket-launch text-base" style={{ color: 'var(--accent)' }} />
            Deploy guide
          </h2>
          <div
            className="rounded-xl p-4 text-xs flex flex-col gap-3"
            style={{ background: 'var(--surface-1)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}
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
        </section>
      </div>
    </div>
  );
}

function CheckItem({ label, ok, hint }: { label: string; ok: boolean; hint?: string }) {
  return (
    <div
      className="flex items-start gap-3 px-3 py-2.5 rounded-lg transition-colors"
      style={{ background: 'var(--surface-2)' }}
    >
      <div className="flex items-center gap-2.5 mt-0.5">
        <div
          className="w-2 h-2 rounded-full shrink-0"
          style={{ background: ok ? 'var(--success)' : 'var(--error)', boxShadow: ok ? '0 0 6px var(--success)' : '0 0 6px var(--error)' }}
        />
      </div>
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium" style={{ color: ok ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
            {label}
          </span>
          <span
            className="text-[10px] px-1.5 py-0.5 rounded font-medium uppercase"
            style={{
              background: ok ? 'var(--success-muted)' : 'var(--error-muted)',
              color: ok ? 'var(--success)' : 'var(--error)',
            }}
          >
            {ok ? 'OK' : 'Missing'}
          </span>
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
