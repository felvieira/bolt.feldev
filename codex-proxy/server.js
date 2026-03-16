import express from 'express';
import cors from 'cors';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { CodexManager } from './codex-manager.js';

const app = express();
const PORT = process.env.CODEX_PROXY_PORT || 3100;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// ─── Multi-session manager map ──────────────────────────────────────
// Each user gets their own CodexManager instance, keyed by x-user-id.
// For backwards compatibility, requests without x-user-id use 'default'.

/** @type {Map<string, { codex: CodexManager, activeSessionToken: string|null, pendingSessionToken: string|null, lastTokenRefresh: string|null, lastActivity: number }>} */
const userSessions = new Map();

const INACTIVITY_TIMEOUT_MS = 60 * 60 * 1000; // 1 hour

const SESSION_DIR = path.join('/app', '.sessions');

function ensureSessionDir() {
  try {
    if (!fs.existsSync(SESSION_DIR)) {
      fs.mkdirSync(SESSION_DIR, { recursive: true });
    }
  } catch {
    // Fallback: use /app directly for single-session compat
  }
}

function sessionFilePath(userId) {
  if (userId === 'default') {
    return path.join('/app', '.session_token');
  }
  ensureSessionDir();
  return path.join(SESSION_DIR, `.session_${userId}`);
}

function saveSessionToken(userId, token) {
  try {
    const filePath = sessionFilePath(userId);
    if (token) {
      fs.writeFileSync(filePath, token, 'utf8');
    } else {
      fs.rmSync(filePath, { force: true });
    }
  } catch (err) {
    console.warn(`[session:${userId}] Failed to persist session token: ${err.message}`);
  }
}

function loadSessionToken(userId) {
  try {
    const filePath = sessionFilePath(userId);
    if (fs.existsSync(filePath)) {
      return fs.readFileSync(filePath, 'utf8').trim();
    }
  } catch (err) {
    console.warn(`[session:${userId}] Failed to load session token: ${err.message}`);
  }
  return null;
}

function getUserId(req) {
  const id = req.headers['x-user-id'];
  // Without auth, all requests share 'default'. With auth, each user gets their own session.
  if (!id || id === 'anonymous') return 'default';
  return id;
}

function getOrCreateSession(userId) {
  let session = userSessions.get(userId);
  if (!session) {
    console.log(`[multi-session] Creating new CodexManager for user: ${userId}`);
    const savedToken = loadSessionToken(userId);
    session = {
      codex: new CodexManager(userId),
      activeSessionToken: savedToken || null,
      pendingSessionToken: null,
      lastTokenRefresh: null,
      lastActivity: Date.now(),
    };
    userSessions.set(userId, session);
    if (savedToken) {
      console.log(`[multi-session] Restored saved session token for user: ${userId}`);
    }
  }
  session.lastActivity = Date.now();
  return session;
}

// Periodically clean up inactive user sessions
setInterval(() => {
  const now = Date.now();
  for (const [userId, session] of userSessions) {
    if (now - session.lastActivity > INACTIVITY_TIMEOUT_MS) {
      console.log(`[multi-session] Evicting inactive session for user: ${userId}`);
      session.codex.kill().catch(() => {});
      userSessions.delete(userId);
    }
  }
}, 5 * 60 * 1000); // Check every 5 minutes

async function requireSession(req, res, next) {
  const userId = getUserId(req);
  const session = getOrCreateSession(userId);

  // If session has an active token, allow the request
  if (session.activeSessionToken) {
    req._userSession = session;
    req._userId = userId;
    return next();
  }

  // No active token — check if sidecar is actually authenticated
  try {
    const account = await session.codex.getAccount(false);
    if (account && (account.email || account.type)) {
      // Sidecar is authenticated but we don't have a token stored.
      // Generate a token and store it.
      const token = crypto.randomBytes(32).toString('hex');
      session.activeSessionToken = token;
      saveSessionToken(userId, token);
      console.log(`[requireSession:${userId}] Sidecar authenticated (${account.email || 'unknown'}), generated token`);
      req._userSession = session;
      req._userId = userId;
      return next();
    }
  } catch {
    // Sidecar not authenticated
  }

  console.log(`[requireSession:${userId}] REJECTED ${req.method} ${req.path}`);
  return res.status(401).json({
    error: 'No active Codex session. Login with ChatGPT first.',
    authenticated: false,
  });
}

