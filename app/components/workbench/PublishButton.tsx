/**
 * PublishButton — Lovable-style publish popover with real deploy flow.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { useStore } from '@nanostores/react';
import { toast } from 'react-toastify';
import { chatId as chatIdStore } from '~/lib/persistence/useChatHistory';
import { workbenchStore } from '~/lib/stores/workbench';
import { webcontainer } from '~/lib/webcontainer';
import { path } from '~/utils/path';

type DeployPhase = 'idle' | 'collecting' | 'building' | 'deploying' | 'live' | 'error';

async function fetchJson(url: string, opts?: RequestInit) {
  const res = await fetch(url, opts);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

/** Recursively collect all project files from WebContainer */
async function collectProjectFiles(): Promise<Record<string, string>> {
  const container = await webcontainer;
  const files: Record<string, string> = {};

  async function walk(dirPath: string, basePath: string = '') {
    const entries = await container.fs.readdir(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      const relativePath = basePath ? `${basePath}/${entry.name}` : entry.name;

      // Skip heavy/irrelevant dirs
      if (entry.isDirectory() && ['node_modules', '.git', 'dist', 'build', '.cache', '.next', '.turbo'].includes(entry.name)) continue;

      if (entry.isFile()) {
        if (['.DS_Store', '.log'].some(ext => entry.name.endsWith(ext)) || entry.name.startsWith('.env')) continue;
        try {
          files[relativePath] = await container.fs.readFile(fullPath, 'utf-8');
        } catch { continue; }
      } else if (entry.isDirectory()) {
        await walk(fullPath, relativePath);
      }
    }
  }

  await walk('/');
  return files;
}

const PHASE_LABELS: Record<DeployPhase, string> = {
  idle: '',
  collecting: 'Collecting files…',
  building: 'Building project…',
  deploying: 'Deploying…',
  live: 'Live!',
  error: 'Deploy failed',
};

const PHASE_ICONS: Record<DeployPhase, string> = {
  idle: '',
  collecting: 'i-ph:folder-open',
  building: 'i-ph:hammer',
  deploying: 'i-ph:rocket-launch',
  live: 'i-ph:check-circle-fill',
  error: 'i-ph:warning-circle',
};

