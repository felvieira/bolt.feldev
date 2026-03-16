import { useState, useEffect } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { IconButton } from '~/components/ui/IconButton';

const STORAGE_KEY = 'bolt_project_rules';

export function ProjectRulesButton() {
  const [open, setOpen] = useState(false);
  const [rules, setRules] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (open) {
      setRules(localStorage.getItem(STORAGE_KEY) || '');
      setSaved(false);
    }
  }, [open]);

  const handleSave = () => {
    localStorage.setItem(STORAGE_KEY, rules);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const hasRules = !!localStorage.getItem(STORAGE_KEY);

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <IconButton
          title="Project Rules"
          className={`transition-all flex items-center gap-1 ${hasRules ? 'text-accent-500' : ''}`}
        >
          <div className="i-ph:scroll text-xl" />
        </IconButton>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 z-[9998]" />
        <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[9999] bg-bolt-elements-background-depth-2 border border-bolt-elements-borderColor rounded-xl shadow-xl p-6 w-full max-w-lg">
          <Dialog.Title className="text-bolt-elements-textPrimary font-semibold text-base mb-1 flex items-center gap-2">
            <div className="i-ph:scroll text-lg text-accent-500" />
            Project Rules
          </Dialog.Title>
          <Dialog.Description className="text-bolt-elements-textSecondary text-sm mb-4">
            Rules defined here are injected into every LLM call for this browser session.
          </Dialog.Description>
          <textarea
            className="w-full bg-bolt-elements-background-depth-1 border border-bolt-elements-borderColor rounded-lg p-3 text-sm text-bolt-elements-textPrimary placeholder-bolt-elements-textTertiary resize-none focus:outline-none focus:border-accent-500 transition-colors"
            rows={6}
            placeholder="e.g. Always use TypeScript. Use Tailwind for styling. Primary color: #6366f1"
            value={rules}
            onChange={(e) => setRules(e.target.value)}
          />
          <div className="flex justify-end gap-2 mt-4">
            <Dialog.Close asChild>
              <button className="px-4 py-2 text-sm rounded-lg border border-bolt-elements-borderColor text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary transition-colors">
                Cancel
              </button>
            </Dialog.Close>
            <button
              onClick={handleSave}
              className="px-4 py-2 text-sm rounded-lg bg-[var(--surface-2)] text-[var(--text-secondary)] hover:bg-[var(--surface-3)] hover:text-[var(--text-primary)] transition-colors"
            >
              {saved ? 'Saved!' : 'Save Rules'}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
