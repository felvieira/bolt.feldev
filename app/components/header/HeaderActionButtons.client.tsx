import { useState } from 'react';
import { useStore } from '@nanostores/react';
import { workbenchStore } from '~/lib/stores/workbench';
import { DeployButton } from '~/components/deploy/DeployButton';

interface HeaderActionButtonsProps {
  chatStarted: boolean;
}

function GhostIconButton({
  onClick,
  title,
  icon,
  label,
}: {
  onClick?: () => void;
  title?: string;
  icon: string;
  label?: string;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="flex items-center justify-center w-7 h-7 rounded-[var(--radius-sm)] transition-colors duration-150 gap-1.5 text-sm text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] hover:bg-[var(--surface-2)]"
      aria-label={title}
    >
      <div className={`${icon} text-base`} />
      {label && <span>{label}</span>}
    </button>
  );
}

export function HeaderActionButtons({ chatStarted: _chatStarted }: HeaderActionButtonsProps) {
  const [activePreviewIndex] = useState(0);
  const previews = useStore(workbenchStore.previews);
  const activePreview = previews[activePreviewIndex];

  const shouldShowButtons = activePreview;

  return (
    <div className="flex items-center gap-1">
      {/* Deploy Button */}
      {shouldShowButtons && <DeployButton />}

      {/* Debug Tools */}
      {shouldShowButtons && (
        <>
          <GhostIconButton
            icon="i-ph:bug"
            title="Report Bug"
            onClick={() =>
              window.open('https://github.com/stackblitz-labs/bolt.diy/issues/new?template=bug_report.yml', '_blank')
            }
          />
          <GhostIconButton
            icon="i-ph:download"
            title="Download Debug Log"
            onClick={async () => {
              try {
                const { downloadDebugLog } = await import('~/utils/debugLogger');
                await downloadDebugLog();
              } catch (error) {
                console.error('Failed to download debug log:', error);
              }
            }}
          />
        </>
      )}
    </div>
  );
}