export const PublishButton = () => {
  const chatId = useStore(chatIdStore);
  const [open, setOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  const [loading, setLoading] = useState(false);
  const [phase, setPhase] = useState<DeployPhase>('idle');
  const [slug, setSlug] = useState('');
  const [autoUrl, setAutoUrl] = useState('');
  const [customDomain, setCustomDomain] = useState('');
  const [showCustom, setShowCustom] = useState(false);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [deployError, setDeployError] = useState('');
  const [deployLogs, setDeployLogs] = useState('');
  const [showLogs, setShowLogs] = useState(false);
  const [fileCount, setFileCount] = useState(0);

  // Outside click close
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        if (phase === 'idle' || phase === 'live' || phase === 'error') setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open, phase]);

  // Load hosting on open
  const loadHosting = useCallback(async () => {
    if (!chatId) return;
    setLoading(true);
    try {
      const projects = await fetchJson('/api/projects');
      const linked = (Array.isArray(projects) ? projects : []).find((p: any) => p.chat_id === chatId);
      if (!linked) { setProjectId(null); setSlug(''); setAutoUrl(''); return; }
      setProjectId(linked.id);
      const data = await fetchJson(`/api/hosting/config?projectId=${linked.id}`);
      if (data.hosting) {
        setSlug(data.hosting.slug || '');
        setAutoUrl(data.hosting.autoUrl || '');
        setCustomDomain(data.hosting.custom_domain || '');
        if (data.hosting.deploy_status === 'live') setPhase('live');
        if (data.hosting.custom_domain) setShowCustom(true);
      }
    } catch { /* no project */ }
    finally { setLoading(false); }
  }, [chatId]);

  useEffect(() => { if (open) { setPhase('idle'); setDeployError(''); setDeployLogs(''); loadHosting(); } }, [open, loadHosting]);

  // PUBLISH FLOW
  const handlePublish = async () => {
    if (!chatId) return;
    setDeployError('');
    setDeployLogs('');

    try {
      // 1. Ensure project
      let pid = projectId;
      if (!pid) {
        setPhase('collecting');
        const res = await fetchJson('/api/projects', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: chatId, name: `Project ${chatId.slice(0, 8)}` }),
        });
        pid = res.id || res.project?.id;
        setProjectId(pid!);
      }

      // 2. Configure hosting
      const hostRes = await fetchJson('/api/hosting/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: pid, customDomain: customDomain.trim() || undefined }),
      });
      if (hostRes.hosting) {
        setSlug(hostRes.hosting.slug || '');
        setAutoUrl(hostRes.hosting.autoUrl || '');
      }

      // 3. Collect files
      setPhase('collecting');
      const files = await collectProjectFiles();
      setFileCount(Object.keys(files).length);

      // 4. Build
      setPhase('building');
      const deployRes = await fetchJson(`/api/projects/${pid}/deploy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ files }),
      });

      if (deployRes.success) {
        setPhase('live');
        if (deployRes.url) setAutoUrl(deployRes.url);
        toast.success('Published successfully!');
      } else {
        throw new Error(deployRes.error || 'Deploy failed');
      }
    } catch (err: any) {
      setPhase('error');
      setDeployError(err.message || 'Unknown error');
      setDeployLogs(err.logs || '');
    }
  };

  const isPublishing = ['collecting', 'building', 'deploying'].includes(phase);

  return (
    <div className="relative ml-1" ref={popoverRef}>
      {/* Trigger */}
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all"
        style={{
          background: phase === 'live' ? 'var(--success)' : 'var(--accent)',
          color: '#fff',
        }}
      >
        {phase === 'live' && <div className="i-ph:check-circle-fill text-sm" />}
        {phase === 'live' ? 'Live' : 'Publish'}
      </button>

      {/* Popover */}
      {open && (
        <div
          className="absolute right-0 top-full mt-2 z-50 rounded-xl overflow-hidden"
          style={{
            width: '360px',
            background: 'var(--surface-1)',
            border: '1px solid var(--border-subtle)',
            boxShadow: 'var(--shadow-popover)',
          }}
        >
          {/* Header */}
          <div className="px-5 pt-5 pb-3">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
                Website address
              </h3>
              <a href="https://docs.bolt.feldev" target="_blank" rel="noreferrer"
                className="text-xs flex items-center gap-1 hover:underline"
                style={{ color: 'var(--text-tertiary)' }}>
                <div className="i-ph:question text-sm" /> Docs
              </a>
            </div>
            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              Choose your app's URL or use the generated one
            </p>
          </div>

          <div className="px-5 pb-4 flex flex-col gap-3">
            {loading ? (
              <div className="flex justify-center py-6">
                <div className="i-ph:spinner-gap animate-spin text-xl" style={{ color: 'var(--accent)' }} />
              </div>
            ) : (
              <>
                {/* URL field */}
                <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg"
                  style={{ background: 'var(--surface-2)', border: '1px solid var(--border-default)' }}>
                  <button onClick={loadHosting}
                    className="shrink-0 w-7 h-7 flex items-center justify-center rounded-md"
                    style={{ background: 'var(--surface-3)', color: 'var(--text-secondary)' }}
                    title="Refresh">
                    <div className="i-ph:arrow-clockwise text-sm" />
                  </button>
                  <div className="flex-1 min-w-0">
                    {autoUrl ? (
                      <p className="text-sm font-mono truncate" style={{ color: 'var(--text-primary)' }}>
                        {autoUrl.replace(/^https?:\/\//, '')}
                      </p>
                    ) : (
                      <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
                        URL will be generated on publish
                      </p>
                    )}
                  </div>
                  {autoUrl && (
                    <button onClick={() => { navigator.clipboard.writeText(autoUrl); toast.success('Copied!'); }}
                      className="shrink-0 w-6 h-6 flex items-center justify-center rounded"
                      style={{ color: 'var(--text-tertiary)' }}>
                      <div className="i-ph:copy text-xs" />
                    </button>
                  )}
                </div>

                {/* Live badge */}
                {phase === 'live' && autoUrl && (
                  <div className="flex items-center gap-2 px-1">
                    <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: 'var(--success)' }} />
                    <span className="text-xs font-medium" style={{ color: 'var(--success)' }}>Live</span>
                    <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>·</span>
                    <a href={autoUrl} target="_blank" rel="noreferrer"
                      className="text-xs hover:underline" style={{ color: 'var(--accent)' }}>
                      Open ↗
                    </a>
                  </div>
                )}

                {/* Deploy progress */}
                {isPublishing && (
                  <div className="flex flex-col gap-2 p-3 rounded-lg" style={{ background: 'var(--surface-2)', border: '1px solid var(--border-subtle)' }}>
                    <div className="flex items-center gap-2">
                      <div className={`${PHASE_ICONS[phase]} text-base animate-pulse`} style={{ color: 'var(--accent)' }} />
                      <span className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>
                        {PHASE_LABELS[phase]}
                      </span>
                      {phase === 'collecting' && fileCount > 0 && (
                        <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>({fileCount} files)</span>
                      )}
                    </div>
                    {/* Progress bar */}
                    <div className="h-1 rounded-full overflow-hidden" style={{ background: 'var(--surface-3)' }}>
                      <div
                        className="h-full rounded-full transition-all duration-1000"
                        style={{
                          background: 'var(--accent)',
                          width: phase === 'collecting' ? '25%' : phase === 'building' ? '60%' : phase === 'deploying' ? '85%' : '100%',
                        }}
                      />
                    </div>
                  </div>
                )}

                {/* Error state */}
                {phase === 'error' && (
                  <div className="flex flex-col gap-2 p-3 rounded-lg" style={{ background: 'var(--error-muted)', border: '1px solid var(--error-border)' }}>
                    <div className="flex items-center gap-2">
                      <div className="i-ph:warning-circle text-base" style={{ color: 'var(--error)' }} />
                      <span className="text-xs font-medium" style={{ color: 'var(--error)' }}>
                        {deployError || 'Deploy failed'}
                      </span>
                    </div>
                    {deployLogs && (
                      <>
                        <button onClick={() => setShowLogs(!showLogs)} className="text-xs hover:underline text-left" style={{ color: 'var(--text-tertiary)' }}>
                          {showLogs ? 'Hide' : 'Show'} logs
                        </button>
                        {showLogs && (
                          <pre className="text-xs font-mono p-2 rounded overflow-auto max-h-32" style={{ background: 'var(--surface-1)', color: 'var(--text-secondary)' }}>
                            {deployLogs}
                          </pre>
                        )}
                      </>
                    )}
                  </div>
                )}

                {/* Custom domain */}
                {!isPublishing && (
                  <>
                    <button onClick={() => setShowCustom(!showCustom)}
                      className="flex items-center gap-2 text-xs py-1"
                      style={{ color: 'var(--text-secondary)' }}>
                      <div className={`i-ph:plus text-sm ${showCustom ? 'rotate-45' : ''} transition-transform`} />
                      Add custom domain
                    </button>
                    {showCustom && (
                      <div className="flex flex-col gap-2">
                        <input value={customDomain} onChange={(e) => setCustomDomain(e.target.value)}
                          placeholder="app.yourdomain.com"
                          className="w-full px-3 py-2 rounded-lg text-sm font-mono focus:outline-none"
                          style={{ background: 'var(--surface-2)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }} />
                        <p className="text-xs px-1" style={{ color: 'var(--text-tertiary)' }}>
                          Point CNAME to your instance domain. SSL auto-provisioned.
                        </p>
                      </div>
                    )}
                  </>
                )}
              </>
            )}
          </div>

          {/* Footer */}
          <div className="px-5 py-3 flex items-center justify-between"
            style={{ borderTop: '1px solid var(--border-subtle)', background: 'var(--surface-2)' }}>
            {phase === 'live' ? (
              <p className="text-xs" style={{ color: 'var(--success)' }}>
                ✓ Your app is live
              </p>
            ) : phase === 'error' ? (
              <p className="text-xs" style={{ color: 'var(--error)' }}>Deploy failed</p>
            ) : (
              <div />
            )}
            <button
              onClick={phase === 'error' ? handlePublish : phase === 'live' ? () => setOpen(false) : handlePublish}
              disabled={isPublishing || loading}
              className="px-5 py-2 rounded-lg text-sm font-semibold disabled:opacity-50 transition-all"
              style={{
                background: phase === 'live' ? 'var(--surface-3)' : 'var(--accent)',
                color: phase === 'live' ? 'var(--text-primary)' : '#fff',
              }}
            >
              {isPublishing ? 'Publishing…' : phase === 'live' ? 'Done' : phase === 'error' ? 'Retry' : 'Continue'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
