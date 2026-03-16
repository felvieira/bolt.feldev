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

  return (
    <div className="flex flex-col gap-6">
      {/* Provider toggle */}
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
          Provider
        </label>
        <div className="flex gap-2">
          {(['supabase', 'local'] as const).map((p) => (
            <button
              key={p}
              onClick={() => setProvider(p)}
              className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              style={{
                background: provider === p ? 'var(--accent)' : 'var(--surface-2)',
                color: provider === p ? '#fff' : 'var(--text-secondary)',
                border: `1px solid ${provider === p ? 'var(--accent)' : 'var(--border-subtle)'}`,
              }}
            >
              {p === 'supabase' ? 'Supabase Cloud' : 'Local PostgreSQL'}
            </button>
          ))}
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
              className="w-full px-3 py-2 rounded-lg text-sm outline-none"
              style={{
                background: 'var(--surface-2)',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-primary)',
              }}
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
              className="w-full px-3 py-2 rounded-lg text-sm outline-none"
              style={{
                background: 'var(--surface-2)',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-primary)',
              }}
            />
          </div>
        </>
      ) : (
        <div className="flex flex-col gap-3">
          <button
            onClick={handleProvision}
            disabled={provisioning}
            className="px-4 py-2 rounded-lg text-sm font-medium text-white transition-opacity disabled:opacity-50 self-start"
            style={{ background: 'var(--accent)' }}
          >
            {provisioning ? 'Provisioning...' : 'Provision Database'}
          </button>
        </div>
      )}

      {/* Connection status */}
      <div className="flex items-center gap-2">
        <span
          className="w-2.5 h-2.5 rounded-full"
          style={{ background: connected ? '#22c55e' : '#ef4444' }}
        />
        <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          {connected ? 'Connected' : 'Not connected'}
        </span>
      </div>

      {/* Save */}
      {provider === 'supabase' && (
        <div className="flex justify-end">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 rounded-lg text-sm font-medium text-white transition-opacity disabled:opacity-50"
            style={{ background: 'var(--accent)' }}
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      )}
    </div>
  );
};
