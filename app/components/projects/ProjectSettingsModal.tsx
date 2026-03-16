import { useState, useEffect } from 'react';
import * as RadixDialog from '@radix-ui/react-dialog';
import { Settings, Globe, Database, KeyRound, X } from 'lucide-react';
import { classNames } from '~/utils/classNames';
import { DialogTitle } from '~/components/ui/Dialog';
import { GeneralTab } from './tabs/GeneralTab';
import { HostingTab } from './tabs/HostingTab';
import { DatabaseTab } from './tabs/DatabaseTab';
import { SecretsTab } from './tabs/SecretsTab';

type SettingsTabId = 'general' | 'hosting' | 'database' | 'secrets';

interface TabDef {
  id: SettingsTabId;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const TABS: TabDef[] = [
  { id: 'general', label: 'General', icon: Settings },
  { id: 'hosting', label: 'Domains & Hosting', icon: Globe },
  { id: 'database', label: 'Database', icon: Database },
  { id: 'secrets', label: 'Secrets', icon: KeyRound },
];

interface ProjectSettingsModalProps {
  open: boolean;
  onClose: () => void;
  projectId: string;
}

export const ProjectSettingsModal = ({ open, onClose, projectId }: ProjectSettingsModalProps) => {
  const [activeTab, setActiveTab] = useState<SettingsTabId>('general');

  useEffect(() => {
    if (open) {
      setActiveTab('general');
    }
  }, [open]);

  const renderTab = () => {
    switch (activeTab) {
      case 'general':
        return <GeneralTab projectId={projectId} />;
      case 'hosting':
        return <HostingTab projectId={projectId} />;
      case 'database':
        return <DatabaseTab projectId={projectId} />;
      case 'secrets':
        return <SecretsTab projectId={projectId} />;
      default:
        return null;
    }
  };

  return (
    <RadixDialog.Root open={open}>
      <RadixDialog.Portal>
        <div className="fixed inset-0 flex items-center justify-center z-[100]">
          <RadixDialog.Overlay className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

          <RadixDialog.Content
            aria-describedby={undefined}
            onEscapeKeyDown={onClose}
            onPointerDownOutside={onClose}
            className="relative z-[101]"
          >
            <div
              className={classNames(
                'w-[900px] max-w-4xl h-[600px]',
                'rounded-2xl shadow-2xl',
                'flex overflow-hidden',
                'transform transition-all duration-200 ease-out',
                open ? 'opacity-100 scale-100' : 'opacity-0 scale-95',
              )}
              style={{ background: 'var(--surface-1)', border: '1px solid var(--border-subtle)' }}
            >
              {/* Left sidebar */}
              <div
                className="w-[200px] flex flex-col shrink-0 py-4"
                style={{ borderRight: '1px solid var(--border-subtle)', background: 'var(--surface-2)' }}
              >
                <DialogTitle className="px-4 pb-3 text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                  Project Settings
                </DialogTitle>

                <nav className="flex flex-col gap-0.5 px-2">
                  {TABS.map((tab) => {
                    const Icon = tab.icon;
                    const isActive = activeTab === tab.id;

                    return (
                      <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={classNames(
                          'flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                          isActive ? 'bg-[var(--accent)]/15' : 'hover:bg-[var(--surface-3)]',
                        )}
                        style={{ color: isActive ? 'var(--accent)' : 'var(--text-secondary)' }}
                      >
                        <Icon className="w-4 h-4" />
                        {tab.label}
                      </button>
                    );
                  })}
                </nav>
              </div>

              {/* Right content */}
              <div className="flex-1 flex flex-col min-w-0">
                {/* Header with close */}
                <div
                  className="flex items-center justify-between px-6 py-4 shrink-0"
                  style={{ borderBottom: '1px solid var(--border-subtle)' }}
                >
                  <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
                    {TABS.find((t) => t.id === activeTab)?.label}
                  </h2>
                  <button
                    onClick={onClose}
                    className="flex items-center justify-center w-8 h-8 rounded-full transition-colors hover:bg-[var(--surface-3)]"
                    style={{ color: 'var(--text-tertiary)' }}
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Tab content */}
                <div className="flex-1 overflow-y-auto p-6">{renderTab()}</div>
              </div>
            </div>
          </RadixDialog.Content>
        </div>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
};
