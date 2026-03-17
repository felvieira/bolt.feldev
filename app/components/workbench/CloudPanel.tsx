/**
 * CloudPanel — Backend management panel for bolt.feldev.
 *
 * Each app can use:
 *   - Internal Postgres (isolated schema per app, provisioned on demand)
 *   - External Supabase project
 *
 * The provider toggle at the top switches between modes.
 * All queries are scoped to the app's schema when using internal mode.
 *
 * Sub-components live in ./cloud/ and are self-contained (own state + fetches).
 */
import { useState, useEffect, Fragment } from 'react';
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

import { type Section } from './cloud/shared';
import { OverviewSection } from './cloud/OverviewSection';
import { DatabaseSection } from './cloud/DatabaseSection';
import { UsersSection } from './cloud/UsersSection';
import { SecretsSection } from './cloud/SecretsSection';
import { SqlEditorSection } from './cloud/SqlEditorSection';
import { LogsSection } from './cloud/LogsSection';
import { DeploySection } from './cloud/DeploySection';

// ─── Nav item ─────────────────────────────────────────────────────────────────

const NavItem = ({
  id, label, icon, active, onClick,
}: {
  id: Section; label: string; icon: string; active: boolean; onClick: (s: Section) => void;
}) => (
  <button
    onClick={() => onClick(id)}
    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm text-left transition-all relative"
    style={{
      background: active ? 'var(--surface-3)' : 'transparent',
      color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
    }}
  >
    {active && (
      <div
        className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-4 rounded-r"
        style={{ background: 'var(--accent)' }}
      />
    )}
    <div
      className={`${icon} text-base shrink-0`}
      style={{ color: active ? 'var(--accent)' : undefined }}
    />
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
        {p === 'internal' ? 'Internal' : 'Supabase'}
      </button>
    ))}
  </div>
);

// ─── Supabase connect (kept inline — small) ──────────────────────────────────

const SupabaseConnect = () => {
  const conn = useStore(supabaseConnection);
  const [token, setToken] = useState(conn.token || '');
  const [loading, setLoading] = useState(false);

  if (conn.isConnected) {
    const projects = conn.stats?.projects ?? [];
    return (
      <div className="flex flex-col gap-4 p-6">
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
            <option value="">-- select project --</option>
            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        {conn.project && (
          <div className="flex flex-col gap-1.5 p-3 rounded-lg text-xs" style={{ background: 'var(--surface-2)', border: '1px solid var(--border-subtle)' }}>
            {[
              ['Region', conn.project.region],
              ['Status', conn.project.status],
              ['Tables', String(conn.project.stats?.database?.tables ?? '--')],
              ['Users', String(conn.project.stats?.auth?.users ?? '--')],
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
      toast.error('Failed -- check your token');
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
          {loading ? 'Connecting...' : 'Connect'}
        </button>
        <a href="https://supabase.com/dashboard/account/tokens" target="_blank" rel="noreferrer" className="text-xs text-center hover:underline" style={{ color: 'var(--accent)' }}>Generate a token</a>
      </div>
    </div>
  );
};

// ─── Main CloudPanel ──────────────────────────────────────────────────────────

const navItems: { id: Section; label: string; icon: string }[] = [
  { id: 'overview', label: 'Overview', icon: 'i-ph:squares-four' },
  { id: 'database', label: 'Database', icon: 'i-ph:database' },
  { id: 'users', label: 'Users', icon: 'i-ph:users' },
  { id: 'secrets', label: 'Secrets', icon: 'i-ph:key' },
  { id: 'sql-editor', label: 'SQL editor', icon: 'i-ph:terminal-window' },
  { id: 'logs', label: 'Logs', icon: 'i-ph:list-bullets' },
  { id: 'deploy', label: 'Deploy', icon: 'i-ph:globe' },
];

export const CloudPanel = () => {
  const appDb = useStore(activeAppDb);
  const chatId = useStore(chatIdStore);
  const [section, setSection] = useState<Section>('overview');

  useEffect(() => {
    if (chatId) setActiveApp(chatId);
  }, [chatId]);

  const handleProviderChange = (provider: DbProvider) => {
    updateActiveAppDb({ provider });
    setSection('overview');
  };

  const schema = appDb.schema || 'public';
  const provider = appDb.provider;

  const renderContent = () => {
    if (provider === 'supabase') return <SupabaseConnect />;

    const props = { schema, chatId: chatId || '' };
    switch (section) {
      case 'overview':   return <OverviewSection {...props} onNavigate={setSection} />;
      case 'database':   return <DatabaseSection {...props} />;
      case 'users':      return <UsersSection {...props} />;
      case 'secrets':    return <SecretsSection {...props} />;
      case 'sql-editor': return <SqlEditorSection {...props} />;
      case 'logs':       return <LogsSection {...props} />;
      case 'deploy':     return <DeploySection {...props} />;
    }
  };

  return (
    <div className="flex h-full" style={{ background: 'var(--surface-1)' }}>
      {/* Left nav */}
      <nav
        className="w-44 shrink-0 flex flex-col gap-0.5 p-2 overflow-y-auto"
        style={{ borderRight: '1px solid var(--border-subtle)' }}
      >
        <div className="mb-2">
          <ProviderToggle provider={provider} onChange={handleProviderChange} />
        </div>

        {provider === 'internal' && (
          <>
            <p className="text-xs font-semibold px-3 py-1 mb-0.5" style={{ color: 'var(--text-tertiary)' }}>
              {schema}
            </p>
            {navItems.map(item => (
              <Fragment key={item.id}>
                {item.id === 'deploy' && (
                  <div className="my-1.5" style={{ borderTop: '1px solid var(--border-subtle)' }} />
                )}
                <NavItem {...item} active={section === item.id} onClick={setSection} />
              </Fragment>
            ))}
          </>
        )}

        {provider === 'supabase' && (
          <p className="text-xs px-3 py-2" style={{ color: 'var(--text-tertiary)' }}>
            Connect your Supabase project on the right
          </p>
        )}

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
        {renderContent()}
      </div>
    </div>
  );
};
