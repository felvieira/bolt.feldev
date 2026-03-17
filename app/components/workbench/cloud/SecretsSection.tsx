import { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-toastify';
import { type SecretRow, Spinner, EmptyState, internalPost } from './shared';

interface Props {
  schema: string;
  chatId: string;
}

export const SecretsSection = ({ schema }: Props) => {
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
      const res = await fetch('/api/backend/secrets', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ schema, secrets: [{ name: newKey, value: newVal }] }),
      });
      if (res.ok) { toast.success('Secret saved!'); setNewKey(''); setNewVal(''); load(); }
      else toast.error('Failed to save');
    } finally { setAdding(false); }
  };

  const handleDelete = async (name: string) => {
    await fetch('/api/backend/secrets', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ schema, name }),
    });
    load();
  };

  return (
    <div className="flex flex-col gap-3 p-6">
      <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Secrets</h3>
      <div className="flex flex-col gap-2 p-3 rounded-lg" style={{ background: 'var(--surface-2)', border: '1px solid var(--border-subtle)' }}>
        <p className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>Add / update</p>
        <input
          placeholder="SECRET_NAME"
          value={newKey}
          onChange={e => setNewKey(e.target.value.toUpperCase().replace(/\s/g, '_'))}
          className="px-2.5 py-1.5 rounded-lg text-xs font-mono focus:outline-none"
          style={{ background: 'var(--surface-1)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }}
        />
        <input
          placeholder="value"
          type="password"
          value={newVal}
          onChange={e => setNewVal(e.target.value)}
          className="px-2.5 py-1.5 rounded-lg text-xs focus:outline-none"
          style={{ background: 'var(--surface-1)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }}
        />
        <button
          onClick={handleAdd}
          disabled={adding || !newKey || !newVal}
          className="py-1.5 rounded-lg text-xs font-medium disabled:opacity-50"
          style={{ background: 'var(--accent)', color: '#fff' }}
        >
          {adding ? 'Saving...' : 'Save secret'}
        </button>
      </div>
      {loading ? <Spinner /> : secrets.length === 0 ? <EmptyState icon="i-ph:key" message="No secrets yet" /> : (
        <div className="flex flex-col gap-1">
          {secrets.map(s => (
            <div key={s.name} className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm group" style={{ background: 'var(--surface-2)', border: '1px solid var(--border-subtle)' }}>
              <div className="i-ph:key text-sm shrink-0" style={{ color: 'var(--accent)' }} />
              <span className="flex-1 font-mono text-xs" style={{ color: 'var(--text-primary)' }}>{s.name}</span>
              <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>--------</span>
              <button
                onClick={() => handleDelete(s.name)}
                className="ml-2 w-5 h-5 flex items-center justify-center rounded opacity-0 group-hover:opacity-100 transition-opacity"
                style={{ color: 'var(--error)' }}
                title="Delete"
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
