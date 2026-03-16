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
          className="w-full px-3 py-2 rounded-lg text-sm outline-none"
          style={{
            background: 'var(--surface-2)',
            border: '1px solid var(--border-subtle)',
            color: 'var(--text-primary)',
          }}
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
          <div className="flex items-center gap-2">
            <span
              className="w-2 h-2 rounded-full"
              style={{ background: project?.deploy_status === 'live' ? '#22c55e' : '#eab308' }}
            />
            <span className="text-sm" style={{ color: 'var(--text-primary)' }}>
              {project?.deploy_status}
            </span>
          </div>
        ) : (
          <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
            Your project is not published yet. Deploy it to see status here.
          </p>
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
          className="w-full px-3 py-2 rounded-lg text-sm outline-none"
          style={{
            background: 'var(--surface-2)',
            border: '1px solid var(--border-subtle)',
            color: 'var(--text-primary)',
          }}
        />
      </div>

      {/* Save */}
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
    </div>
  );
};
