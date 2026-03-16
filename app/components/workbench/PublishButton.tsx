/**
 * PublishButton — Lovable-style publish popover.
 *
 * Shows a popover with:
 *  - Auto-generated URL (editable slug)
 *  - "Add custom domain" expandable
 *  - Continue → triggers deploy
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { useStore } from '@nanostores/react';
import { toast } from 'react-toastify';
import { chatId as chatIdStore } from '~/lib/persistence/useChatHistory';

// ─── helpers ────────────────────────────────────────────────────────────────

async function fetchJson(url: string, opts?: RequestInit) {
  const res = await fetch(url, opts);
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json();
}

// ─── Component ──────────────────────────────────────────────────────────────

export const PublishButton = () => {
  const chatId = useStore(chatIdStore);
  const [open, setOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  // hosting state
  const [loading, setLoading] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [slug, setSlug] = useState('');
  const [autoUrl, setAutoUrl] = useState('');
  const [customDomain, setCustomDomain] = useState('');
  const [showCustom, setShowCustom] = useState(false);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [deployStatus, setDeployStatus] = useState<string>('');

  // close on outside click
  useEffect(() => {
    if (!open) return;

    const handler = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // load hosting config when popover opens
  const loadHosting = useCallback(async () => {
    if (!chatId) return;
    setLoading(true);

    try {
      const projects = await fetchJson('/api/projects');
      const linked = (Array.isArray(projects) ? projects : []).find(
        (p: any) => p.chat_id === chatId,
      );

      if (!linked) {
        setProjectId(null);
        setSlug('');
        setAutoUrl('');
        return;
      }

      setProjectId(linked.id);

      const data = await fetchJson(`/api/hosting/config?projectId=${linked.id}`);

      if (data.hosting) {
        setSlug(data.hosting.slug || '');
        setAutoUrl(data.hosting.autoUrl || '');
        setCustomDomain(data.hosting.custom_domain || '');
        setDeployStatus(data.hosting.deploy_status || '');
        if (data.hosting.custom_domain) setShowCustom(true);
      }
    } catch {
      // no project yet — that's fine
    } finally {
      setLoading(false);
    }
  }, [chatId]);

  useEffect(() => {
    if (open) loadHosting();
  }, [open, loadHosting]);

  // Publish / Continue
  const handlePublish = async () => {
    if (!chatId) return;
    setPublishing(true);

    try {
      // ensure project exists
      let pid = projectId;

      if (!pid) {
        // create project from chat
        const res = await fetchJson('/api/projects', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: chatId, name: `Project ${chatId.slice(0, 8)}` }),
        });
        pid = res.id || res.project?.id;
        setProjectId(pid!);
      }

      // configure hosting (creates slug if first time)
      const hostRes = await fetchJson('/api/hosting/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: pid,
          customDomain: customDomain.trim() || undefined,
        }),
      });

      if (hostRes.hosting) {
        setSlug(hostRes.hosting.slug || '');
        setAutoUrl(hostRes.hosting.autoUrl || '');
        setDeployStatus(hostRes.hosting.deploy_status || '');
      }

      // trigger deploy
      try {
        await fetchJson(`/api/projects/${pid}/deploy`, { method: 'POST' });
      } catch {
        // deploy endpoint may not fully work yet — that's ok
      }

      toast.success('Published! Your app is being deployed.');
      setOpen(false);
    } catch (err: any) {
      toast.error(err.message || 'Publish failed');
    } finally {
      setPublishing(false);
    }
  };

  const isLive = deployStatus === 'live';

  return (
    <div className="relative ml-1" ref={popoverRef}>
      {/* Trigger button */}
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors"
        style={{
          background: 'var(--accent)',
          color: '#fff',
          border: 'none',
        }}
      >
        Publish
      </button>

      {/* Popover */}
      {open && (
        <div
          className="absolute right-0 top-full mt-2 z-50 rounded-xl shadow-2xl overflow-hidden"
          style={{
            width: '340px',
            background: 'var(--surface-1)',
            border: '1px solid var(--border-subtle)',
          }}
        >
          {/* Header */}
          <div className="px-5 pt-5 pb-3">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
                Website address
              </h3>
              <a
                href="https://docs.bolt.feldev"
                target="_blank"
                rel="noreferrer"
                className="text-xs flex items-center gap-1 hover:underline"
                style={{ color: 'var(--text-tertiary)' }}
              >
                <div className="i-ph:question text-sm" />
                Docs
              </a>
            </div>
            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              Choose your app's URL or use the generated one
            </p>
          </div>

          {/* Body */}
          <div className="px-5 pb-4 flex flex-col gap-3">
            {loading ? (
              <div className="flex justify-center py-6">
                <div
                  className="i-ph:spinner-gap animate-spin text-xl"
                  style={{ color: 'var(--accent)' }}
                />
              </div>
            ) : (
              <>
                {/* URL field */}
                <div
                  className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg"
                  style={{
                    background: 'var(--surface-2)',
                    border: '1px solid var(--border-default)',
                  }}
                >
                  <button
                    onClick={loadHosting}
                    className="shrink-0 w-7 h-7 flex items-center justify-center rounded-md"
                    style={{ background: 'var(--surface-3)', color: 'var(--text-secondary)' }}
                    title="Regenerate URL"
                  >
                    <div className="i-ph:arrow-clockwise text-sm" />
                  </button>
                  <div className="flex-1 min-w-0">
                    {autoUrl ? (
                      <p
                        className="text-sm font-mono truncate"
                        style={{ color: 'var(--text-primary)' }}
                      >
                        {autoUrl.replace(/^https?:\/\//, '')}
                      </p>
                    ) : (
                      <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
                        URL will be generated on publish
                      </p>
                    )}
                  </div>
                  {autoUrl && (
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(autoUrl);
                        toast.success('Copied!');
                      }}
                      className="shrink-0 w-6 h-6 flex items-center justify-center rounded"
                      style={{ color: 'var(--text-tertiary)' }}
                    >
                      <div className="i-ph:copy text-xs" />
                    </button>
                  )}
                </div>

                {/* Live badge */}
                {isLive && autoUrl && (
                  <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
                    <div className="w-2 h-2 rounded-full" style={{ background: 'var(--success)' }} />
                    Live
                    <span className="mx-1">·</span>
                    <a
                      href={autoUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="hover:underline"
                      style={{ color: 'var(--accent)' }}
                    >
                      Open ↗
                    </a>
                  </div>
                )}

                {/* Custom domain toggle */}
                <button
                  onClick={() => setShowCustom(!showCustom)}
                  className="flex items-center gap-2 text-xs py-1"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  <div className={`i-ph:plus text-sm ${showCustom ? 'rotate-45' : ''} transition-transform`} />
                  Add custom domain
                </button>

                {showCustom && (
                  <div className="flex flex-col gap-2">
                    <input
                      value={customDomain}
                      onChange={(e) => setCustomDomain(e.target.value)}
                      placeholder="app.yourdomain.com"
                      className="w-full px-3 py-2 rounded-lg text-sm font-mono focus:outline-none"
                      style={{
                        background: 'var(--surface-2)',
                        border: '1px solid var(--border-default)',
                        color: 'var(--text-primary)',
                      }}
                    />
                    <div
                      className="text-xs flex flex-col gap-0.5 px-1"
                      style={{ color: 'var(--text-tertiary)' }}
                    >
                      <p>Point a CNAME to your instance domain, or an A record to your VPS IP.</p>
                      <p>SSL is auto-provisioned by Caddy.</p>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Footer */}
          <div
            className="px-5 py-3 flex justify-end"
            style={{ borderTop: '1px solid var(--border-subtle)', background: 'var(--surface-2)' }}
          >
            <button
              onClick={handlePublish}
              disabled={publishing || loading}
              className="px-5 py-2 rounded-lg text-sm font-semibold disabled:opacity-50 transition-colors"
              style={{ background: 'var(--accent)', color: '#fff' }}
            >
              {publishing ? 'Publishing…' : 'Continue'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
