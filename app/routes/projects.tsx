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
      return 'bg-gray-500';
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

function ProjectCard({ project, onClick }: { project: Project; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="text-left w-full rounded-xl border border-bolt-elements-borderColor bg-bolt-elements-background-depth-2 p-4 transition-colors hover:border-bolt-elements-borderColorActive"
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm font-medium text-bolt-elements-textPrimary truncate">{project.name}</h3>
        <ProviderIcon provider={project.hosting_provider} />
      </div>

      {project.description && (
        <p className="mt-1 text-xs text-bolt-elements-textSecondary line-clamp-2">{project.description}</p>
      )}

      <div className="mt-3 flex items-center gap-2 text-xs text-bolt-elements-textSecondary">
        <span className={`inline-block w-2 h-2 rounded-full ${statusColor(project.deploy_status)}`} />
        <span>{statusLabel(project.deploy_status)}</span>
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

      <main className="flex-1 overflow-y-auto px-4 md:px-8 py-6 max-w-6xl mx-auto w-full">
        {/* Top bar */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-semibold text-bolt-elements-textPrimary">Projects</h1>
          <button
            onClick={handleNewProject}
            className="flex items-center gap-1.5 rounded-lg bg-bolt-elements-button-primary-background px-3 py-1.5 text-sm font-medium text-bolt-elements-button-primary-text transition-colors hover:bg-bolt-elements-button-primary-backgroundHover"
          >
            <div className="i-ph:plus text-base" />
            New Project
          </button>
        </div>

        {/* Filter tabs */}
        <div className="flex items-center gap-1 mb-6 border-b border-bolt-elements-borderColor">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              className={`px-3 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
                filter === tab.key
                  ? 'border-bolt-elements-textPrimary text-bolt-elements-textPrimary'
                  : 'border-transparent text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex items-center justify-center py-20 text-bolt-elements-textSecondary text-sm">
            Loading projects...
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="i-ph:folder-simple-dashed text-4xl text-bolt-elements-textSecondary mb-3" />
            <p className="text-bolt-elements-textSecondary text-sm mb-4">
              {projects.length === 0 ? 'No projects yet' : 'No projects match this filter'}
            </p>
            {projects.length === 0 && (
              <button
                onClick={handleNewProject}
                className="rounded-lg bg-bolt-elements-button-primary-background px-4 py-2 text-sm font-medium text-bolt-elements-button-primary-text transition-colors hover:bg-bolt-elements-button-primary-backgroundHover"
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
