import { useState, useCallback, useRef } from 'react';
import { Spinner, internalPost } from './shared';

interface Props {
  schema: string;
  chatId: string;
}

export const SqlEditorSection = ({ schema }: Props) => {
  const [sql, setSql] = useState(
    `-- Schema: ${schema}\n-- Ctrl+Enter to run\n\nSELECT * FROM information_schema.tables WHERE table_schema = '${schema}';\n`,
  );
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
      <div className="p-6 flex flex-col gap-2" style={{ flex: '1 1 0', minHeight: 0 }}>
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>SQL editor</h3>
            <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>schema: {schema}</p>
          </div>
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
              {running ? 'Running...' : 'Run'}
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
      <div className="flex flex-col gap-2 px-6 py-3" style={{ borderTop: '1px solid var(--border-subtle)', background: 'var(--surface-1)' }}>
        <p className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>Results</p>
        {error && (
          <div
            className="text-xs font-mono p-2.5 rounded-lg whitespace-pre-wrap"
            style={{ background: 'var(--error-muted)', border: '1px solid var(--error-border)', color: 'var(--error)' }}
          >
            {error}
          </div>
        )}
        {result && result.rows.length === 0 && <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>0 rows returned</p>}
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
