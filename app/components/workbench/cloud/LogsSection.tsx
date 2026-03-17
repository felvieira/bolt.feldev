import { useState, useEffect, useCallback } from 'react';
import { type LogRow, Spinner, EmptyState, internalPost } from './shared';

interface Props {
  schema: string;
  chatId: string;
}

export const LogsSection = ({ schema }: Props) => {
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<string>('all');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const body: any = { schema };
      if (filter !== 'all') body.level = filter;
      const res = await internalPost('/api/backend/logs', body);
      if (res.ok) setLogs((await res.json()).logs ?? []);
    } finally { setLoading(false); }
  }, [schema, filter]);

  useEffect(() => { load(); }, [load]);

  const levelColor = (level: string) => {
    switch (level) {
      case 'error': return 'var(--error)';
      case 'warn': return 'var(--warning)';
      case 'info': return 'var(--accent)';
      default: return 'var(--text-tertiary)';
    }
  };

  return (
    <div className="flex flex-col gap-3 p-6 h-full">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Logs</h3>
        <div className="flex items-center gap-2">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="text-xs px-2 py-1 rounded-md focus:outline-none"
            style={{ background: 'var(--surface-2)', border: '1px solid var(--border-default)', color: 'var(--text-secondary)' }}
          >
            <option value="all">All levels</option>
            <option value="error">Errors</option>
            <option value="warn">Warnings</option>
            <option value="info">Info</option>
            <option value="debug">Debug</option>
          </select>
          <button onClick={load} className="w-6 h-6 flex items-center justify-center rounded"
            style={{ background: 'var(--surface-2)', color: 'var(--text-secondary)' }}>
            <div className="i-ph:arrow-clockwise text-sm" />
          </button>
        </div>
      </div>
      {loading ? <Spinner /> : logs.length === 0 ? (
        <EmptyState icon="i-ph:list-bullets" message="No logs yet. App activity will appear here." />
      ) : (
        <div className="flex flex-col gap-0.5 overflow-y-auto flex-1 font-mono text-xs">
          {logs.map((log) => (
            <div key={log.id} className="flex gap-2 px-2 py-1.5 rounded transition-colors" style={{ ['--tw-bg-opacity' as any]: 0 }}>
              <span className="shrink-0 w-16 text-right" style={{ color: 'var(--text-tertiary)' }}>
                {new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
              <span
                className="shrink-0 w-12 text-center px-1 py-0.5 rounded text-[10px] font-semibold uppercase"
                style={{ color: levelColor(log.level), background: `color-mix(in srgb, ${levelColor(log.level)} 10%, transparent)` }}
              >
                {log.level}
              </span>
              {log.source && (
                <span className="shrink-0 text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'var(--surface-3)', color: 'var(--text-tertiary)' }}>
                  {log.source}
                </span>
              )}
              <span className="flex-1 break-all" style={{ color: 'var(--text-primary)' }}>
                {log.message}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
