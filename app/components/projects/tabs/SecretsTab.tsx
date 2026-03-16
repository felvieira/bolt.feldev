import { useState, useEffect } from 'react';
import { Plus, Trash2 } from 'lucide-react';

interface Secret {
  key: string;
  value: string;
}

interface SecretsTabProps {
  projectId: string;
}

export const SecretsTab = ({ projectId }: SecretsTabProps) => {
  const [secrets, setSecrets] = useState<Secret[]>([]);
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');
  const [loading, setLoading] = useState(true);

  const loadSecrets = async () => {
    setLoading(true);

    try {
      const res = await fetch(`/api/projects/${projectId}/secrets`);

      if (res.ok) {
        setSecrets(await res.json());
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSecrets();
  }, [projectId]);

  const handleAdd = async () => {
    if (!newKey.trim()) {
      return;
    }

    const res = await fetch(`/api/projects/${projectId}/secrets`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: newKey, value: newValue }),
    });

    if (res.ok) {
      setSecrets((prev) => [...prev.filter((s) => s.key !== newKey), { key: newKey, value: newValue }]);
      setNewKey('');
      setNewValue('');
    }
  };

  const handleDelete = async (key: string) => {
    const res = await fetch(`/api/projects/${projectId}/secrets/${encodeURIComponent(key)}`, {
      method: 'DELETE',
    });

    if (res.ok) {
      setSecrets((prev) => prev.filter((s) => s.key !== key));
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
      {/* Info */}
      <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
        Environment variables and secrets for your project. Values are encrypted at rest.
      </p>

      {/* Secrets table */}
      <div
        className="rounded-lg overflow-hidden"
        style={{ border: '1px solid var(--border-subtle)' }}
      >
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: 'var(--surface-1)' }}>
              <th className="text-left px-4 py-2.5 font-medium text-xs uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>
                Key
              </th>
              <th className="text-left px-4 py-2.5 font-medium text-xs uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>
                Value
              </th>
              <th className="w-12" />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={3} className="px-4 py-8 text-center" style={{ color: 'var(--text-tertiary)' }}>
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    Loading secrets...
                  </div>
                </td>
              </tr>
            ) : secrets.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-4 py-8 text-center" style={{ color: 'var(--text-tertiary)' }}>
                  No secrets yet. Add your first one below.
                </td>
              </tr>
            ) : (
              secrets.map((secret) => (
                <tr
                  key={secret.key}
                  className="transition-colors duration-100 hover:bg-[var(--surface-3)]"
                  style={{ borderTop: '1px solid var(--border-subtle)' }}
                >
                  <td className="px-4 py-2.5 font-mono text-xs" style={{ color: 'var(--text-primary)' }}>
                    {secret.key}
                  </td>
                  <td className="px-4 py-2.5 font-mono text-xs" style={{ color: 'var(--text-tertiary)' }}>
                    {'••••••••••••'}
                  </td>
                  <td className="px-4 py-2.5">
                    <button
                      onClick={() => handleDelete(secret.key)}
                      className="p-1.5 rounded-md transition-all duration-150 hover:bg-red-500/10"
                      style={{ color: 'var(--text-tertiary)' }}
                      onMouseEnter={(e) => {
                        (e.currentTarget as HTMLElement).style.color = '#ef4444';
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLElement).style.color = 'var(--text-tertiary)';
                      }}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Add secret form */}
      <div className="flex gap-3 items-end">
        <div className="flex flex-col gap-1.5 flex-1">
          <label className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
            Key
          </label>
          <input
            type="text"
            value={newKey}
            onChange={(e) => setNewKey(e.target.value)}
            placeholder="SECRET_KEY"
            className={`${inputClasses} font-mono`}
            style={inputStyle}
          />
        </div>
        <div className="flex flex-col gap-1.5 flex-1">
          <label className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
            Value
          </label>
          <input
            type="password"
            value={newValue}
            onChange={(e) => setNewValue(e.target.value)}
            placeholder="secret_value"
            className={inputClasses}
            style={inputStyle}
          />
        </div>
        <button
          onClick={handleAdd}
          disabled={!newKey.trim()}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium text-white transition-all duration-150 hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
          style={{ background: 'var(--accent)' }}
        >
          <Plus className="w-4 h-4" />
          Add
        </button>
      </div>
    </div>
  );
};
