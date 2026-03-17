import { useState, useEffect, useCallback } from 'react';
import { type TableRow, Spinner, EmptyState, internalPost } from './shared';

interface Props {
  schema: string;
  chatId: string;
}

export const DatabaseSection = ({ schema }: Props) => {
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
    <div className="flex flex-col gap-3 p-6">
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
