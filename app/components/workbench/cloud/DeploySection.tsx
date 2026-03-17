import { useState, useEffect, useCallback } from 'react';
import { useStore } from '@nanostores/react';
import { toast } from 'react-toastify';
import { chatId as chatIdStore } from '~/lib/persistence/useChatHistory';
import { Spinner, EmptyState } from './shared';

interface Props {
  schema: string;
  chatId: string;
}

export const DeploySection = (_props: Props) => {
  const chatId = useStore(chatIdStore);
  const [loading, setLoading] = useState(false);
  const [hosting, setHosting] = useState<{
    slug?: string;
    autoUrl?: string;
    customUrl?: string;
    customDomain?: string;
    deploy_status?: string;
  } | null>(null);
  const [customDomain, setCustomDomain] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!chatId) return;
    setLoading(true);
    try {
      const projRes = await fetch('/api/projects');
      if (projRes.ok) {
        const projects = await projRes.json();
        const linked = (Array.isArray(projects) ? projects : []).find((p: any) => p.chat_id === chatId);
        if (linked) {
          const hostRes = await fetch(`/api/hosting/config?projectId=${linked.id}`);
          if (hostRes.ok) {
            const data = await hostRes.json();
            setHosting(data.hosting);
            setCustomDomain(data.hosting?.custom_domain || '');
          }
        }
      }
    } finally { setLoading(false); }
  }, [chatId]);

  useEffect(() => { load(); }, [load]);

  const handleSetup = async () => {
    if (!chatId) return;
    setSaving(true);
    try {
      const projRes = await fetch('/api/projects');
      const projects = await projRes.json();
      const linked = (Array.isArray(projects) ? projects : []).find((p: any) => p.chat_id === chatId);
      if (!linked) {
        toast.error('Convert this chat to a project first (header button)');
        return;
      }
      const res = await fetch('/api/hosting/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: linked.id,
          customDomain: customDomain.trim() || undefined,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setHosting(data.hosting);
        toast.success('Hosting configured!');
      }
    } finally { setSaving(false); }
  };

  const handleSaveDomain = async () => {
    if (!chatId) return;
    setSaving(true);
    try {
      const projRes = await fetch('/api/projects');
      const projects = await projRes.json();
      const linked = (Array.isArray(projects) ? projects : []).find((p: any) => p.chat_id === chatId);
      if (!linked) return;
      const res = await fetch('/api/hosting/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: linked.id,
          customDomain: customDomain.trim() || null,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setHosting(data.hosting);
        toast.success('Domain updated!');
      }
    } finally { setSaving(false); }
  };

  return (
    <div className="flex flex-col gap-4 p-6">
      <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
        Deploy & Domain
      </h3>

      {loading ? <Spinner /> : !hosting ? (
        <div className="flex flex-col gap-3">
          <EmptyState icon="i-ph:globe" message="No hosting configured yet. Set up hosting to get a public URL." />
          <button
            onClick={handleSetup}
            disabled={saving}
            className="py-2 rounded-lg text-sm font-medium disabled:opacity-50"
            style={{ background: 'var(--accent)', color: '#fff' }}
          >
            {saving ? 'Setting up...' : 'Set up hosting'}
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {/* Auto-generated URL */}
          <div className="rounded-lg p-4" style={{ background: 'var(--surface-2)', border: '1px solid var(--border-subtle)' }}>
            <p className="text-xs font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
              App URL (auto-generated)
            </p>
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full" style={{ background: hosting.deploy_status === 'live' ? 'var(--success)' : 'var(--warning)' }} />
              <a
                href={hosting.autoUrl}
                target="_blank"
                rel="noreferrer"
                className="text-sm font-mono hover:underline truncate"
                style={{ color: 'var(--accent)' }}
              >
                {hosting.autoUrl}
              </a>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(hosting.autoUrl || '');
                  toast.success('URL copied!');
                }}
                className="shrink-0 w-6 h-6 flex items-center justify-center rounded"
                style={{ background: 'var(--surface-3)', color: 'var(--text-secondary)' }}
              >
                <div className="i-ph:copy text-xs" />
              </button>
            </div>
            <p className="text-xs mt-1.5" style={{ color: 'var(--text-tertiary)' }}>
              slug: <code className="font-mono">{hosting.slug}</code>
            </p>
          </div>

          {/* Custom domain */}
          <div className="rounded-lg p-4" style={{ background: 'var(--surface-2)', border: '1px solid var(--border-subtle)' }}>
            <p className="text-xs font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
              Custom domain (optional)
            </p>
            <div className="flex gap-2">
              <input
                value={customDomain}
                onChange={(e) => setCustomDomain(e.target.value)}
                placeholder="app.yourdomain.com"
                className="flex-1 px-3 py-1.5 rounded-lg text-sm font-mono focus:outline-none"
                style={{
                  background: 'var(--surface-1)',
                  border: '1px solid var(--border-default)',
                  color: 'var(--text-primary)',
                }}
              />
              <button
                onClick={handleSaveDomain}
                disabled={saving}
                className="px-3 py-1.5 rounded-lg text-xs font-medium disabled:opacity-50"
                style={{ background: 'var(--accent)', color: '#fff' }}
              >
                Save
              </button>
            </div>
            {hosting.customDomain && hosting.customUrl && (
              <a
                href={hosting.customUrl}
                target="_blank"
                rel="noreferrer"
                className="text-xs mt-2 inline-block hover:underline"
                style={{ color: 'var(--accent)' }}
              >
                {hosting.customUrl}
              </a>
            )}
            <div className="mt-3 text-xs flex flex-col gap-1" style={{ color: 'var(--text-tertiary)' }}>
              <p className="font-medium" style={{ color: 'var(--text-secondary)' }}>DNS setup:</p>
              <p>1. Add a <code className="font-mono">CNAME</code> record pointing to your instance domain</p>
              <p>2. Or an <code className="font-mono">A</code> record pointing to your VPS IP</p>
              <p>3. SSL certificate is provisioned automatically by Caddy</p>
            </div>
          </div>

          {/* Deploy status */}
          <div className="rounded-lg p-4" style={{ background: 'var(--surface-2)', border: '1px solid var(--border-subtle)' }}>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>Deploy status</p>
              <span
                className="text-xs px-2 py-0.5 rounded capitalize"
                style={{
                  background: hosting.deploy_status === 'live' ? 'var(--accent-muted)' : 'var(--warning-muted)',
                  color: hosting.deploy_status === 'live' ? 'var(--accent)' : 'var(--warning)',
                }}
              >
                {hosting.deploy_status || 'pending'}
              </span>
            </div>
            <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
              Push your code to GitHub and deploy will be triggered automatically, or use the deploy button in the toolbar.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
