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
    <div className="fixed inset-0 z-[100] flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.6)' }}>
      <div className="volt-card w-full mx-4" style={{ maxWidth: 420, padding: 32 }}>
        {/* Volt icon */}
        <div className="flex justify-center mb-4">
          <img
            src="/volt-logo.svg"
            alt="Volt"
            style={{ width: 48, height: 48, filter: 'brightness(0) invert(1)' }}
          />
        </div>

        <h2 className="text-lg font-semibold text-center mb-2" style={{ color: 'var(--text-primary)' }}>
          Welcome to Volt
        </h2>
        <p className="text-sm text-center mb-6" style={{ color: 'var(--text-secondary)' }}>
          AI-powered app builder. Describe what you want and watch it come to life.
        </p>

        <ul className="space-y-3 mb-6">
          <li className="flex items-start gap-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
            <span style={{ color: 'var(--accent)' }}>●</span>
            <span>Describe your app — Volt builds it</span>
          </li>
          <li className="flex items-start gap-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
            <span style={{ color: 'var(--accent)' }}>●</span>
            <span>Edit code live, preview instantly</span>
          </li>
          <li className="flex items-start gap-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
            <span style={{ color: 'var(--accent)' }}>●</span>
            <span>Deploy with one click</span>
          </li>
        </ul>

        <button onClick={handleClose} className="btn-primary w-full mb-4">
          Get Started
        </button>

        <label
          className="flex items-center justify-center gap-2 text-xs cursor-pointer select-none"
          style={{ color: 'var(--text-tertiary)' }}
        >
          <input
            type="checkbox"
            checked={dontShow}
            onChange={(e) => setDontShow(e.target.checked)}
            className="rounded"
            style={{ borderColor: 'var(--border-subtle)' }}
          />
          Don&apos;t show again
        </label>
      </div>
    </div>
  );
}
