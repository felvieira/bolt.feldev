import { useState, useEffect, useMemo } from 'react';
import { useStore } from '@nanostores/react';
import * as RadixDialog from '@radix-ui/react-dialog';
import { classNames } from '~/utils/classNames';
import { useFeatures } from '~/lib/hooks/useFeatures';
import { useNotifications } from '~/lib/hooks/useNotifications';
import { useConnectionStatus } from '~/lib/hooks/useConnectionStatus';
import { tabConfigurationStore, resetTabConfiguration } from '~/lib/stores/settings';
import { profileStore } from '~/lib/stores/profile';
import type { TabType, Profile } from './types';
import { TAB_LABELS, DEFAULT_TAB_CONFIG, TAB_DESCRIPTIONS, TAB_ICONS } from './constants';
import { DialogTitle } from '~/components/ui/Dialog';
import { AvatarDropdown } from './AvatarDropdown';

// Import all tab components
import ProfileTab from '~/components/@settings/tabs/profile/ProfileTab';
import SettingsTab from '~/components/@settings/tabs/settings/SettingsTab';
import NotificationsTab from '~/components/@settings/tabs/notifications/NotificationsTab';
import FeaturesTab from '~/components/@settings/tabs/features/FeaturesTab';
import { DataTab } from '~/components/@settings/tabs/data/DataTab';
import { EventLogsTab } from '~/components/@settings/tabs/event-logs/EventLogsTab';
import GitHubTab from '~/components/@settings/tabs/github/GitHubTab';
import GitLabTab from '~/components/@settings/tabs/gitlab/GitLabTab';
import SupabaseTab from '~/components/@settings/tabs/supabase/SupabaseTab';
import VercelTab from '~/components/@settings/tabs/vercel/VercelTab';
import NetlifyTab from '~/components/@settings/tabs/netlify/NetlifyTab';
import CloudProvidersTab from '~/components/@settings/tabs/providers/cloud/CloudProvidersTab';
import LocalProvidersTab from '~/components/@settings/tabs/providers/local/LocalProvidersTab';
import McpTab from '~/components/@settings/tabs/mcp/McpTab';
import IntegrationsTab from '~/components/@settings/tabs/integrations/IntegrationsTab';

interface ControlPanelProps {
  open: boolean;
  onClose: () => void;
}

// Beta status for experimental features
const BETA_TABS = new Set<TabType>(['local-providers', 'mcp']);

