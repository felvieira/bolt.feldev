import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { classNames } from '~/utils/classNames';
import { toast } from 'react-toastify';
import Cookies from 'js-cookie';

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

const ChatGPTLoginSection: React.FC = () => {
  const [loginStatus, setLoginStatus] = useState<LoginStatus>('idle');
  const [account, setAccount] = useState<CodexAccount | null>(null);
  const [authUrl, setAuthUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [codexAvailable, setCodexAvailable] = useState<boolean | null>(null);
  const [callbackUrl, setCallbackUrl] = useState('');
  const [submittingCallback, setSubmittingCallback] = useState(false);
  const [sessionOwner, setSessionOwner] = useState<string | null>(null);

  useEffect(() => {
    checkStatus();
  }, []);

  useEffect(() => {
    if (loginStatus !== 'authenticated') {
      return;
    }

    const interval = setInterval(() => {
      refreshAccount();
    }, 60_000);

    return () => clearInterval(interval);
  }, [loginStatus]);

  useEffect(() => {
    const checkHealth = async () => {
      try {
        const res = await fetch('/api/codex/session-health', {
          signal: AbortSignal.timeout(10_000),
        });

        if (!res.ok) {
          console.warn(`[ChatGPT] session-health returned ${res.status}, keeping session cookie`);
          return;
        }

        const data = await res.json();

        if (data.sessionOwner) {
          setSessionOwner(data.sessionOwner);
        }

        if (data.authenticated === false && loginStatus === 'authenticated') {
          console.warn('[ChatGPT] session-health reports unauthenticated — clearing session');
          clearSessionToken();
          setAccount(null);
          setSessionOwner(null);
          setLoginStatus('idle');
        }
      } catch {
        console.warn('[ChatGPT] session-health fetch failed (network), keeping session cookie');
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
            console.warn('[ChatGPT] Proxy returned server error, keeping session cookie');
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
          console.warn('[ChatGPT] Could not reach proxy, keeping session cookie');
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
        toast.warning('ChatGPT session ended — another user may have logged in.');
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
          setError('Authentication timed out. Please try again.');
          return;
        }

        try {
          const accountRes = await fetch('/api/codex/account');
          const accountData = await accountRes.json();

          if (accountData.authenticated && accountData.account) {
            clearInterval(pollInterval);
            setAccount(accountData.account);
            setLoginStatus('authenticated');
            toast.success('ChatGPT connected successfully!');
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
      toast.success('Callback received! Checking authentication...');

      let callbackAttempts = 0;
      const maxCallbackAttempts = 15;

      const callbackPollInterval = setInterval(async () => {
        callbackAttempts++;

        if (callbackAttempts >= maxCallbackAttempts) {
          clearInterval(callbackPollInterval);
          setError('Authentication timed out after callback. Please try logging in again.');
          return;
        }

        try {
          const accountRes = await fetch('/api/codex/account');
          const accountData = await accountRes.json();

          if (accountData.authenticated && accountData.account) {
            clearInterval(callbackPollInterval);
            setAccount(accountData.account);
            setLoginStatus('authenticated');
            toast.success('ChatGPT connected successfully!');
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
      toast.success('Logged out from ChatGPT');
    } catch (err) {
      console.error('Logout failed:', err);
      toast.error('Failed to logout');
    }
  }, []);

  if (codexAvailable === false || codexAvailable === null) {
    return null;
  }

  const planStyle = account?.plan ? PLAN_STYLES[account.plan] || { bg: 'bg-gray-500/10', text: 'text-gray-400', label: account.plan } : null;

  return (
    <motion.div
      className="relative overflow-hidden rounded-xl"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
    >
      {/* Background gradient */}
      <div
        className="absolute inset-0 rounded-xl"
        style={{
          background: loginStatus === 'authenticated'
            ? 'linear-gradient(135deg, rgba(16,185,129,0.06) 0%, rgba(16,185,129,0.02) 100%)'
            : 'linear-gradient(135deg, rgba(99,102,241,0.06) 0%, rgba(99,102,241,0.02) 100%)',
        }}
      />

      {/* Border */}
      <div
        className="absolute inset-0 rounded-xl pointer-events-none"
        style={{
          border: loginStatus === 'authenticated'
            ? '1px solid rgba(16,185,129,0.15)'
            : '1px solid var(--bolt-elements-borderColor)',
        }}
      />

      <div className="relative p-4">
        {/* Header row */}
        <div className="flex items-center gap-3 mb-3">
          <div
            className={classNames(
              'w-9 h-9 flex items-center justify-center rounded-lg',
              loginStatus === 'authenticated'
                ? 'bg-emerald-500/10'
                : 'bg-bolt-elements-background-depth-3',
            )}
          >
            <svg viewBox="0 0 24 24" className={classNames(
              'w-5 h-5',
              loginStatus === 'authenticated' ? 'text-emerald-400' : 'text-bolt-elements-textSecondary',
            )} fill="currentColor">
              <path d="M22.282 9.821a5.985 5.985 0 0 0-.516-4.91 6.046 6.046 0 0 0-6.51-2.9A6.065 6.065 0 0 0 4.981 4.18a5.985 5.985 0 0 0-3.998 2.9 6.046 6.046 0 0 0 .743 7.097 5.98 5.98 0 0 0 .51 4.911 6.051 6.051 0 0 0 6.515 2.9A5.985 5.985 0 0 0 13.26 24a6.056 6.056 0 0 0 5.772-4.206 5.99 5.99 0 0 0 3.997-2.9 6.056 6.056 0 0 0-.747-7.073zM13.26 22.43a4.476 4.476 0 0 1-2.876-1.04l.141-.081 4.779-2.758a.795.795 0 0 0 .392-.681v-6.737l2.02 1.168a.071.071 0 0 1 .038.052v5.583a4.504 4.504 0 0 1-4.494 4.494zM3.6 18.304a4.47 4.47 0 0 1-.535-3.014l.142.085 4.783 2.759a.771.771 0 0 0 .78 0l5.843-3.369v2.332a.08.08 0 0 1-.033.062L9.74 19.95a4.5 4.5 0 0 1-6.14-1.646zM2.34 7.896a4.485 4.485 0 0 1 2.366-1.973V11.6a.766.766 0 0 0 .388.676l5.815 3.355-2.02 1.168a.076.076 0 0 1-.071 0l-4.83-2.786A4.504 4.504 0 0 1 2.34 7.872zm16.597 3.855l-5.833-3.387L15.119 7.2a.076.076 0 0 1 .071 0l4.83 2.791a4.494 4.494 0 0 1-.676 8.105v-5.678a.79.79 0 0 0-.407-.667zm2.01-3.023l-.141-.085-4.774-2.782a.776.776 0 0 0-.785 0L9.409 9.23V6.897a.066.066 0 0 1 .028-.061l4.83-2.787a4.5 4.5 0 0 1 6.68 4.66zm-12.64 4.135l-2.02-1.164a.08.08 0 0 1-.038-.057V6.075a4.5 4.5 0 0 1 7.375-3.453l-.142.08L8.704 5.46a.795.795 0 0 0-.393.681zm1.097-2.365l2.602-1.5 2.607 1.5v2.999l-2.597 1.5-2.607-1.5z"/>
            </svg>
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-semibold text-bolt-elements-textPrimary">ChatGPT</h4>
              {loginStatus === 'authenticated' && planStyle && (
                <span className={classNames('text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded', planStyle.bg, planStyle.text)}>
                  {planStyle.label}
                </span>
              )}
            </div>
            <p className="text-[11px] text-bolt-elements-textTertiary leading-tight">
              {loginStatus === 'authenticated'
                ? (account?.email || sessionOwner || 'Connected')
                : 'Use your ChatGPT subscription — no API key needed'}
            </p>
          </div>

          {/* Status indicator / Action */}
          <div className="flex items-center gap-2">
            <AnimatePresence mode="wait">
              {loginStatus === 'authenticated' ? (
                <motion.div
                  key="connected"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10"
                >
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  <span className="text-[11px] font-medium text-emerald-400">Connected</span>
                </motion.div>
              ) : loginStatus === 'installing' || loginStatus === 'pending' ? (
                <motion.div
                  key="connecting"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10"
                >
                  <div className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                  <span className="text-[11px] font-medium text-amber-400">
                    {loginStatus === 'installing' ? 'Preparing...' : 'Waiting...'}
                  </span>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>
        </div>

        {/* Content area */}
        <AnimatePresence mode="wait">
          {loginStatus === 'idle' && (
            <motion.div
              key="idle"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
            >
              <button
                onClick={handleLogin}
                className={classNames(
                  'w-full py-2.5 rounded-lg text-sm font-medium',
                  'bg-[#10a37f] hover:bg-[#0d8c6d] text-white',
                  'transition-all duration-200',
                  'flex items-center justify-center gap-2',
                )}
              >
                <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor">
                  <path d="M22.282 9.821a5.985 5.985 0 0 0-.516-4.91 6.046 6.046 0 0 0-6.51-2.9A6.065 6.065 0 0 0 4.981 4.18a5.985 5.985 0 0 0-3.998 2.9 6.046 6.046 0 0 0 .743 7.097 5.98 5.98 0 0 0 .51 4.911 6.051 6.051 0 0 0 6.515 2.9A5.985 5.985 0 0 0 13.26 24a6.056 6.056 0 0 0 5.772-4.206 5.99 5.99 0 0 0 3.997-2.9 6.056 6.056 0 0 0-.747-7.073zM13.26 22.43a4.476 4.476 0 0 1-2.876-1.04l.141-.081 4.779-2.758a.795.795 0 0 0 .392-.681v-6.737l2.02 1.168a.071.071 0 0 1 .038.052v5.583a4.504 4.504 0 0 1-4.494 4.494zM3.6 18.304a4.47 4.47 0 0 1-.535-3.014l.142.085 4.783 2.759a.771.771 0 0 0 .78 0l5.843-3.369v2.332a.08.08 0 0 1-.033.062L9.74 19.95a4.5 4.5 0 0 1-6.14-1.646zM2.34 7.896a4.485 4.485 0 0 1 2.366-1.973V11.6a.766.766 0 0 0 .388.676l5.815 3.355-2.02 1.168a.076.076 0 0 1-.071 0l-4.83-2.786A4.504 4.504 0 0 1 2.34 7.872zm16.597 3.855l-5.833-3.387L15.119 7.2a.076.076 0 0 1 .071 0l4.83 2.791a4.494 4.494 0 0 1-.676 8.105v-5.678a.79.79 0 0 0-.407-.667zm2.01-3.023l-.141-.085-4.774-2.782a.776.776 0 0 0-.785 0L9.409 9.23V6.897a.066.066 0 0 1 .028-.061l4.83-2.787a4.5 4.5 0 0 1 6.68 4.66zm-12.64 4.135l-2.02-1.164a.08.08 0 0 1-.038-.057V6.075a4.5 4.5 0 0 1 7.375-3.453l-.142.08L8.704 5.46a.795.795 0 0 0-.393.681zm1.097-2.365l2.602-1.5 2.607 1.5v2.999l-2.597 1.5-2.607-1.5z"/>
                </svg>
                Sign in with ChatGPT
              </button>
            </motion.div>
          )}

          {loginStatus === 'pending' && (
            <motion.div
              key="pending"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="space-y-3"
            >
              {authUrl && (
                <p className="text-[11px] text-bolt-elements-textTertiary">
                  A new tab should have opened.{' '}
                  <a href={authUrl} target="_blank" rel="noopener noreferrer" className="text-[var(--accent)] hover:underline">
                    Click here
                  </a>{' '}
                  if it didn't.
                </p>
              )}

              <div className="rounded-lg bg-bolt-elements-background-depth-3 p-3 space-y-2">
                <p className="text-[11px] text-bolt-elements-textSecondary">
                  <span className="font-medium text-bolt-elements-textPrimary">Remote access?</span>{' '}
                  Paste the callback URL from your browser after authenticating:
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
                      'focus:outline-none focus:ring-1 focus:ring-[var(--accent)] focus:border-[var(--accent)]',
                      'transition-all duration-150',
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
                      'px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap',
                      'bg-[var(--accent)] text-white',
                      'hover:brightness-110',
                      'disabled:opacity-40 disabled:cursor-not-allowed',
                      'transition-all duration-150',
                    )}
                  >
                    {submittingCallback ? 'Processing...' : 'Submit'}
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {loginStatus === 'authenticated' && account && (
            <motion.div
              key="authenticated"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
            >
              {account.plan === 'free' && (
                <div className="text-[11px] text-amber-400 bg-amber-500/10 rounded-lg px-3 py-2 mb-3">
                  ChatGPT Free does not support Codex. Upgrade to Plus/Pro/Team.
                </div>
              )}

              <div className="flex items-center gap-2">
                <button
                  onClick={refreshAccount}
                  className={classNames(
                    'px-3 py-1.5 rounded-lg text-xs font-medium',
                    'bg-bolt-elements-background-depth-3',
                    'text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary',
                    'border border-bolt-elements-borderColor hover:border-bolt-elements-borderColorActive',
                    'transition-all duration-150',
                  )}
                >
                  Refresh
                </button>
                <button
                  onClick={handleLogout}
                  className={classNames(
                    'px-3 py-1.5 rounded-lg text-xs font-medium',
                    'text-red-400 hover:text-red-300',
                    'hover:bg-red-500/10',
                    'transition-all duration-150',
                  )}
                >
                  Disconnect
                </button>
              </div>
            </motion.div>
          )}

          {loginStatus === 'error' && (
            <motion.div
              key="error"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="space-y-3"
            >
              <div className="text-[11px] text-red-400 bg-red-500/10 rounded-lg px-3 py-2">
                {error || 'Authentication failed'}
              </div>
              <button
                onClick={handleLogin}
                className={classNames(
                  'w-full py-2.5 rounded-lg text-sm font-medium',
                  'bg-[#10a37f] hover:bg-[#0d8c6d] text-white',
                  'transition-all duration-200',
                )}
              >
                Try Again
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};

export default ChatGPTLoginSection;
