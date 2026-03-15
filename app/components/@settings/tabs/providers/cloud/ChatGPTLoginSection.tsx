import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { classNames } from '~/utils/classNames';
import { toast } from 'react-toastify';
import { IoChatbubbleEllipses } from 'react-icons/io5';
import Cookies from 'js-cookie';

interface CodexAccount {
  type: 'chatgpt' | 'apiKey';
  email?: string;
  plan?: string;
}

type LoginStatus = 'idle' | 'installing' | 'pending' | 'authenticated' | 'error';

/**
 * Stores the Codex session token in a browser cookie.
 * This ensures:
 * - Only this browser can use the ChatGPT/Codex session
 * - The token is sent automatically with API requests via cookies
 * - Other users on the same bolt instance cannot piggyback
 */
function saveSessionToken(token: string) {
  Cookies.set('codexSession', token, { expires: 7 }); // 7 days

  // Also store it as an API key so the ChatGPT provider can use it
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

const ChatGPTLoginSection: React.FC = () => {
  const [loginStatus, setLoginStatus] = useState<LoginStatus>('idle');
  const [account, setAccount] = useState<CodexAccount | null>(null);
  const [authUrl, setAuthUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [codexAvailable, setCodexAvailable] = useState<boolean | null>(null);

  // Check if codex-proxy is available and if we have a stored session
  useEffect(() => {
    checkStatus();
  }, []);

  // Auto-refresh account every 60 seconds when authenticated
  useEffect(() => {
    if (loginStatus !== 'authenticated') {
      return;
    }

    const interval = setInterval(() => {
      refreshAccount();
    }, 60_000);

    return () => clearInterval(interval);
  }, [loginStatus]);

  const checkStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/codex/status');

      let data: any = {};

      try {
        data = await res.json();
      } catch {
        // Response wasn't JSON (e.g. HTML error page)
        setCodexAvailable(true); // Still show login UI
        return;
      }

      setCodexAvailable(true);

      // If codex-proxy reports not running, still show the UI
      if (data.available === false) {
        return;
      }

      // If we have a stored session token, check if it's still valid
      const token = getSessionToken();

      if (token) {
        try {
          const accountRes = await fetch('/api/codex/account');
          const accountData = await accountRes.json();

          if (accountData.authenticated && accountData.account) {
            setAccount(accountData.account);
            setLoginStatus('authenticated');
          } else {
            // Token expired or another user took over
            clearSessionToken();
          }
        } catch {
          // Account check failed, clear stale token
          clearSessionToken();
        }
      }
    } catch {
      // Even if codex-proxy is not available, still show the login UI
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
        // Session was invalidated (another user logged in)
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

      // Store the session token in the browser
      if (data.sessionToken) {
        saveSessionToken(data.sessionToken);
      }

      setAuthUrl(data.authUrl);
      setLoginStatus('pending');

      // Open the auth URL in a new tab
      window.open(data.authUrl, '_blank');

      // Poll for authentication
      let attempts = 0;
      const maxAttempts = 150; // 5 minutes

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

  if (codexAvailable === false) {
    return null; // Don't show if codex-proxy is not available
  }

  if (codexAvailable === null) {
    return null; // Loading
  }

  const planColor =
    account?.plan === 'plus' || account?.plan === 'pro' || account?.plan === 'team'
      ? 'text-green-500'
      : account?.plan === 'free'
        ? 'text-yellow-500'
        : 'text-bolt-elements-textSecondary';

  return (
    <motion.div
      className={classNames(
        'rounded-lg border bg-bolt-elements-background shadow-sm p-4 mb-6',
        'bg-bolt-elements-background-depth-2',
        'relative overflow-hidden',
      )}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="flex items-start gap-4">
        <motion.div
          className={classNames(
            'w-10 h-10 flex items-center justify-center rounded-xl',
            'bg-bolt-elements-background-depth-3',
            loginStatus === 'authenticated' ? 'text-green-500' : 'text-purple-500',
          )}
          whileHover={{ scale: 1.1 }}
        >
          <IoChatbubbleEllipses className="w-6 h-6" />
        </motion.div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-4 mb-2">
            <div>
              <h4 className="text-sm font-medium text-bolt-elements-textPrimary">
                ChatGPT Login (Codex)
              </h4>
              <p className="text-xs text-bolt-elements-textSecondary mt-0.5">
                Use your ChatGPT Plus/Pro/Team subscription — no API key needed
              </p>
            </div>
          </div>

          {loginStatus === 'idle' && (
            <motion.button
              onClick={handleLogin}
              className={classNames(
                'mt-2 px-4 py-2 rounded-lg text-sm font-medium',
                'bg-purple-500 hover:bg-purple-600 text-white',
                'transition-colors duration-200',
              )}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              Login with ChatGPT
            </motion.button>
          )}

          {loginStatus === 'installing' && (
            <div className="mt-2 flex items-center gap-2 text-sm text-bolt-elements-textSecondary">
              <div className="animate-spin w-4 h-4 border-2 border-purple-500 border-t-transparent rounded-full" />
              <span>Preparing Codex environment...</span>
            </div>
          )}

          {loginStatus === 'pending' && (
            <div className="mt-2">
              <div className="flex items-center gap-2 text-sm text-yellow-500 mb-2">
                <div className="animate-pulse w-2 h-2 rounded-full bg-yellow-500" />
                <span>Waiting for authentication...</span>
              </div>
              {authUrl && (
                <p className="text-xs text-bolt-elements-textSecondary">
                  A new tab should have opened. If not,{' '}
                  <a
                    href={authUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-purple-500 hover:underline"
                  >
                    click here to login
                  </a>
                  .
                </p>
              )}
            </div>
          )}

          {loginStatus === 'authenticated' && account && (
            <div className="mt-2 space-y-2">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                <span className="text-sm text-green-500 font-medium">Connected</span>
              </div>

              <div className="flex items-center gap-4 text-xs">
                {account.email && (
                  <span className="text-bolt-elements-textSecondary">{account.email}</span>
                )}
                {account.plan && (
                  <span className={classNames('font-medium uppercase', planColor)}>
                    {account.plan}
                  </span>
                )}
              </div>

              {account.plan === 'free' && (
                <div className="text-xs text-yellow-500 bg-yellow-500/10 rounded px-2 py-1">
                  ChatGPT Free does not support Codex. Upgrade to Plus/Pro/Team.
                </div>
              )}

              <div className="flex items-center gap-2 mt-2">
                <motion.button
                  onClick={refreshAccount}
                  className={classNames(
                    'px-3 py-1 rounded text-xs font-medium',
                    'bg-bolt-elements-background-depth-3 hover:bg-bolt-elements-background-depth-4',
                    'text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary',
                    'transition-colors duration-200',
                  )}
                  whileTap={{ scale: 0.95 }}
                >
                  Refresh
                </motion.button>
                <motion.button
                  onClick={handleLogout}
                  className={classNames(
                    'px-3 py-1 rounded text-xs font-medium',
                    'bg-red-500/10 hover:bg-red-500/20 text-red-500',
                    'transition-colors duration-200',
                  )}
                  whileTap={{ scale: 0.95 }}
                >
                  Logout
                </motion.button>
              </div>
            </div>
          )}

          {loginStatus === 'error' && (
            <div className="mt-2 space-y-2">
              <div className="text-xs text-red-500 bg-red-500/10 rounded px-2 py-1">
                {error || 'Authentication failed'}
              </div>
              <motion.button
                onClick={handleLogin}
                className={classNames(
                  'px-4 py-2 rounded-lg text-sm font-medium',
                  'bg-purple-500 hover:bg-purple-600 text-white',
                  'transition-colors duration-200',
                )}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                Try Again
              </motion.button>
            </div>
          )}
        </div>
      </div>

      {loginStatus === 'authenticated' && (
        <motion.div
          className="absolute inset-0 border-2 border-green-500/20 rounded-lg pointer-events-none"
          animate={{ borderColor: 'rgba(34, 197, 94, 0.2)' }}
          transition={{ duration: 0.2 }}
        />
      )}
    </motion.div>
  );
};

export default ChatGPTLoginSection;
