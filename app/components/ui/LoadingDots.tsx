import { memo } from 'react';

interface LoadingDotsProps {
  text?: string;
}

export const LoadingDots = memo(({ text }: LoadingDotsProps) => {
  return (
    <div className="flex items-center gap-1.5">
      {text && <span className="text-bolt-elements-textSecondary text-sm">{text}</span>}
      <div className="flex items-center gap-1">
        <span
          className="w-1.5 h-1.5 rounded-full bg-[var(--accent)]"
          style={{ animation: 'dotPulse 1.4s infinite ease-in-out', animationDelay: '0s' }}
        />
        <span
          className="w-1.5 h-1.5 rounded-full bg-[var(--accent)]"
          style={{ animation: 'dotPulse 1.4s infinite ease-in-out', animationDelay: '0.2s' }}
        />
        <span
          className="w-1.5 h-1.5 rounded-full bg-[var(--accent)]"
          style={{ animation: 'dotPulse 1.4s infinite ease-in-out', animationDelay: '0.4s' }}
        />
      </div>
      <style>{`
        @keyframes dotPulse {
          0%, 80%, 100% { opacity: 0.3; transform: scale(0.8); }
          40% { opacity: 1; transform: scale(1.2); }
        }
      `}</style>
    </div>
  );
});
