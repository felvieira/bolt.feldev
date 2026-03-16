import { useStore } from '@nanostores/react';
import { ClientOnly } from 'remix-utils/client-only';
import { chatStore } from '~/lib/stores/chat';
import { HeaderActionButtons } from './HeaderActionButtons.client';
import { ChatDescription } from '~/lib/persistence/ChatDescription.client';
import { UserMenu } from './UserMenu';

export function Header() {
  const chat = useStore(chatStore);

  return (
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
        <ClientOnly>
          {() => <HeaderActionButtons chatStarted={chat.started} />}
        </ClientOnly>
        <UserMenu />
      </div>
    </header>
  );
}
