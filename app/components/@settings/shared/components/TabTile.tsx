import * as Tooltip from '@radix-ui/react-tooltip';
import { classNames } from '~/utils/classNames';
import type { TabVisibilityConfig } from '~/components/@settings/core/types';
import { TAB_LABELS, TAB_ICONS } from '~/components/@settings/core/constants';

interface TabTileProps {
  tab: TabVisibilityConfig;
  onClick?: () => void;
  isActive?: boolean;
  hasUpdate?: boolean;
  statusMessage?: string;
  description?: string;
  isLoading?: boolean;
  className?: string;
  children?: React.ReactNode;
}

export const TabTile: React.FC<TabTileProps> = ({
  tab,
  onClick,
  isActive,
  hasUpdate,
  statusMessage,
  description,
  isLoading,
  className,
  children,
}: TabTileProps) => {
  return (
    <Tooltip.Provider delayDuration={0}>
      <Tooltip.Root>
        <Tooltip.Trigger asChild>
          <div className={classNames('min-h-[160px] list-none', className || '')}>
            <div className="relative h-full rounded-xl border border-[var(--bolt-elements-borderColor)] p-0.5">
              <div
                onClick={onClick}
                className={classNames(
                  'relative flex flex-col items-center justify-center h-full p-4 rounded-lg',
                  'bg-[var(--bolt-elements-bg-depth-2)]',
                  'group cursor-pointer',
                  'hover:bg-[var(--bolt-elements-bg-depth-3)]',
                  'transition-colors duration-100 ease-out',
                  isActive ? 'ring-1 ring-[var(--accent)]' : '',
                  isLoading ? 'cursor-wait opacity-70 pointer-events-none' : '',
                )}
              >
                {/* Icon */}
                <div
                  className={classNames(
                    'relative',
                    'w-14 h-14',
                    'flex items-center justify-center',
                    'rounded-xl',
                    'bg-[var(--bolt-elements-bg-depth-3)]',
                    'ring-1 ring-[var(--bolt-elements-borderColor)]',
                    'group-hover:ring-[var(--accent)]',
                    'transition-all duration-100 ease-out',
                    isActive ? 'ring-[var(--accent)]' : '',
                  )}
                >
                  {(() => {
                    const IconComponent = TAB_ICONS[tab.id];
                    return (
                      <IconComponent
                        className={classNames(
                          'w-8 h-8',
                          'text-[var(--text-secondary)]',
                          'group-hover:text-[var(--accent)]',
                          'transition-colors duration-100 ease-out',
                          isActive ? 'text-[var(--accent)]' : '',
                        )}
                      />
                    );
                  })()}
                </div>

                {/* Label and Description */}
                <div className="flex flex-col items-center mt-4 w-full">
                  <h3
                    className={classNames(
                      'text-[15px] font-medium leading-snug mb-2',
                      'text-[var(--text-primary)]',
                      'group-hover:text-[var(--accent)]',
                      'transition-colors duration-100 ease-out',
                      isActive ? 'text-[var(--accent)]' : '',
                    )}
                  >
                    {TAB_LABELS[tab.id]}
                  </h3>
                  {description && (
                    <p
                      className={classNames(
                        'text-[13px] leading-relaxed',
                        'text-[var(--text-secondary)]',
                        'max-w-[85%]',
                        'text-center',
                        'group-hover:text-[var(--text-primary)]',
                        'transition-colors duration-100 ease-out',
                        isActive ? 'text-[var(--text-primary)]' : '',
                      )}
                    >
                      {description}
                    </p>
                  )}
                </div>

                {/* Update Indicator with Tooltip */}
                {hasUpdate && (
                  <>
                    <div className="absolute top-4 right-4 w-2 h-2 rounded-full bg-[var(--accent)] animate-pulse" />
                    <Tooltip.Portal>
                      <Tooltip.Content
                        className={classNames(
                          'px-3 py-1.5 rounded-lg',
                          'bg-[var(--bolt-elements-bg-depth-1)] text-[var(--text-primary)]',
                          'text-sm font-medium',
                          'select-none',
                          'z-[100]',
                        )}
                        side="top"
                        sideOffset={5}
                      >
                        {statusMessage}
                        <Tooltip.Arrow className="fill-[var(--bolt-elements-bg-depth-1)]" />
                      </Tooltip.Content>
                    </Tooltip.Portal>
                  </>
                )}

                {/* Children (e.g. Beta Label) */}
                {children}
              </div>
            </div>
          </div>
        </Tooltip.Trigger>
      </Tooltip.Root>
    </Tooltip.Provider>
  );
};
