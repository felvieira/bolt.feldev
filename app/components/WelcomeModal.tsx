import { useState, useEffect } from 'react';

const STORAGE_KEY = 'bolt_welcome_shown';

export function WelcomeModal() {
  const [visible, setVisible] = useState(false);
  const [dontShow, setDontShow] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem(STORAGE_KEY)) {
        setVisible(true);
      }
    } catch {
      // localStorage unavailable
    }
  }, []);

  function handleClose() {
    setVisible(false);

    try {
      if (dontShow) {
        localStorage.setItem(STORAGE_KEY, 'true');
      }
    } catch {
      // ignore
    }
  }

  if (!visible) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60">
      <div className="w-full max-w-md mx-4 p-6 rounded-lg bg-bolt-elements-background-depth-2 border border-bolt-elements-borderColor shadow-xl">
        <h2 className="text-2xl font-bold text-bolt-elements-textPrimary mb-3">
          Welcome to Bolt! {'\u{1F680}'}
        </h2>
        <p className="text-sm text-bolt-elements-textSecondary mb-4">
          AI-powered app builder. Describe what you want and watch it come to life.
        </p>

        <ul className="space-y-2 mb-6 text-sm text-bolt-elements-textSecondary">
          <li className="flex items-start gap-2">
            <div className="i-ph:lightbulb text-accent mt-0.5 shrink-0" />
            <span>Describe your app in 2-3 sentences for best results</span>
          </li>
          <li className="flex items-start gap-2">
            <div className="i-ph:eye text-accent mt-0.5 shrink-0" />
            <span>Use Plan mode to preview changes before building</span>
          </li>
          <li className="flex items-start gap-2">
            <div className="i-ph:gear text-accent mt-0.5 shrink-0" />
            <span>Set Project Rules to customize AI behavior</span>
          </li>
        </ul>

        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 text-xs text-bolt-elements-textTertiary cursor-pointer select-none">
            <input
              type="checkbox"
              checked={dontShow}
              onChange={(e) => setDontShow(e.target.checked)}
              className="rounded border-bolt-elements-borderColor"
            />
            Don&apos;t show again
          </label>
          <button
            onClick={handleClose}
            className="px-4 py-2 rounded-md bg-accent text-white text-sm font-medium hover:brightness-110 transition-all"
          >
            Get Started
          </button>
        </div>
      </div>
    </div>
  );
}
