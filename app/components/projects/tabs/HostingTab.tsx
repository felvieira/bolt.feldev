import { useState, useEffect } from 'react';
import { useStore } from '@nanostores/react';
import { projectsStore } from '~/lib/stores/projects';

const PROVIDERS = ['Self-hosted', 'Netlify', 'Vercel'] as const;

interface HostingTabProps {
  projectId: string;
}

export const HostingTab = ({ projectId }: HostingTabProps) => {
  const projects = useStore(projectsStore);
  const project = projects.find((p) => p.id === projectId);

  const [provider, setProvider] = useState(project?.hosting_provider ?? 'Self-hosted');
  const [domain, setDomain] = useState(project?.domain ?? '');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (project) {
      setProvider(project.hosting_provider ?? 'Self-hosted');
      setDomain(project.domain ?? '');
    }
  }, [project]);

  const handleSave = async () => {
    setSaving(true);

    try {
      await fetch(`/api/projects/${projectId}/hosting`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, domain }),
      });
    } finally {
      setSaving(false);
    }
  };

  const isPublished = !!project?.deploy_status && project.deploy_status !== 'none';

  const inputClasses =
    'w-full px-3 py-2 rounded-lg text-sm outline-none transition-all duration-150 focus:ring-2 focus:ring-[var(--accent)]/40 focus:border-[var(--accent)]';

  const inputStyle = {
    background: 'var(--surface-1)',
    border: '1px solid var(--border-subtle)',
    color: 'var(--text-primary)',
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Provider */}
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
          Hosting Provider
        </label>
        <select
          value={provider}
          onChange={(e) => setProvider(e.target.value)}
          className={inputClasses}
          style={inputStyle}
        >
          {PROVIDERS.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </div>

      {/* Deploy status */}
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
          Deploy Status
        </label>
        {isPublished ? (
          <div
            className="flex items-center gap-2 px-3 py-2.5 rounded-lg"
            style={{ background: 'var(--surface-1)', border: '1px solid var(--border-subtle)' }}
          >
            <span
              className="w-2 h-2 rounded-full animate-pulse"
              style={{ background: project?.deploy_status === 'live' ? '#22c55e' : '#eab308' }}
            />
            <span className="text-sm font-medium capitalize" style={{ color: 'var(--text-primary)' }}>
              {project?.deploy_status}
            </span>
          </div>
        ) : (
          <div
            className="px-3 py-2.5 rounded-lg"
            style={{ background: 'var(--surface-1)', border: '1px solid var(--border-subtle)' }}
          >
            <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
              Not published yet. Deploy your project to see status here.
            </p>
          </div>
        )}
      </div>

      {/* Custom domain */}
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
          Custom Domain
        </label>
        <input
          type="text"
          value={domain}
          onChange={(e) => setDomain(e.target.value)}
          placeholder="example.com"
          className={inputClasses}
          style={inputStyle}
        />
        <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
          Point your domain's CNAME record to your hosting provider.
        </p>
      </div>

      {/* Save */}
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
    </div>
  );
};