// ─── Public endpoints (no session required) ─────────────────────────

// Health check
app.get('/health', (_req, res) => {
  const activeSessions = [...userSessions.entries()]
    .filter(([, s]) => !!s.activeSessionToken)
    .map(([id]) => id);

  res.json({
    status: 'ok',
    activeUserSessions: activeSessions.length,
    users: activeSessions,
  });
});

// Check status (public — frontend uses this to decide whether to show login UI)
app.get('/codex/status', (req, res) => {
  const userId = getUserId(req);
  const session = getOrCreateSession(userId);

  try {
    res.json({
      running: session?.codex?.initialized || false,
      hasActiveSession: !!session?.activeSessionToken,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Session health — called by the frontend heartbeat to verify session is still alive
app.get('/codex/session-health', async (req, res) => {
  const userId = getUserId(req);
  const session = getOrCreateSession(userId);
  const authenticated = !!session?.activeSessionToken;
  let sessionOwner = null;

  if (authenticated && session) {
    try {
      const account = await session.codex.getAccount(false);
      sessionOwner = account?.email || null;
    } catch {
      // Non-fatal — sidecar may be temporarily busy
    }
  }

  const codexRunning = !!(session?.codex?.process && !session.codex.process.killed);

  res.json({
    authenticated,
    sessionOwner,
    lastRefresh: session?.lastTokenRefresh || null,
    codexRunning,
  });
});

// Diagnostic: check if sidecar HTTP server at 1455 is reachable
app.get('/codex/diag', async (req, res) => {
  const userId = getUserId(req);
  const session = getOrCreateSession(userId);
  const codex = session.codex;

  const result = {
    userId,
    codexInitialized: codex.initialized,
    hasPendingToken: !!session.pendingSessionToken,
    hasActiveSession: !!session.activeSessionToken,
    sidecar1455: null,
    codexBinary: null,
    spawnTest: null,
  };

  // Check if codex binary exists
  try {
    const { execSync } = await import('child_process');
    const which = execSync('which codex || where codex 2>/dev/null || echo NOT_FOUND', { encoding: 'utf8', timeout: 3000 }).trim();
    const version = execSync('codex --version 2>&1 || echo VERSION_FAILED', { encoding: 'utf8', timeout: 5000 }).trim();
    result.codexBinary = { found: !which.includes('NOT_FOUND'), path: which, version };
  } catch (err) {
    result.codexBinary = { found: false, error: err.message };
  }

  // Try spawning sidecar if not running
  if (!codex.initialized) {
    try {
      await codex.ensureRunning();
      result.spawnTest = { success: true };
    } catch (err) {
      result.spawnTest = { success: false, error: err.message };
    }
  } else {
    result.spawnTest = { success: true, note: 'already running' };
  }

  // Check port 1455 (might only open after account/login/start)
  try {
    const probe = await fetch('http://127.0.0.1:1455/auth/callback?code=diag_probe&state=diag_probe', {
      redirect: 'manual',
      signal: AbortSignal.timeout(3000),
    });
    result.sidecar1455 = { reachable: true, status: probe.status };
  } catch (err) {
    result.sidecar1455 = { reachable: false, error: err.message };
  }

  // If port 1455 not reachable, test if it opens after account/login/start
  if (!result.sidecar1455.reachable) {
    try {
      const loginResult = await codex.startLogin();
      result.loginStartResult = { success: true, hasAuthUrl: !!loginResult.authUrl, authUrlPrefix: loginResult.authUrl?.substring(0, 60) };

      // Wait a moment for the HTTP server to bind
      await new Promise((r) => setTimeout(r, 1000));

      const probe2 = await fetch('http://127.0.0.1:1455/auth/callback?code=diag_probe&state=diag_probe', {
        redirect: 'manual',
        signal: AbortSignal.timeout(3000),
      });
      result.sidecar1455AfterLogin = { reachable: true, status: probe2.status };
    } catch (err) {
      result.loginStartResult = result.loginStartResult ?? { success: false, error: err.message };
      result.sidecar1455AfterLogin = { reachable: false, error: err.message };
    }
  }

  res.json(result);
});

// Start OAuth login flow — per-user session
app.post('/codex/login', async (req, res) => {
  const userId = getUserId(req);
  const session = getOrCreateSession(userId);

  try {
    // Invalidate previous session for THIS user only
    session.activeSessionToken = null;
    saveSessionToken(userId, null);

    const result = await session.codex.startLogin();

    // Generate a new session token for this login attempt
    const pendingToken = crypto.randomBytes(32).toString('hex');
    session.pendingSessionToken = pendingToken;

    res.json({
      ...result,
      sessionToken: pendingToken,
    });
  } catch (err) {
    console.error(`[login:${userId}] error:`, err);
    res.status(500).json({ error: err.message });
  }
});

// Poll account — called during login polling with the pending token
app.get('/codex/account', async (req, res) => {
  const userId = getUserId(req);
  const session = getOrCreateSession(userId);
  const token = req.headers['x-codex-session'];

  console.log(`[codex/account:${userId}] token=${token ? token.substring(0, 8) + '...' : 'none'} pendingToken=${session.pendingSessionToken ? session.pendingSessionToken.substring(0, 8) + '...' : 'none'} activeToken=${session.activeSessionToken ? session.activeSessionToken.substring(0, 8) + '...' : 'none'}`);

  try {
    const account = await session.codex.getAccount(true);

    console.log(`[codex/account:${userId}] getAccount result: ${JSON.stringify(account)}`);

    if (account) {
      // If there's a pending token from login, activate it now
      if (session.pendingSessionToken && (!token || token === session.pendingSessionToken)) {
        console.log(`[codex/account:${userId}] activating session token`);
        session.activeSessionToken = session.pendingSessionToken;
        saveSessionToken(userId, session.activeSessionToken);
        session.pendingSessionToken = null;
      }

      // If sidecar is authenticated but no active token yet, generate one
      if (!session.activeSessionToken) {
        const newToken = crypto.randomBytes(32).toString('hex');
        session.activeSessionToken = newToken;
        saveSessionToken(userId, newToken);
        console.log(`[codex/account:${userId}] generated token from authenticated sidecar`);
      }

      // Sidecar is authenticated — return account info regardless of token matching
      // Trigger a background refresh to extend token lifetime (non-blocking)
      session.codex.getAccount(true).catch((err) => {
        console.warn(`[codex/account:${userId}] Background token refresh failed: ${err.message}`);
      });

      return res.json({ account, authenticated: true, sessionToken: session.activeSessionToken });
    }

    console.log(`[codex/account:${userId}] no account returned from getAccount`);
    res.json({ account: null, authenticated: false });
  } catch (err) {
    console.error(`[codex/account:${userId}] error: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

// OAuth callback proxy — receives the callback from Auth0 and forwards
// it to the Codex sidecar's internal HTTP server (port 1455).
app.get('/auth/callback', async (req, res) => {
  const queryString = new URLSearchParams(req.query).toString();
  const internalUrl = `http://127.0.0.1:1455/auth/callback?${queryString}`;

  console.log(`[codex-proxy] Proxying OAuth callback to: ${internalUrl}`);

  try {
    const response = await fetch(internalUrl, { redirect: 'manual' });

    console.log(`[codex-proxy] Sidecar at 1455 responded with status: ${response.status}`);

    // The codex sidecar usually responds with a redirect after processing the OAuth code
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      console.log(`[codex-proxy] Sidecar redirect location: ${location}`);

      if (location) {
        const isSidecarSuccess =
          location.includes('localhost:1455/success') ||
          location.includes('127.0.0.1:1455/success');

        if (isSidecarSuccess) {
          const successUrl = location
            .replace('http://localhost:1455', 'http://127.0.0.1:1455')
            .replace('https://localhost:1455', 'http://127.0.0.1:1455');

          console.log(`[codex-proxy] Following sidecar success redirect: ${successUrl.substring(0, 100)}...`);

          try {
            const successResp = await fetch(successUrl, {
              redirect: 'follow',
              signal: AbortSignal.timeout(10000),
            });
            console.log(`[codex-proxy] Sidecar /success responded: ${successResp.status}`);
          } catch (err) {
            console.warn(`[codex-proxy] Sidecar /success call failed (non-fatal): ${err.message}`);
          }

          res.set('Content-Type', 'text/html');
          return res.send(`
            <!DOCTYPE html>
            <html>
              <head><title>Authentication Complete</title></head>
              <body style="display:flex;align-items:center;justify-content:center;height:100vh;font-family:system-ui;background:#1a1a2e;color:#fff;">
                <div style="text-align:center">
                  <h2 style="color:#22c55e">Authentication Successful</h2>
                  <p>You can close this tab and return to Bolt.</p>
                  <script>setTimeout(()=>window.close(),2000)</script>
                </div>
              </body>
            </html>
          `);
        }

        return res.redirect(location);
      }
    }

    const body = await response.text();

    if (!response.ok) {
      console.error(`[codex-proxy] Sidecar returned ${response.status}: ${body.substring(0, 200)}`);
      return res.status(response.status).json({ error: `Sidecar error ${response.status}: ${body.substring(0, 200)}` });
    }

    res.set('Content-Type', 'text/html');
    res.send(`
      <!DOCTYPE html>
      <html>
        <head><title>Authentication Complete</title></head>
        <body style="display:flex;align-items:center;justify-content:center;height:100vh;font-family:system-ui;background:#1a1a2e;color:#fff;">
          <div style="text-align:center">
            <h2 style="color:#22c55e">Authentication Successful</h2>
            <p>You can close this tab and return to Bolt.</p>
            <script>setTimeout(()=>window.close(),2000)</script>
          </div>
        </body>
      </html>
    `);
  } catch (err) {
    console.error('[codex-proxy] OAuth callback proxy error:', err);
    res.status(502).json({ error: `Codex sidecar unreachable: ${err.message}` });
  }
});

// ─── Protected endpoints (session required) ─────────────────────────

// Logout — only affects the requesting user's session
app.post('/codex/logout', requireSession, async (req, res) => {
  const userId = req._userId;
  const session = req._userSession;

  try {
    session.activeSessionToken = null;
    saveSessionToken(userId, null);
    session.pendingSessionToken = null;
    await session.codex.logout();
    // Remove from map so it can be garbage collected
    userSessions.delete(userId);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// List available models
app.get('/codex/models', requireSession, async (req, res) => {
  try {
    const models = await req._userSession.codex.listModels();
    res.json({ models });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Chat completion — supports both streaming (SSE) and non-streaming modes
app.post('/codex/chat/completions', requireSession, async (req, res) => {
  const session = req._userSession;
  const codex = session.codex;

  try {
    const { model, messages, reasoningEffort, stream } = req.body;

    if (!model || !messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'model and messages[] are required' });
    }

    const sessionToken = req.headers['x-codex-session'] || null;
    console.log(`[chat/completions:${req._userId}] model=${model} stream=${!!stream}`);

    if (stream) {
      const id = `codex-${Date.now()}`;
      const created = Math.floor(Date.now() / 1000);
      let firstDelta = true;

      res.set({
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
      });

      // Send a real SSE data chunk (empty content delta) every 20s so that
      // client-side stream monitors (StreamRecoveryManager) see activity and
      // don't time out while Codex is thinking but hasn't produced output yet.
      // A plain SSE comment (': heartbeat') is ignored by the AI SDK parser.
      const heartbeatInterval = setInterval(() => {
        try {
          if (firstDelta) {
            // Before first real content: send an empty delta that resets client timer
            res.write(`data: ${JSON.stringify({
              id, object: 'chat.completion.chunk', created, model,
              choices: [{ index: 0, delta: { content: '' }, finish_reason: null }],
            })}\n\n`);
          }
          // After first content, heartbeat is no longer needed (cleared in sendChunk)
        } catch (_) {
          // Connection already closed
        }
      }, 20_000);

      const sendChunk = (content) => {
        if (firstDelta) {
          clearInterval(heartbeatInterval);
          res.write(`data: ${JSON.stringify({
            id, object: 'chat.completion.chunk', created, model,
            choices: [{ index: 0, delta: { role: 'assistant', content: '' }, finish_reason: null }],
          })}\n\n`);
          firstDelta = false;
        }
        res.write(`data: ${JSON.stringify({
          id, object: 'chat.completion.chunk', created, model,
          choices: [{ index: 0, delta: { content }, finish_reason: null }],
        })}\n\n`);
      };

      try {
        const text = await codex.chatCompletion(model, messages, reasoningEffort, (delta) => {
          sendChunk(delta);
        }, sessionToken);

        if (firstDelta && text) {
          sendChunk(text);
        }

        console.log(`[chat/completions:${req._userId}] streaming done, firstDelta=${firstDelta}`);
      } catch (err) {
        console.error(`[chat/completions:${req._userId}] streaming error:`, err.message);
        if (firstDelta) {
          const isModelNotSupported = err.message.includes('not supported');
          res.write(`data: ${JSON.stringify({
            error: {
              message: err.message,
              type: isModelNotSupported ? 'invalid_request_error' : 'server_error',
              code: isModelNotSupported ? 'model_not_supported' : 'internal_server_error',
              param: null,
            }
          })}\n\n`);
        }
      } finally {
        clearInterval(heartbeatInterval);
      }

      if (!firstDelta) {
        res.write(`data: ${JSON.stringify({
          id, object: 'chat.completion.chunk', created, model,
          choices: [{ index: 0, delta: {}, finish_reason: 'stop' }],
        })}\n\n`);
      }
      res.write('data: [DONE]\n\n');
      res.end();
    } else {
      const text = await codex.chatCompletion(model, messages, reasoningEffort, null, sessionToken);

      res.json({
        id: `codex-${Date.now()}`,
        object: 'chat.completion',
        created: Math.floor(Date.now() / 1000),
        model,
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: text,
            },
            finish_reason: 'stop',
          },
        ],
        usage: {
          prompt_tokens: 0,
          completion_tokens: 0,
          total_tokens: 0,
        },
      });
    }
  } catch (err) {
    console.error('Chat completion error:', err);
    if (!res.headersSent) {
      const isModelNotSupported = err.message && err.message.includes('not supported');
      res.status(isModelNotSupported ? 400 : 500).json({
        error: {
          message: err.message,
          type: isModelNotSupported ? 'invalid_request_error' : 'server_error',
          code: isModelNotSupported ? 'model_not_supported' : 'internal_server_error',
          param: null,
        }
      });
    }
  }
});

// ─── Session restore + token refresh (per-user) ─────────────────────

async function restoreSession(userId) {
  const saved = loadSessionToken(userId);
  if (!saved) return;

  console.log(`[session:${userId}] Found saved session token, verifying with sidecar...`);
  const session = getOrCreateSession(userId);

  try {
    await session.codex.ensureRunning();

    let account = null;
    try {
      account = await session.codex.getAccount(true);
    } catch (refreshErr) {
      console.warn(`[session:${userId}] Refresh failed, trying cached read: ${refreshErr.message}`);
    }

    if (!account) {
      try {
        account = await session.codex.getAccount(false);
      } catch (cachedErr) {
        console.warn(`[session:${userId}] Cached read also failed: ${cachedErr.message}`);
      }
    }

    if (account) {
      session.activeSessionToken = saved;
      console.log(`[session:${userId}] Session restored for ${account.email || 'unknown'}`);
    } else {
      // Sidecar not authenticated yet — this can happen right after a container
      // restart if the sidecar takes time to initialize, or if XDG_CONFIG_HOME
      // wasn't persisted across restarts. Keep the token so the user's next
      // request can still try — if it fails there, they'll be prompted to re-login
      // rather than being silently logged out at startup.
      console.warn(`[session:${userId}] Saved token found but sidecar not authenticated at startup — keeping token, will re-verify on next request`);
    }
  } catch (err) {
    console.warn(`[session:${userId}] Could not restore session: ${err.message}`);
  }
}

// Periodically refresh tokens for all active sessions
let tokenRefreshInterval = null;

function startTokenRefreshInterval() {
  if (tokenRefreshInterval) {
    clearInterval(tokenRefreshInterval);
  }

  const REFRESH_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes

  tokenRefreshInterval = setInterval(async () => {
    for (const [userId, session] of userSessions) {
      if (!session.activeSessionToken) continue;

      try {
        const account = await session.codex.getAccount(true);
        if (account) {
          session.lastTokenRefresh = new Date().toISOString();
          console.log(`[session:${userId}] Token refreshed for ${account.email || 'unknown'}`);
        } else {
          console.warn(`[session:${userId}] Periodic refresh returned no account`);
        }
      } catch (err) {
        console.warn(`[session:${userId}] Periodic token refresh failed: ${err.message}`);
      }
    }
  }, REFRESH_INTERVAL_MS);

  console.log(`[session] Token refresh interval started (every ${REFRESH_INTERVAL_MS / 60000} minutes)`);
}

// ─── Graceful shutdown ──────────────────────────────────────────────

async function shutdownAll() {
  console.log('Shutting down codex-proxy...');
  if (tokenRefreshInterval) clearInterval(tokenRefreshInterval);
  const kills = [...userSessions.values()].map(s => s.codex.kill().catch(() => {}));
  await Promise.all(kills);
  process.exit(0);
}

process.on('SIGINT', shutdownAll);
process.on('SIGTERM', shutdownAll);

app.listen(PORT, '0.0.0.0', async () => {
  console.log(`Codex proxy server running on port ${PORT}`);

  // Restore ALL persisted sessions at startup (not just 'default').
  // This ensures users don't have to re-login after a container restart
  // as long as the Codex sidecar config dir is on a persistent volume.
  const sessionsToRestore = new Set(['default']);

  // Scan .sessions/ dir for additional user session files
  try {
    ensureSessionDir();
    const files = fs.readdirSync(SESSION_DIR);
    for (const f of files) {
      const m = f.match(/^\.session_(.+)$/);
      if (m) sessionsToRestore.add(m[1]);
    }
  } catch {
    // Non-fatal — will fall back to 'default' only
  }

  // Also check for per-user thread caches (even if session token file is missing)
  try {
    const files = fs.readdirSync(SESSION_DIR);
    for (const f of files) {
      const m = f.match(/^\.threads_(.+)\.json$/);
      if (m) sessionsToRestore.add(m[1]);
    }
  } catch {}

  console.log(`[startup] Restoring sessions for: ${[...sessionsToRestore].join(', ')}`);
  for (const userId of sessionsToRestore) {
    try {
      await restoreSession(userId);
    } catch (err) {
      console.warn(`[startup] Failed to restore session for ${userId}: ${err.message}`);
    }
  }

  // Start periodic token refresh to keep sessions alive
  startTokenRefreshInterval();
});
