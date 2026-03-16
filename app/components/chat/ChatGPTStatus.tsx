import { useState, useEffect, useCallback } from 'react';
import { classNames } from '~/utils/classNames';
import { toast } from 'react-toastify';
import Cookies from 'js-cookie';
import { Dialog, DialogRoot, DialogClose, DialogTitle, DialogButton } from '~/components/ui/Dialog';

interface CodexAccount {
  type: 'chatgpt' | 'apiKey';
  email?: string;
  plan?: string;
}

type LoginStatus = 'idle' | 'installing' | 'pending' | 'authenticated' | 'error';

function saveSessionToken(token: string) {
  Cookies.set('codexSession', token, { expires: 7 });

  const currentKeys = Cookies.get('apiKeys');
  const keys = currentKeys ? JSON.parse(currentKeys) : {};
  keys['ChatGPT'] = token;
  Cookies.set('apiKeys', JSON.stringify(keys));
}

function getSessionToken(): string {
  return Cookies.get('codexSession') || '';
}

function clearSessionToken() {
  Cookies.remove('codexSession');

  const currentKeys = Cookies.get('apiKeys');

  if (currentKeys) {
    const keys = JSON.parse(currentKeys);
    delete keys['ChatGPT'];
    Cookies.set('apiKeys', JSON.stringify(keys));
  }
}

const PLAN_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  plus: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', label: 'Plus' },
  pro: { bg: 'bg-violet-500/10', text: 'text-violet-400', label: 'Pro' },
  team: { bg: 'bg-blue-500/10', text: 'text-blue-400', label: 'Team' },
  free: { bg: 'bg-amber-500/10', text: 'text-amber-400', label: 'Free' },
};