export const ControlPanel = ({ open, onClose }: ControlPanelProps) => {
  // State
  const [activeTab, setActiveTab] = useState<TabType | null>(null);
  const [loadingTab, setLoadingTab] = useState<TabType | null>(null);
  const [showTabManagement, setShowTabManagement] = useState(false);

  // Store values
  const tabConfiguration = useStore(tabConfigurationStore);
  const profile = useStore(profileStore) as Profile;

  // Status hooks
  const { hasNewFeatures, unviewedFeatures, acknowledgeAllFeatures } = useFeatures();
  const { hasUnreadNotifications, unreadNotifications, markAllAsRead } = useNotifications();
  const { hasConnectionIssues, currentIssue, acknowledgeIssue } = useConnectionStatus();

  // Memoize the base tab configurations to avoid recalculation
  const baseTabConfig = useMemo(() => {
    return new Map(DEFAULT_TAB_CONFIG.map((tab) => [tab.id, tab]));
  }, []);

  // Add visibleTabs logic using useMemo with optimized calculations
  const visibleTabs = useMemo(() => {
    if (!tabConfiguration?.userTabs || !Array.isArray(tabConfiguration.userTabs)) {
      console.warn('Invalid tab configuration, resetting to defaults');
      resetTabConfiguration();

      return [];
    }

    const notificationsDisabled = profile?.preferences?.notifications === false;

    // Optimize user mode tab filtering
    return tabConfiguration.userTabs
      .filter((tab) => {
        if (!tab?.id) {
          return false;
        }

        if (tab.id === 'notifications' && notificationsDisabled) {
          return false;
        }

        return tab.visible && tab.window === 'user';
      })
      .sort((a, b) => a.order - b.order);
  }, [tabConfiguration, profile?.preferences?.notifications, baseTabConfig]);

  // Auto-select first tab when opening
  useEffect(() => {
    if (!open) {
      setActiveTab(null);
      setLoadingTab(null);
      setShowTabManagement(false);
    } else if (visibleTabs.length > 0 && !activeTab) {
      setActiveTab(visibleTabs[0].id as TabType);
    }
  }, [open, visibleTabs]);

  // Handle closing
  const handleClose = () => {
    setActiveTab(null);
    setLoadingTab(null);
    setShowTabManagement(false);
    onClose();
  };

  // Handlers
  const handleBack = () => {
    if (showTabManagement) {
      setShowTabManagement(false);
    } else if (activeTab) {
      setActiveTab(null);
    }
  };

  const getTabComponent = (tabId: TabType) => {
    switch (tabId) {
      case 'profile':
        return <ProfileTab />;
      case 'settings':
        return <SettingsTab />;
      case 'notifications':
        return <NotificationsTab />;
      case 'features':
        return <FeaturesTab />;
      case 'data':
        return <DataTab />;
      case 'cloud-providers':
        return <CloudProvidersTab />;
      case 'local-providers':
        return <LocalProvidersTab />;
      case 'github':
        return <GitHubTab />;
      case 'gitlab':
        return <GitLabTab />;
      case 'supabase':
        return <SupabaseTab />;
      case 'vercel':
        return <VercelTab />;
      case 'netlify':
        return <NetlifyTab />;
      case 'event-logs':
        return <EventLogsTab />;
      case 'mcp':
        return <McpTab />;
      case 'integrations':
        return <IntegrationsTab />;

      default:
        return null;
    }
  };

  const getTabUpdateStatus = (tabId: TabType): boolean => {
    switch (tabId) {
      case 'features':
        return hasNewFeatures;
      case 'notifications':
        return hasUnreadNotifications;
      case 'github':
      case 'gitlab':
      case 'supabase':
      case 'vercel':
      case 'netlify':
        return hasConnectionIssues;
      default:
        return false;
    }
  };

  const getStatusMessage = (tabId: TabType): string => {
    switch (tabId) {
      case 'features':
        return `${unviewedFeatures.length} new feature${unviewedFeatures.length === 1 ? '' : 's'} to explore`;
      case 'notifications':
        return `${unreadNotifications.length} unread notification${unreadNotifications.length === 1 ? '' : 's'}`;
      case 'github':
      case 'gitlab':
      case 'supabase':
      case 'vercel':
      case 'netlify':
        return currentIssue === 'disconnected'
          ? 'Connection lost'
          : currentIssue === 'high-latency'
            ? 'High latency detected'
            : 'Connection issues detected';
      default:
        return '';
    }
  };

  const handleTabClick = (tabId: TabType) => {
    setLoadingTab(tabId);
    setActiveTab(tabId);
    setShowTabManagement(false);

    // Acknowledge notifications based on tab
    switch (tabId) {
      case 'features':
        acknowledgeAllFeatures();
        break;
      case 'notifications':
        markAllAsRead();
        break;
      case 'github':
      case 'gitlab':
      case 'supabase':
      case 'vercel':
      case 'netlify':
        acknowledgeIssue();
        break;
    }

    // Clear loading state after a delay
    setTimeout(() => setLoadingTab(null), 500);
  };

  return (
    <RadixDialog.Root open={open}>
      <RadixDialog.Portal>
        <div className="fixed inset-0 flex items-center justify-center z-[100] modern-scrollbar">
          <RadixDialog.Overlay className="absolute inset-0 bg-black/70 dark:bg-black/80 backdrop-blur-sm transition-opacity duration-200" />

          <RadixDialog.Content
            aria-describedby={undefined}
            onEscapeKeyDown={handleClose}
            onPointerDownOutside={handleClose}
            className="relative z-[101]"
          >
            <div
              className={classNames(
                'w-[1200px] h-[90vh]',
                'rounded-2xl shadow-2xl',
                'flex flex-col overflow-hidden',
                'relative',
                'transform transition-all duration-200 ease-out',
                open ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 translate-y-4',
              )}
              style={{ background: 'var(--surface-1)', border: '1px solid var(--border-subtle)' }}
            >
              {/* Header */}
              <div
                className="flex items-center justify-between px-6 py-4 shrink-0"
                style={{ borderBottom: '1px solid var(--border-subtle)' }}
              >
                <div className="flex items-center space-x-4">
                  <DialogTitle className="text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>
                    Settings
                  </DialogTitle>
                </div>

                <div className="flex items-center gap-6">
                  <div className="pl-6">
                    <AvatarDropdown onSelectTab={handleTabClick} />
                  </div>

                  <button
                    onClick={handleClose}
                    className="flex items-center justify-center w-8 h-8 rounded-full bg-transparent transition-all duration-200"
                    style={{ color: 'var(--text-tertiary)' }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'var(--surface-2)';
                      e.currentTarget.style.color = 'var(--text-primary)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'transparent';
                      e.currentTarget.style.color = 'var(--text-tertiary)';
                    }}
                  >
                    <div className="i-ph:x w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Body: Sidebar + Content */}
              <div className="flex flex-1 overflow-hidden">
                {/* Sidebar */}
                <nav
                  className="w-[220px] shrink-0 overflow-y-auto py-3 flex flex-col gap-0.5 bg-bolt-elements-background-depth-1"
                  style={{ borderRight: '1px solid var(--border-subtle)' }}
                >
                  {visibleTabs.map((tab) => {
                    const isActive = activeTab === tab.id;
                    const hasUpdate = getTabUpdateStatus(tab.id);
                    const isBeta = BETA_TABS.has(tab.id);
                    const Icon = TAB_ICONS[tab.id as TabType];

                    return (
                      <button
                        key={tab.id}
                        onClick={() => handleTabClick(tab.id as TabType)}
                        className={classNames(
                          'relative flex items-center gap-3 w-full px-4 py-2.5 text-left text-sm transition-colors duration-150',
                          isActive
                            ? 'text-[var(--accent)] font-medium'
                            : 'font-normal hover:bg-bolt-elements-background-depth-2',
                        )}
                        style={{
                          color: isActive ? 'var(--accent)' : 'var(--text-secondary)',
                          backgroundColor: isActive ? 'var(--surface-2)' : undefined,
                        }}
                      >
                        {/* Active indicator */}
                        {isActive && (
                          <span
                            className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full"
                            style={{ background: 'var(--accent)' }}
                          />
                        )}

                        {/* Icon */}
                        <span className="shrink-0 w-4 h-4 flex items-center justify-center">
                          {Icon && <Icon className="w-4 h-4" />}
                        </span>

                        {/* Label */}
                        <span className="truncate">{TAB_LABELS[tab.id as TabType]}</span>

                        {/* Badges */}
                        {isBeta && (
                          <span
                            className="ml-auto px-1.5 py-0.5 rounded-full text-[10px] font-medium shrink-0"
                            style={{ background: 'var(--accent)', color: 'white', opacity: 0.8 }}
                          >
                            BETA
                          </span>
                        )}
                        {hasUpdate && (
                          <span
                            className="ml-auto w-2 h-2 rounded-full shrink-0"
                            style={{ background: 'var(--accent)' }}
                            title={getStatusMessage(tab.id)}
                          />
                        )}
                      </button>
                    );
                  })}
                </nav>

                {/* Content area */}
                <div
                  className={classNames(
                    'flex-1 overflow-y-auto bg-bolt-elements-background-depth-2',
                    'scrollbar scrollbar-w-2',
                    'scrollbar-track-transparent',
                    'scrollbar-thumb-[#333333] hover:scrollbar-thumb-[#444444]',
                  )}
                >
                  <div className="p-6 transition-opacity duration-150">
                    {activeTab ? getTabComponent(activeTab) : null}
                  </div>
                </div>
              </div>
            </div>
          </RadixDialog.Content>
        </div>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
};
