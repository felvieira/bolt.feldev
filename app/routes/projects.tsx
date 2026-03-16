import { useEffect, useState } from 'react';
import { useNavigate } from '@remix-run/react';
import { useStore } from '@nanostores/react';
import { formatDistanceToNow } from 'date-fns';
import { Header } from '~/components/header/Header';
import {
  type Project,
  projectsStore,
  projectsLoadingStore,
  fetchProjects,
  createProject,
} from '~/lib/stores/projects';

type FilterTab = 'all' | 'deployed' | 'draft';

function statusColor(status?: string) {
  switch (status) {
    case 'live':
      return 'bg-green-500';
    case 'building':
      return 'bg-yellow-500';
    case 'failed':
      return 'bg-red-500';
    default:
      return 'bg-zinc-500';
  }
}

function statusBadgeBg(status?: string) {
  switch (status) {
    case 'live':
      return 'bg-green-500/10 text-green-400';
    case 'building':
      return 'bg-yellow-500/10 text-yellow-400';
    case 'failed':
      return 'bg-red-500/10 text-red-400';
    default:
      return 'bg-zinc-500/10 text-zinc-400';
  }
}

function statusLabel(status?: string) {
  switch (status) {
    case 'live':
      return 'Live';
    case 'building':
      return 'Building';
    case 'failed':
      return 'Failed';
    default:
      return 'Pending';
  }
}

function ProviderIcon({ provider }: { provider?: string }) {
  const cls = 'w-4 h-4 opacity-60';

  switch (provider) {
    case 'netlify':
      return <div className={`i-logos:netlify-icon ${cls}`} title="Netlify" />;
    case 'vercel':
      return <div className={`i-logos:vercel-icon ${cls}`} title="Vercel" style={{ filter: 'brightness(0) invert(1)' }} />;
    default:
      return <div className={`i-ph:globe-simple ${cls}`} title={provider || 'Self-hosted'} />;
  }
}

function SkeletonCard() {
  return (
    <div className="rounded-xl border border-bolt-elements-borderColor bg-bolt-elements-background-depth-2 p-4 animate-pulse">
      <div className="flex items-start justify-between gap-2">
        <div className="h-4 w-32 rounded bg-bolt-elements-background-depth-3" />
        <div className="h-4 w-4 rounded bg-bolt-elements-background-depth-3" />
      </div>
      <div className="mt-2 h-3 w-48 rounded bg-bolt-elements-background-depth-3" />
      <div className="mt-4 flex items-center gap-2">
        <div className="h-2 w-2 rounded-full bg-bolt-elements-background-depth-3" />
        <div className="h-3 w-16 rounded bg-bolt-elements-background-depth-3" />
        <div className="ml-auto h-3 w-20 rounded bg-bolt-elements-background-depth-3" />
      </div>
    </div>
  );
}

function ProjectCard({ project, onClick }: { project: Project; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="text-left w-full rounded-xl border border-bolt-elements-borderColor bg-bolt-elements-background-depth-2 p-4 transition-all duration-200 hover:border-bolt-elements-borderColorActive hover:scale-[1.02] hover:shadow-lg hover:shadow-black/20"
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm font-medium text-bolt-elements-textPrimary truncate">{project.name}</h3>
        <ProviderIcon provider={project.hosting_provider} />
      </div>

      {project.description && (
        <p className="mt-1 text-xs text-bolt-elements-textSecondary line-clamp-2">{project.description}</p>
      )}

      <div className="mt-3 flex items-center gap-2 text-xs text-bolt-elements-textSecondary">
        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium ${statusBadgeBg(project.deploy_status)}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${statusColor(project.deploy_status)}`} />
          {statusLabel(project.deploy_status)}
        </span>
        <span className="ml-auto">{formatDistanceToNow(new Date(project.updated_at), { addSuffix: true })}</span>
      </div>
    </button>
  );
}

export default function ProjectsPage() {
  const projects = useStore(projectsStore);
  const loading = useStore(projectsLoadingStore);
  const navigate = useNavigate();
  const [filter, setFilter] = useState<FilterTab>('all');

  useEffect(() => {
    fetchProjects();
  }, []);

  const filtered = projects.filter((p) => {
    if (filter === 'deployed') {
      return p.deploy_status === 'live';
    }

    if (filter === 'draft') {
      return !p.deploy_status || p.deploy_status === 'pending';
    }

    return true;
  });

  async function handleNewProject() {
    const project = await createProject('Untitled Project');

    if (project?.chat_id) {
      navigate(`/chat/${project.chat_id}`);
    } else {
      navigate('/');
    }
  }

  const tabs: { key: FilterTab; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'deployed', label: 'Deployed' },
    { key: 'draft', label: 'Draft' },
  ];

  return (
    <div className="flex flex-col h-full w-full bg-bolt-elements-background-depth-1">
      <Header />

      <main className="flex-1 overflow-y-auto px-4 md:px-8 py-8 max-w-6xl mx-auto w-full">
        {/* Top bar */}
        <div className="flex items-center justify-between mb-1">
          <h1 className="text-2xl font-semibold text-bolt-elements-textPrimary">Projects</h1>
          <button
            onClick={handleNewProject}
            className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium text-white transition-all duration-200 hover:brightness-110"
            style={{ background: 'var(--accent)' }}
          >
            <div className="i-ph:plus text-base" />
            New Project
          </button>
        </div>
        <p className="text-sm text-bolt-elements-textTertiary mb-6">Manage your projects, deployments, and settings.</p>

        {/* Filter tabs */}
        <div className="flex items-center gap-1 mb-6 border-b border-bolt-elements-borderColor">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              className={`px-3 py-2 text-sm font-medium transition-all duration-200 border-b-2 -mb-px ${
                filter === tab.key
                  ? 'text-bolt-elements-textPrimary'
                  : 'border-transparent text-bolt-elements-textTertiary hover:text-bolt-elements-textSecondary'
              }`}
              style={filter === tab.key ? { borderBottomColor: 'var(--accent)', color: 'var(--accent)' } : undefined}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
              style={{ background: 'var(--surface-2)' }}
            >
              <div className="i-ph:folder-simple-dashed text-3xl text-bolt-elements-textTertiary" />
            </div>
            <p className="text-bolt-elements-textSecondary text-sm font-medium mb-1">
              {projects.length === 0 ? 'No projects yet' : 'No projects match this filter'}
            </p>
            <p className="text-bolt-elements-textTertiary text-xs mb-5">
              {projects.length === 0 ? 'Create your first project to get started.' : 'Try changing the filter above.'}
            </p>
            {projects.length === 0 && (
              <button
                onClick={handleNewProject}
                className="rounded-lg px-4 py-2 text-sm font-medium text-white transition-all duration-200 hover:brightness-110"
                style={{ background: 'var(--accent)' }}
              >
                Create your first project
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                onClick={() => {
                  if (project.chat_id) {
                    navigate(`/chat/${project.chat_id}`);
                  }
                }}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
