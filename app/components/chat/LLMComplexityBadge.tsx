import * as Tooltip from '@radix-ui/react-tooltip';

interface LLMComplexityBadgeProps {
  input: string;
  chatMode?: 'discuss' | 'build';
}

type ComplexityLevel = 'fast' | 'balanced' | 'advanced';

const COMPLEXITY_CONFIG: Record<ComplexityLevel, { icon: string; label: string; className: string }> = {
  fast: {
    icon: '⚡',
    label: 'Fast',
    className: 'text-yellow-500 bg-yellow-500/10',
  },
  balanced: {
    icon: '⚖️',
    label: 'Balanced',
    className: 'text-blue-500 bg-blue-500/10',
  },
  advanced: {
    icon: '🧠',
    label: 'Advanced',
    className: 'text-purple-500 bg-purple-500/10',
  },
};

const ADVANCED_KEYWORDS = /\b(refactor|architecture|redesign|complex|rewrite|migrate|optimize|scaffold)\b/i;

function detectComplexity(input: string, chatMode?: 'discuss' | 'build'): ComplexityLevel {
  if (chatMode === 'discuss') {
    return 'fast';
  }

  if (input.length > 200 || ADVANCED_KEYWORDS.test(input)) {
    return 'advanced';
  }

  return 'balanced';
}

export function LLMComplexityBadge({ input, chatMode }: LLMComplexityBadgeProps) {
  if (!input || input.length < 3) {
    return null;
  }

  const level = detectComplexity(input, chatMode);
  const config = COMPLEXITY_CONFIG[level];

  return (
    <Tooltip.Root>
      <Tooltip.Trigger asChild>
        <span
          className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium cursor-default select-none transition-all ${config.className}`}
        >
          <span>{config.icon}</span>
          <span>{config.label}</span>
        </span>
      </Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content
          className="z-[9999] px-3 py-2 text-xs rounded-lg bg-bolt-elements-background-depth-4 border border-bolt-elements-borderColor text-bolt-elements-textSecondary shadow-lg max-w-xs"
          sideOffset={5}
        >
          Suggested complexity for this task. You can always change the model manually.
          <Tooltip.Arrow className="fill-bolt-elements-background-depth-4" />
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}