export function ChatGPTStatus() {
  const [loginStatus, setLoginStatus] = useState<LoginStatus>('idle');
  const [account, setAccount] = useState<CodexAccount | null>(null);
  const [authUrl, setAuthUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [codexAvailable, setCodexAvailable] = useState<boolean | null>(null);
  const [callbackUrl, setCallbackUrl] = useState('');
  const [submittingCallback, setSubmittingCallback] = useState(false);
  const [sessionOwner, setSessionOwner] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  useEffect(() => {
    checkStatus();
  }, []);

  useEffect(() => {
    if (loginStatus !== 'authenticated') {
      return;
    }

    const interval = setInterval(() => refreshAccount(), 60_000);

    return () => clearInterval(interval);
  }, [loginStatus]);

  useEffect(() => {
    const checkHealth = async () => {
      try {
        const res = await fetch('/api/codex/session-health', { signal: AbortSignal.timeout(10_000) });

        if (!res.ok) {
          return;
        }

        const data = await res.json();

        if (data.sessionOwner) {
          setSessionOwner(data.sessionOwner);
        }

        if (data.authenticated === false && loginStatus === 'authenticated') {
          clearSessionToken();
          setAccount(null);
          setSessionOwner(null);
          setLoginStatus('idle');
        }
      } catch {
        // Network error — keep session
      }
    };

    const interval = setInterval(checkHealth, 60_000);

    return () => clearInterval(interval);
  }, [loginStatus]);

  const checkStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/codex/status');
      let data: any = {};

      try {
        data = await res.json();
      } catch {
        setCodexAvailable(true);
        return;
      }

      setCodexAvailable(true);

      if (data.available === false) {
        return;
      }

      const token = getSessionToken();

      if (token) {
        try {
          const accountRes = await fetch('/api/codex/account');

          if (!accountRes.ok && accountRes.status >= 500) {
            return;
          }

          const accountData = await accountRes.json();

          if (accountData.authenticated && accountData.account) {
            setAccount(accountData.account);
            setLoginStatus('authenticated');
          } else {
            clearSessionToken();
          }
        } catch {
          // Keep cookie on network error
        }
      }
    } catch {
      setCodexAvailable(true);
    }
  }, []);

  const refreshAccount = useCallback(async () => {
    try {
      const res = await fetch('/api/codex/account');
      const data = await res.json();

      if (data.authenticated && data.account) {
        setAccount(data.account);
        setLoginStatus('authenticated');
      } else {
        clearSessionToken();
        setAccount(null);
        setLoginStatus('idle');
        toast.warning('ChatGPT session ended.');
      }
    } catch (err) {
      console.error('Failed to refresh account:', err);
    }
  }, []);

  const handleLogin = useCallback(async () => {
    setError(null);
    setLoginStatus('installing');

    try {
      const res = await fetch('/api/codex/login', { method: 'POST' });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Login failed');
      }

      if (data.sessionToken) {
        saveSessionToken(data.sessionToken);
      }

      setAuthUrl(data.authUrl);
      setLoginStatus('pending');
      window.open(data.authUrl, '_blank');

      let attempts = 0;
      const maxAttempts = 150;

      const pollInterval = setInterval(async () => {
        attempts++;

        if (attempts >= maxAttempts) {
          clearInterval(pollInterval);
          clearSessionToken();
          setLoginStatus('error');
          setError('Authentication timed out.');
          return;
        }

        try {
          const accountRes = await fetch('/api/codex/account');
          const accountData = await accountRes.json();

          if (accountData.authenticated && accountData.account) {
            clearInterval(pollInterval);
            setAccount(accountData.account);
            setLoginStatus('authenticated');
            toast.success('ChatGPT connected!');
          }
        } catch {
          // Keep polling
        }
      }, 2000);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Login failed';
      clearSessionToken();
      setError(message);
      setLoginStatus('error');
      toast.error(message);
    }
  }, []);

  const handleSubmitCallback = useCallback(async () => {
    if (!callbackUrl.trim()) {
      return;
    }

    setSubmittingCallback(true);

    try {
      const res = await fetch('/api/codex/callback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ callbackUrl: callbackUrl.trim() }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Callback failed');
      }

      setCallbackUrl('');
      toast.success('Callback received!');

      let callbackAttempts = 0;
      const callbackPollInterval = setInterval(async () => {
        callbackAttempts++;

        if (callbackAttempts >= 15) {
          clearInterval(callbackPollInterval);
          setError('Authentication timed out after callback.');
          return;
        }

        try {
          const accountRes = await fetch('/api/codex/account');
          const accountData = await accountRes.json();

          if (accountData.authenticated && accountData.account) {
            clearInterval(callbackPollInterval);
            setAccount(accountData.account);
            setLoginStatus('authenticated');
            toast.success('ChatGPT connected!');
          }
        } catch {
          // Keep polling
        }
      }, 2000);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to process callback';
      toast.error(message);
      setError(message);
    } finally {
      setSubmittingCallback(false);
    }
  }, [callbackUrl]);

  const handleLogout = useCallback(async () => {
    try {
      await fetch('/api/codex/logout', { method: 'POST' });
      clearSessionToken();
      setAccount(null);
      setLoginStatus('idle');
      setAuthUrl(null);
      toast.success('Disconnected from ChatGPT');
    } catch {
      toast.error('Failed to logout');
    }
  }, []);

  if (codexAvailable === false || codexAvailable === null) {
    return null;
  }

  const planStyle = account?.plan ? PLAN_STYLES[account.plan] : null;

  // Status dot color
  const dotColor =
    loginStatus === 'authenticated'
      ? 'bg-emerald-400'
      : loginStatus === 'pending' || loginStatus === 'installing'
        ? 'bg-amber-400 animate-pulse'
        : loginStatus === 'error'
          ? 'bg-red-400'
          : 'bg-bolt-elements-textTertiary';

  return (
    <div className="relative">
      <div className="flex border border-bolt-elements-borderColor rounded-md overflow-hidden mr-2 text-sm">
        <button
          onClick={() => setIsDialogOpen(!isDialogOpen)}
          className={classNames(
            'flex items-center gap-2 p-1.5',
            'bg-bolt-elements-item-backgroundDefault',
            'hover:bg-bolt-elements-item-backgroundActive',
            'text-bolt-elements-item-contentAccent',
            'transition-colors duration-150',
          )}
        >
          {/* OpenAI icon */}
          <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor">
            <path d="M22.282 9.821a5.985 5.985 0 0 0-.516-4.91 6.046 6.046 0 0 0-6.51-2.9A6.065 6.065 0 0 0 4.981 4.18a5.985 5.985 0 0 0-3.998 2.9 6.046 6.046 0 0 0 .743 7.097 5.98 5.98 0 0 0 .51 4.911 6.051 6.051 0 0 0 6.515 2.9A5.985 5.985 0 0 0 13.26 24a6.056 6.056 0 0 0 5.772-4.206 5.99 5.99 0 0 0 3.997-2.9 6.056 6.056 0 0 0-.747-7.073zM13.26 22.43a4.476 4.476 0 0 1-2.876-1.04l.141-.081 4.779-2.758a.795.795 0 0 0 .392-.681v-6.737l2.02 1.168a.071.071 0 0 1 .038.052v5.583a4.504 4.504 0 0 1-4.494 4.494zM3.6 18.304a4.47 4.47 0 0 1-.535-3.014l.142.085 4.783 2.759a.771.771 0 0 0 .78 0l5.843-3.369v2.332a.08.08 0 0 1-.033.062L9.74 19.95a4.5 4.5 0 0 1-6.14-1.646zM2.34 7.896a4.485 4.485 0 0 1 2.366-1.973V11.6a.766.766 0 0 0 .388.676l5.815 3.355-2.02 1.168a.076.076 0 0 1-.071 0l-4.83-2.786A4.504 4.504 0 0 1 2.34 7.872zm16.597 3.855l-5.833-3.387L15.119 7.2a.076.076 0 0 1 .071 0l4.83 2.791a4.494 4.494 0 0 1-.676 8.105v-5.678a.79.79 0 0 0-.407-.667zm2.01-3.023l-.141-.085-4.774-2.782a.776.776 0 0 0-.785 0L9.409 9.23V6.897a.066.066 0 0 1 .028-.061l4.83-2.787a4.5 4.5 0 0 1 6.68 4.66zm-12.64 4.135l-2.02-1.164a.08.08 0 0 1-.038-.057V6.075a4.5 4.5 0 0 1 7.375-3.453l-.142.08L8.704 5.46a.795.795 0 0 0-.393.681zm1.097-2.365l2.602-1.5 2.607 1.5v2.999l-2.597 1.5-2.607-1.5z" />
          </svg>
          {/* Status dot */}
          <div className={classNames('w-1.5 h-1.5 rounded-full', dotColor)} />
          {loginStatus === 'authenticated' && account?.email && (
            <span className="ml-0.5 text-xs max-w-[100px] truncate text-bolt-elements-textSecondary">
              {account.email.split('@')[0]}
            </span>
          )}
        </button>
      </div>

      <DialogRoot open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        {isDialogOpen && (
          <Dialog className="max-w-[420px] p-6">
            {loginStatus === 'authenticated' && account ? (
              <div className="space-y-4">
                <DialogTitle>
                  <svg viewBox="0 0 24 24" className="w-5 h-5 text-emerald-400" fill="currentColor">
                    <path d="M22.282 9.821a5.985 5.985 0 0 0-.516-4.91 6.046 6.046 0 0 0-6.51-2.9A6.065 6.065 0 0 0 4.981 4.18a5.985 5.985 0 0 0-3.998 2.9 6.046 6.046 0 0 0 .743 7.097 5.98 5.98 0 0 0 .51 4.911 6.051 6.051 0 0 0 6.515 2.9A5.985 5.985 0 0 0 13.26 24a6.056 6.056 0 0 0 5.772-4.206 5.99 5.99 0 0 0 3.997-2.9 6.056 6.056 0 0 0-.747-7.073zM13.26 22.43a4.476 4.476 0 0 1-2.876-1.04l.141-.081 4.779-2.758a.795.795 0 0 0 .392-.681v-6.737l2.02 1.168a.071.071 0 0 1 .038.052v5.583a4.504 4.504 0 0 1-4.494 4.494zM3.6 18.304a4.47 4.47 0 0 1-.535-3.014l.142.085 4.783 2.759a.771.771 0 0 0 .78 0l5.843-3.369v2.332a.08.08 0 0 1-.033.062L9.74 19.95a4.5 4.5 0 0 1-6.14-1.646zM2.34 7.896a4.485 4.485 0 0 1 2.366-1.973V11.6a.766.766 0 0 0 .388.676l5.815 3.355-2.02 1.168a.076.076 0 0 1-.071 0l-4.83-2.786A4.504 4.504 0 0 1 2.34 7.872zm16.597 3.855l-5.833-3.387L15.119 7.2a.076.076 0 0 1 .071 0l4.83 2.791a4.494 4.494 0 0 1-.676 8.105v-5.678a.79.79 0 0 0-.407-.667zm2.01-3.023l-.141-.085-4.774-2.782a.776.776 0 0 0-.785 0L9.409 9.23V6.897a.066.066 0 0 1 .028-.061l4.83-2.787a4.5 4.5 0 0 1 6.68 4.66zm-12.64 4.135l-2.02-1.164a.08.08 0 0 1-.038-.057V6.075a4.5 4.5 0 0 1 7.375-3.453l-.142.08L8.704 5.46a.795.795 0 0 0-.393.681zm1.097-2.365l2.602-1.5 2.607 1.5v2.999l-2.597 1.5-2.607-1.5z" />
                  </svg>
                  ChatGPT Connected
                </DialogTitle>

                <div className="flex items-center gap-3 p-3 rounded-lg bg-bolt-elements-background-depth-1">
                  <div className="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center">
                    <div className="w-2 h-2 rounded-full bg-emerald-400" />
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-bolt-elements-textPrimary">
                      {account.email || sessionOwner || 'Connected'}
                    </h4>
                    {planStyle && (
                      <span className={classNames('text-[10px] font-bold uppercase tracking-wider', planStyle.text)}>
                        {planStyle.label}
                      </span>
                    )}
                  </div>
                </div>

                {account.plan === 'free' && (
                  <div className="text-xs text-amber-400 bg-amber-500/10 rounded-lg px-3 py-2">
                    ChatGPT Free does not support Codex. Upgrade to Plus/Pro/Team.
                  </div>
                )}

                <div className="flex justify-end gap-2 mt-4">
                  <DialogButton type="secondary" onClick={refreshAccount}>
                    Refresh
                  </DialogButton>
                  <DialogButton type="danger" onClick={handleLogout}>
                    Disconnect
                  </DialogButton>
                </div>
              </div>
            ) : loginStatus === 'pending' || loginStatus === 'installing' ? (
              <div className="space-y-4">
                <DialogTitle>
                  <svg viewBox="0 0 24 24" className="w-5 h-5 text-amber-400" fill="currentColor">
                    <path d="M22.282 9.821a5.985 5.985 0 0 0-.516-4.91 6.046 6.046 0 0 0-6.51-2.9A6.065 6.065 0 0 0 4.981 4.18a5.985 5.985 0 0 0-3.998 2.9 6.046 6.046 0 0 0 .743 7.097 5.98 5.98 0 0 0 .51 4.911 6.051 6.051 0 0 0 6.515 2.9A5.985 5.985 0 0 0 13.26 24a6.056 6.056 0 0 0 5.772-4.206 5.99 5.99 0 0 0 3.997-2.9 6.056 6.056 0 0 0-.747-7.073zM13.26 22.43a4.476 4.476 0 0 1-2.876-1.04l.141-.081 4.779-2.758a.795.795 0 0 0 .392-.681v-6.737l2.02 1.168a.071.071 0 0 1 .038.052v5.583a4.504 4.504 0 0 1-4.494 4.494zM3.6 18.304a4.47 4.47 0 0 1-.535-3.014l.142.085 4.783 2.759a.771.771 0 0 0 .78 0l5.843-3.369v2.332a.08.08 0 0 1-.033.062L9.74 19.95a4.5 4.5 0 0 1-6.14-1.646zM2.34 7.896a4.485 4.485 0 0 1 2.366-1.973V11.6a.766.766 0 0 0 .388.676l5.815 3.355-2.02 1.168a.076.076 0 0 1-.071 0l-4.83-2.786A4.504 4.504 0 0 1 2.34 7.872zm16.597 3.855l-5.833-3.387L15.119 7.2a.076.076 0 0 1 .071 0l4.83 2.791a4.494 4.494 0 0 1-.676 8.105v-5.678a.79.79 0 0 0-.407-.667zm2.01-3.023l-.141-.085-4.774-2.782a.776.776 0 0 0-.785 0L9.409 9.23V6.897a.066.066 0 0 1 .028-.061l4.83-2.787a4.5 4.5 0 0 1 6.68 4.66zm-12.64 4.135l-2.02-1.164a.08.08 0 0 1-.038-.057V6.075a4.5 4.5 0 0 1 7.375-3.453l-.142.08L8.704 5.46a.795.795 0 0 0-.393.681zm1.097-2.365l2.602-1.5 2.607 1.5v2.999l-2.597 1.5-2.607-1.5z" />
                  </svg>
                  Connecting to ChatGPT
                </DialogTitle>

                <div className="flex items-center gap-2 text-sm text-amber-400">
                  <div className="animate-pulse w-2 h-2 rounded-full bg-amber-400" />
                  {loginStatus === 'installing' ? 'Preparing Codex environment...' : 'Waiting for authentication...'}
                </div>

                {authUrl && (
                  <p className="text-xs text-bolt-elements-textSecondary">
                    A new tab should have opened.{' '}
                    <a href={authUrl} target="_blank" rel="noopener noreferrer" className="text-[var(--accent)] hover:underline">
                      Click here
                    </a>{' '}
                    if it didn't.
                  </p>
                )}

                <div className="rounded-lg bg-bolt-elements-background-depth-1 p-3 space-y-2">
                  <p className="text-xs text-bolt-elements-textSecondary">
                    <span className="font-medium text-bolt-elements-textPrimary">Remote access?</span>{' '}
                    Paste the callback URL after authenticating:
                  </p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={callbackUrl}
                      onChange={(e) => setCallbackUrl(e.target.value)}
                      placeholder="localhost:1455/auth/callback?code=..."
                      className={classNames(
                        'flex-1 px-3 py-1.5 text-xs rounded-lg font-mono',
                        'bg-bolt-elements-background-depth-2 border border-bolt-elements-borderColor',
                        'text-bolt-elements-textPrimary placeholder-bolt-elements-textTertiary',
                        'focus:outline-none focus:ring-1 focus:ring-[var(--accent)]',
                      )}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handleSubmitCallback();
                        }
                      }}
                    />
                    <button
                      onClick={handleSubmitCallback}
                      disabled={submittingCallback || !callbackUrl.trim()}
                      className={classNames(
                        'px-3 py-1.5 rounded-lg text-xs font-medium',
                        'bg-[var(--accent)] text-white hover:brightness-110',
                        'disabled:opacity-40 disabled:cursor-not-allowed',
                      )}
                    >
                      {submittingCallback ? '...' : 'Submit'}
                    </button>
                  </div>
                </div>

                <div className="flex justify-end">
                  <DialogClose asChild>
                    <DialogButton type="secondary">Cancel</DialogButton>
                  </DialogClose>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <DialogTitle>
                  <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor">
                    <path d="M22.282 9.821a5.985 5.985 0 0 0-.516-4.91 6.046 6.046 0 0 0-6.51-2.9A6.065 6.065 0 0 0 4.981 4.18a5.985 5.985 0 0 0-3.998 2.9 6.046 6.046 0 0 0 .743 7.097 5.98 5.98 0 0 0 .51 4.911 6.051 6.051 0 0 0 6.515 2.9A5.985 5.985 0 0 0 13.26 24a6.056 6.056 0 0 0 5.772-4.206 5.99 5.99 0 0 0 3.997-2.9 6.056 6.056 0 0 0-.747-7.073zM13.26 22.43a4.476 4.476 0 0 1-2.876-1.04l.141-.081 4.779-2.758a.795.795 0 0 0 .392-.681v-6.737l2.02 1.168a.071.071 0 0 1 .038.052v5.583a4.504 4.504 0 0 1-4.494 4.494zM3.6 18.304a4.47 4.47 0 0 1-.535-3.014l.142.085 4.783 2.759a.771.771 0 0 0 .78 0l5.843-3.369v2.332a.08.08 0 0 1-.033.062L9.74 19.95a4.5 4.5 0 0 1-6.14-1.646zM2.34 7.896a4.485 4.485 0 0 1 2.366-1.973V11.6a.766.766 0 0 0 .388.676l5.815 3.355-2.02 1.168a.076.076 0 0 1-.071 0l-4.83-2.786A4.504 4.504 0 0 1 2.34 7.872zm16.597 3.855l-5.833-3.387L15.119 7.2a.076.076 0 0 1 .071 0l4.83 2.791a4.494 4.494 0 0 1-.676 8.105v-5.678a.79.79 0 0 0-.407-.667zm2.01-3.023l-.141-.085-4.774-2.782a.776.776 0 0 0-.785 0L9.409 9.23V6.897a.066.066 0 0 1 .028-.061l4.83-2.787a4.5 4.5 0 0 1 6.68 4.66zm-12.64 4.135l-2.02-1.164a.08.08 0 0 1-.038-.057V6.075a4.5 4.5 0 0 1 7.375-3.453l-.142.08L8.704 5.46a.795.795 0 0 0-.393.681zm1.097-2.365l2.602-1.5 2.607 1.5v2.999l-2.597 1.5-2.607-1.5z" />
                  </svg>
                  Connect ChatGPT
                </DialogTitle>

                <p className="text-sm text-bolt-elements-textSecondary">
                  Use your ChatGPT Plus/Pro/Team subscription — no API key needed.
                </p>

                {error && (
                  <div className="text-xs text-red-400 bg-red-500/10 rounded-lg px-3 py-2">{error}</div>
                )}

                <div className="flex justify-end gap-2">
                  <DialogClose asChild>
                    <DialogButton type="secondary">Cancel</DialogButton>
                  </DialogClose>
                  <button
                    onClick={handleLogin}
                    className={classNames(
                      'px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2',
                      'bg-[#10a37f] text-white hover:bg-[#0d8c6d]',
                    )}
                  >
                    <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor">
                      <path d="M22.282 9.821a5.985 5.985 0 0 0-.516-4.91 6.046 6.046 0 0 0-6.51-2.9A6.065 6.065 0 0 0 4.981 4.18a5.985 5.985 0 0 0-3.998 2.9 6.046 6.046 0 0 0 .743 7.097 5.98 5.98 0 0 0 .51 4.911 6.051 6.051 0 0 0 6.515 2.9A5.985 5.985 0 0 0 13.26 24a6.056 6.056 0 0 0 5.772-4.206 5.99 5.99 0 0 0 3.997-2.9 6.056 6.056 0 0 0-.747-7.073zM13.26 22.43a4.476 4.476 0 0 1-2.876-1.04l.141-.081 4.779-2.758a.795.795 0 0 0 .392-.681v-6.737l2.02 1.168a.071.071 0 0 1 .038.052v5.583a4.504 4.504 0 0 1-4.494 4.494z" />
                    </svg>
                    Sign in with ChatGPT
                  </button>
                </div>
              </div>
            )}
          </Dialog>
        )}
      </DialogRoot>
    </div>
  );
}
