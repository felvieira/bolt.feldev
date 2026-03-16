import type { Message } from 'ai';
import { useMemo } from 'react';

interface ContextWindowBarProps {
  messages: Message[];
}

const CONTEXT_CHAR_LIMIT = 800_000; // rough estimate for 200k token model

function getBarColor(pct: number): string {
  if (pct >= 85) {
    return 'bg-red-500';
  }

  if (pct >= 60) {
    return 'bg-yellow-500';
  }

  return 'bg-green-500';
}

export function ContextWindowBar({ messages }: ContextWindowBarProps) {
  const pct = useMemo(() => {
    const totalChars = messages.reduce((acc, m) => {
      const content = typeof m.content === 'string' ? m.content : '';
      return acc + content.length;
    }, 0);

    return Math.min(100, Math.round((totalChars / CONTEXT_CHAR_LIMIT) * 100));
  }, [messages]);

  if (pct < 5) {
    return null;
  }

  const barColor = getBarColor(pct);
  const isNearFull = pct >= 85;

  return (
    <div className="w-full max-w-chat mx-auto px-2 mb-2">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-xs text-bolt-elements-textTertiary">Context</span>
        <span className="text-xs text-bolt-elements-textTertiary ml-auto">{pct}%</span>
      </div>
      <div className="h-1 w-full bg-bolt-elements-background-depth-3 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${barColor}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      {isNearFull && (
        <p className="text-xs text-red-400 mt-1">
          Context nearly full — older messages may be summarized
        </p>
      )}
    </div>
  );
}
