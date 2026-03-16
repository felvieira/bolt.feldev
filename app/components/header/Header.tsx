import { useState, useEffect, useCallback } from 'react';
import { useStore } from '@nanostores/react';
import { ClientOnly } from 'remix-utils/client-only';
import { Settings, FolderPlus } from 'lucide-react';
import { chatStore } from '~/lib/stores/chat';
import { HeaderActionButtons } from './HeaderActionButtons.client';
import { ChatDescription } from '~/lib/persistence/ChatDescription.client';
import { UserMenu } from './UserMenu';
import { chatId as chatIdStore } from '~/lib/persistence/useChatHistory';
import { projectsStore, fetchProjects, createProject } from '~/lib/stores/projects';
import { ProjectSettingsModal } from '~/components/projects/ProjectSettingsModal';

export function Header() {
  const chat = useStore(chatStore);
  const currentChatId = useStore(chatIdStore);
  const projects = useStore(projectsStore);

  const [showProjectSettings, setShowProjectSettings] = useState(false);
  const [linkedProjectId, setLinkedProjectId] = useState<string | null>(null);
  const [converting, setConverting] = useState(false);

  // Fetch projects on mount so we can check for a linked project
  useEffect(() => {
    fetchProjects();
  }, []);

  // Find a project linked to this chat
  useEffect(() => {
    if (!currentChatId) {
      setLinkedProjectId(null);
      return;
    }

    const linked = Array.isArray(projects) ? projects.find((p) => p.chat_id === currentChatId) : undefined;
    setLinkedProjectId(linked ? linked.id : null);
  }, [currentChatId, projects]);

  const handleConvertToProject = useCallback(async () => {
    if (!currentChatId || converting) {
      return;
    }

    setConverting(true);

    try {
      const project = await createProject('Untitled Project', currentChatId);

      if (project) {
        setLinkedProjectId(project.id);
        setShowProjectSettings(true);
      }
    } finally {
      setConverting(false);
    }
  }, [currentChatId, converting]);

  return (
    <>
      <header
        className="flex items-center px-4 gap-3"
        style={{
          height: 'var(--header-height)',
          background: 'var(--background)',
        }}
      >
        {/* Sidebar toggle + Logo */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            className="flex items-center justify-center w-7 h-7 rounded-[var(--radius-sm)] transition-colors duration-150"
            style={{ color: 'var(--text-tertiary)' }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)';
              (e.currentTarget as HTMLElement).style.background = 'var(--surface-2)';
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.color = 'var(--text-tertiary)';
              (e.currentTarget as HTMLElement).style.background = 'transparent';
            }}
            aria-label="Toggle sidebar"
          >
            <div className="i-ph:sidebar-simple text-base" />
          </button>
          <a href="/" className="flex items-center" aria-label="Volt home">
            <img
              src="/volt-logo.svg"
              alt="Volt"
              style={{ width: '24px', height: '24px', filter: 'brightness(0) invert(1)' }}
            />
          </a>
          <a
            href="/projects"
            className="ml-2 px-2 py-1 text-xs font-medium rounded-md transition-colors duration-150"
            style={{ color: 'var(--text-secondary)' }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)';
              (e.currentTarget as HTMLElement).style.background = 'var(--surface-2)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)';
              (e.currentTarget as HTMLElement).style.background = 'transparent';
            }}
          >
            Projects
          </a>
        </div>

        {/* Chat title — grows to fill space */}
        <div className="flex-1 min-w-0">
          {chat.started && (
            <ClientOnly>
              {() => <ChatDescription />}
            </ClientOnly>
          )}
        </div>

        {/* Right actions */}
        <div className="flex items-center gap-1 shrink-0">
          {/* Project settings gear or Convert to Project button */}
          {chat.started && currentChatId && (
            <ClientOnly>
              {() =>
                linkedProjectId ? (
                  <button
                    onClick={() => setShowProjectSettings(true)}
                    className="flex items-center justify-center w-8 h-8 rounded-lg transition-colors duration-150"
                    style={{ color: 'var(--text-tertiary)' }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)';
                      (e.currentTarget as HTMLElement).style.background = 'var(--surface-2)';
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.color = 'var(--text-tertiary)';
                      (e.currentTarget as HTMLElement).style.background = 'transparent';
                    }}
                    aria-label="Project settings"
                    title="Project settings"
                  >
                    <Settings className="w-4 h-4" />
                  </button>
                ) : (
                  <button
                    onClick={handleConvertToProject}
                    disabled={converting}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg transition-colors duration-150"
                    style={{
                      color: 'var(--text-secondary)',
                      border: '1px solid var(--border-subtle)',
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)';
                      (e.currentTarget as HTMLElement).style.background = 'var(--surface-2)';
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)';
                      (e.currentTarget as HTMLElement).style.background = 'transparent';
                    }}
                    aria-label="Convert to project"
                    title="Convert this chat to a project"
                  >
                    <FolderPlus className="w-3.5 h-3.5" />
                    {converting ? 'Converting...' : 'Convert to Project'}
                  </button>
                )
              }
            </ClientOnly>
          )}
          <ClientOnly>
            {() => <HeaderActionButtons chatStarted={chat.started} />}
          </ClientOnly>
          <UserMenu />
        </div>
      </header>

      {/* Project Settings Modal */}
      {linkedProjectId && (
        <ProjectSettingsModal
          open={showProjectSettings}
          onClose={() => setShowProjectSettings(false)}
          projectId={linkedProjectId}
        />
      )}
    </>
  );
}
