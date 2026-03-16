import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { toast } from 'react-toastify';
import { workbenchStore } from '~/lib/stores/workbench';
import { classNames } from '~/utils/classNames';
import type { Message } from 'ai';

interface ExportChatButtonProps {
  exportChat?: () => void;
  messages?: Message[];
}

export const ExportChatButton = ({ exportChat, messages }: ExportChatButtonProps) => {
  const handleCopyPrompt = () => {
    if (!messages || messages.length === 0) {
      toast('No messages to copy', { type: 'info' });
      return;
    }

    const userMessages = messages
      .filter((m) => m.role === 'user')
      .map((m) => (typeof m.content === 'string' ? m.content : ''))
      .filter(Boolean)
      .join('\n\n---\n\n');

    if (!userMessages) {
      toast('No user messages to copy', { type: 'info' });
      return;
    }

    navigator.clipboard
      .writeText(userMessages)
      .then(() => {
        toast('Prompt copied!', {
          icon: <div className="i-ph:check-circle text-accent-500" />,
        });
      })
      .catch(() => {
        toast.error('Failed to copy prompt');
      });
  };

  return (
    <div className="flex border border-bolt-elements-borderColor rounded-md overflow-hidden">
      <DropdownMenu.Root>
        <DropdownMenu.Trigger className="rounded-md items-center justify-center [&:is(:disabled,.disabled)]:cursor-not-allowed [&:is(:disabled,.disabled)]:opacity-60 px-3 py-1.5 text-xs bg-accent-500 text-white hover:text-bolt-elements-item-contentAccent [&:not(:disabled,.disabled)]:hover:bg-bolt-elements-button-primary-backgroundHover outline-accent-500 flex gap-1.5">
          <div className="i-ph:export size-3.5" />
          Export
          <span className={classNames('i-ph:caret-down transition-transform')} />
        </DropdownMenu.Trigger>
        <DropdownMenu.Content
          className={classNames(
            'min-w-[220px] z-[250]',
            'bg-bolt-elements-background-depth-2',
            'rounded-lg shadow-lg',
            'border border-bolt-elements-borderColor',
            'animate-in fade-in-0 zoom-in-95',
            'py-1',
          )}
          sideOffset={5}
          align="end"
        >
          {/* Download ZIP */}
          <DropdownMenu.Item
            className={classNames(
              'cursor-pointer flex items-center w-full px-4 py-2 text-sm text-bolt-elements-textPrimary hover:bg-bolt-elements-item-backgroundActive gap-2 rounded-md group relative',
            )}
            onClick={() => {
              workbenchStore.downloadZip();
            }}
          >
            <div className="i-ph:file-zip size-4.5 text-bolt-elements-textSecondary group-hover:text-accent-500" />
            <div className="flex flex-col">
              <span>Download ZIP</span>
              <span className="text-xs text-bolt-elements-textTertiary">Includes README.md</span>
            </div>
          </DropdownMenu.Item>

          {/* Export Chat (JSON) */}
          <DropdownMenu.Item
            className={classNames(
              'cursor-pointer flex items-center w-full px-4 py-2 text-sm text-bolt-elements-textPrimary hover:bg-bolt-elements-item-backgroundActive gap-2 rounded-md group relative',
            )}
            onClick={() => exportChat?.()}
          >
            <div className="i-ph:chat size-4.5 text-bolt-elements-textSecondary group-hover:text-accent-500" />
            <span>Export Chat</span>
          </DropdownMenu.Item>

          {/* Copy Prompt */}
          <DropdownMenu.Item
            className={classNames(
              'cursor-pointer flex items-center w-full px-4 py-2 text-sm text-bolt-elements-textPrimary hover:bg-bolt-elements-item-backgroundActive gap-2 rounded-md group relative',
            )}
            onClick={handleCopyPrompt}
          >
            <div className="i-ph:clipboard-text size-4.5 text-bolt-elements-textSecondary group-hover:text-accent-500" />
            <span>Copy Prompt</span>
          </DropdownMenu.Item>

          <DropdownMenu.Separator className="my-1 h-px bg-bolt-elements-borderColor" />

          {/* Share Link — coming soon */}
          <DropdownMenu.Item
            disabled
            className={classNames(
              'flex items-center w-full px-4 py-2 text-sm gap-2 rounded-md opacity-50 cursor-not-allowed',
              'text-bolt-elements-textPrimary',
            )}
          >
            <div className="i-ph:link size-4.5 text-bolt-elements-textSecondary" />
            <div className="flex flex-col">
              <span>Copy Share Link</span>
              <span className="text-xs text-bolt-elements-textTertiary">Coming soon</span>
            </div>
          </DropdownMenu.Item>

          {/* StackBlitz */}
          <DropdownMenu.Item
            disabled
            className={classNames(
              'flex items-center w-full px-4 py-2 text-sm gap-2 rounded-md opacity-50 cursor-not-allowed',
              'text-bolt-elements-textPrimary',
            )}
          >
            <div className="i-ph:lightning size-4.5 text-bolt-elements-textSecondary" />
            <div className="flex flex-col">
              <span>Open in StackBlitz</span>
              <span className="text-xs text-bolt-elements-textTertiary">Download ZIP, drag to stackblitz.com</span>
            </div>
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Root>
    </div>
  );
};
