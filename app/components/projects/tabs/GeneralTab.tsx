import { useState, useEffect } from 'react';
import { useStore } from '@nanostores/react';
import { Lock, EyeOff, Globe } from 'lucide-react';
import { projectsStore, updateProject } from '~/lib/stores/projects';
import type { Project } from '~/lib/stores/projects';
import { classNames } from '~/utils/classNames';

const VISIBILITY_OPTIONS: {
  value: Project['visibility'];
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { value: 'private', label: 'Private', description: 'Only owner can access', icon: Lock },
  { value: 'secret', label: 'Secret', description: 'Accessible via shared URL', icon: EyeOff },
  { value: 'public', label: 'Public', description: 'Everyone can view', icon: Globe },
];

interface GeneralTabProps {
  projectId: string;
}

export const GeneralTab = ({ projectId }: GeneralTabProps) => {
  const projects = useStore(projectsStore);
  const project = projects.find((p) => p.id === projectId);

  const [name, setName] = useState(project?.name ?? '');
  const [description, setDescription] = useState(project?.description ?? '');
  const [visibility, setVisibility] = useState<Project['visibility']>(project?.visibility ?? 'private');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (project) {
      setName(project.name);
      setDescription(project.description ?? '');
      setVisibility(project.visibility);
    }
  }, [project]);

  const handleSave = async () => {
    setSaving(true);

    try {
      await updateProject(projectId, { name, description, visibility });
    } finally {
      setSaving(false);
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
      {/* Name */}
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
          Project Name
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={inputClasses}
          style={inputStyle}
        />
      </div>

      {/* Description */}
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
          Description
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          className={`${inputClasses} resize-none`}
          style={inputStyle}
        />
      </div>

      {/* Visibility */}
      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
          Visibility
        </label>
        <div className="grid grid-cols-3 gap-3">
          {VISIBILITY_OPTIONS.map((opt) => {
            const Icon = opt.icon;
            const isActive = visibility === opt.value;

            return (
              <button
                key={opt.value}
                onClick={() => setVisibility(opt.value)}
                className={classNames(
                  'flex flex-col items-center gap-2 p-4 rounded-lg text-center transition-all duration-150 cursor-pointer',
                  isActive ? 'ring-2 ring-[var(--accent)]' : 'hover:bg-[var(--surface-3)]',
                )}
                style={{
                  background: isActive ? 'var(--accent-alpha, rgba(99,102,241,0.08))' : 'var(--surface-1)',
                  border: isActive ? '1px solid var(--accent)' : '1px solid var(--border-subtle)',
                  color: isActive ? 'var(--accent)' : 'var(--text-secondary)',
                }}
              >
                <Icon className="w-5 h-5" />
                <span className="text-sm font-medium">{opt.label}</span>
                <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                  {opt.description}
                </span>
              </button>
            );
          })}
        </div>
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
