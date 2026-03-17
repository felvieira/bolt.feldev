import { useState, useEffect } from 'react';
import { useStore } from '@nanostores/react';
import { projectsStore } from '~/lib/stores/projects';

type DbProvider = 'supabase' | 'local';

interface DatabaseTabProps {
  projectId: string;
}

export const DatabaseTab = ({ projectId }: DatabaseTabProps) => {
  const projects = useStore(projectsStore);
  const project = projects.find((p) => p.id === projectId);

  const [provider, setProvider] = useState<DbProvider>((project?.db_provider as DbProvider) ?? 'supabase');
  const [supabaseUrl, setSupabaseUrl] = useState('');
  const [anonKey, setAnonKey] = useState('');
  const [connected, setConnected] = useState(false);
  const [provisioning, setProvisioning] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (project?.db_provider) {
      setProvider(project.db_provider as DbProvider);
    }
  }, [project]);

  const handleSave = async () => {
    setSaving(true);

    try {
      const body = provider === 'supabase' ? { provider, supabaseUrl, anonKey } : { provider };

      const res = await fetch(`/api/projects/${projectId}/database`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        setConnected(true);
      }
    } finally {
      setSaving(false);
    }
  };

  const handleProvision = async () => {
    setProvisioning(true);

    try {
      const res = await fetch(`/api/projects/${projectId}/database`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: 'local' }),
      });

      if (res.ok) {
        setConnected(true);
      }
    } finally {
      setProvisioning(false);
    }
  };

  const inputClasses =
    'w-full px-3 py-2 rounded-lg text-sm outline-none transition-all duration-150 focus:ring-2 focus:ring-[var(--accent)]/40 focus:border-[var(--accent)]';

  const inputStyle = {
    background: 'var(--surface-1)',
    border: '1px solid var(--border-subtle)',
    color: 'var(--text-primary)',
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Provider toggle */}
      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
          Provider
        </label>
        <div className="flex gap-2">
          {(['supabase', 'local'] as const).map((p) => {
            const isActive = provider === p;

            return (
              <button
                key={p}
                onClick={() => setProvider(p)}
                className="px-4 py-2 rounded-lg text-sm font-medium transition-all duration-150"
                style={{
                  background: isActive ? 'var(--accent)' : 'var(--surface-1)',
                  color: isActive ? '#fff' : 'var(--text-secondary)',
                  border: `1px solid ${isActive ? 'var(--accent)' : 'var(--border-subtle)'}`,
                  boxShadow: isActive ? '0 0 12px rgba(99,102,241,0.2)' : 'none',
                }}
              >
                {p === 'supabase' ? 'Supabase Cloud' : 'Local PostgreSQL'}
              </button>
            );
          })}
        </div>
      </div>

      {provider === 'supabase' ? (
        <>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
              Supabase URL
            </label>
            <input
              type="text"
              value={supabaseUrl}
              onChange={(e) => setSupabaseUrl(e.target.value)}
              placeholder="https://xxx.supabase.co"
              className={inputClasses}
              style={inputStyle}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
              Anon Key
            </label>
            <input
              type="password"
              value={anonKey}
              onChange={(e) => setAnonKey(e.target.value)}
              placeholder="eyJhbGciOiJI..."
              className={`${inputClasses} font-mono`}
              style={inputStyle}
            />
          </div>
        </>
      ) : (
        <div
          className="flex flex-col gap-3 p-4 rounded-lg"
          style={{ background: 'var(--surface-1)', border: '1px solid var(--border-subtle)' }}
        >
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            Provision a local PostgreSQL database for your project.
          </p>
          <button
            onClick={handleProvision}
            disabled={provisioning}
            className="px-4 py-2 rounded-lg text-sm font-medium text-white transition-all duration-150 hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed self-start"
            style={{ background: 'var(--accent)' }}
          >
            {provisioning ? 'Provisioning...' : 'Provision Database'}
          </button>
        </div>
      )}

      {/* Connection status */}
      <div
        className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg"
        style={{ background: 'var(--surface-1)', border: '1px solid var(--border-subtle)' }}
      >
        <span
          className="w-2.5 h-2.5 rounded-full shrink-0"
          style={{ background: connected ? 'var(--success)' : 'var(--error)', boxShadow: connected ? '0 0 6px var(--success-border)' : 'none' }}
        />
        <span className="text-sm font-medium" style={{ color: connected ? 'var(--success)' : 'var(--text-secondary)' }}>
          {connected ? 'Connected' : 'Not connected'}
        </span>
      </div>

      {/* Save */}
      {provider === 'supabase' && (
        <div className="flex justify-end pt-2">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-5 py-2 rounded-lg text-sm font-medium text-white transition-all duration-150 hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ background: 'var(--accent)' }}
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      )}
    </div>
  );
};
