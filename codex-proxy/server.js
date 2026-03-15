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

const codex = new CodexManager();

/**
 * Session-based access control.
 *
 * When a user logs in via OAuth, the codex-proxy generates a random
 * session token and returns it. The frontend stores it in a cookie
 * scoped to that browser. All subsequent requests must include the
 * token in the `x-codex-session` header. This ensures:
 *
 * - Only the browser that initiated the login can use the Codex session
 * - Other users on the same bolt instance cannot piggyback on someone
 *   else's ChatGPT subscription
 * - A new login invalidates the previous session token
 *
 * The token is persisted to disk so container restarts don't force re-login.
 */
const SESSION_FILE = path.join('/app', '.session_token');

function saveSessionToken(token) {
  try {
    if (token) {
      fs.writeFileSync(SESSION_FILE, token, 'utf8');
    } else {
      fs.rmSync(SESSION_FILE, { force: true });
    }
  } catch (err) {
    console.warn(`[session] Failed to persist session token: ${err.message}`);
  }
}

function loadSessionToken() {
  try {
    if (fs.existsSync(SESSION_FILE)) {
      return fs.readFileSync(SESSION_FILE, 'utf8').trim();
    }
  } catch (err) {
    console.warn(`[session] Failed to load session token: ${err.message}`);
  }
  return null;
}

let activeSessionToken = null;

// Restore session on startup
async function restoreSession() {
  const saved = loadSessionToken();
  if (!saved) return;

  console.log('[session] Found saved session token, verifying with sidecar...');
  try {
    await codex.ensureRunning();
    const account = await codex.getAccount(false);
    if (account) {
      activeSessionToken = saved;
      console.log(`[session] Session restored for ${account.email || 'unknown'}`);
    } else {
      console.log('[session] Saved token found but sidecar not authenticated — clearing');
      saveSessionToken(null);
    }
  } catch (err) {
    console.warn(`[session] Could not restore session: ${err.message}`);
  }
}

function requireSession(req, res, next) {
  const token = req.headers['x-codex-session'];

  if (!activeSessionToken || token !== activeSessionToken) {
    console.log(`[requireSession] REJECTED ${req.method} ${req.path} token=${token ? token.substring(0, 8) + '...' : 'none'} active=${activeSessionToken ? activeSessionToken.substring(0, 8) + '...' : 'none'}`);
    return res.status(401).json({
      error: 'No active Codex session. Login with ChatGPT first.',
      authenticated: false,
    });
  }

  next();
}

// ─── Public endpoints (no session required) ─────────────────────────

// Health check
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    codexRunning: codex.initialized,
    hasActiveSession: !!activeSessionToken,
  });
});

// Check status (public — frontend uses this to decide whether to show login UI)
app.get('/codex/status', (_req, res) => {
  try {
    res.json({
      running: codex.initialized,
      hasActiveSession: !!activeSessionToken,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Diagnostic: check if sidecar HTTP server at 1455 is reachable
app.get('/codex/diag', async (_req, res) => {
  const result = {
    codexInitialized: codex.initialized,
    hasPendingToken: !!codex._pendingSessionToken,
    hasActiveSession: !!activeSessionToken,
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

// Start OAuth login flow (public — anyone can initiate login)
// If someone else was logged in, their session is invalidated.
app.post('/codex/login', async (_req, res) => {
  try {
    // Invalidate previous session
    activeSessionToken = null;
    saveSessionToken(null);

    const result = await codex.startLogin();

    // Generate a new session token for this login attempt
    const pendingToken = crypto.randomBytes(32).toString('hex');

    // The token becomes active only after successful auth polling
    // Store it temporarily on the codex manager
    codex._pendingSessionToken = pendingToken;

    res.json({
      ...result,
      sessionToken: pendingToken,
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Poll account — called during login polling with the pending token
app.get('/codex/account', async (req, res) => {
  const token = req.headers['x-codex-session'];

  console.log(`[codex/account] token=${token ? token.substring(0, 8) + '...' : 'none'} pendingToken=${codex._pendingSessionToken ? codex._pendingSessionToken.substring(0, 8) + '...' : 'none'} activeToken=${activeSessionToken ? activeSessionToken.substring(0, 8) + '...' : 'none'}`);

  try {
    const account = await codex.getAccount(true);

    console.log(`[codex/account] getAccount result: ${JSON.stringify(account)}`);

    if (account) {
      // If there's a pending token from login, activate it now
      if (codex._pendingSessionToken && token === codex._pendingSessionToken) {
        console.log(`[codex/account] activating session token`);
        activeSessionToken = codex._pendingSessionToken;
        saveSessionToken(activeSessionToken);
        codex._pendingSessionToken = null;
      }

      // Only return account details if this is the session owner
      if (token === activeSessionToken) {
        return res.json({ account, authenticated: true });
      }

      // Someone else is logged in
      console.log(`[codex/account] token mismatch — activeToken=${activeSessionToken ? activeSessionToken.substring(0, 8) + '...' : 'none'}`);
      return res.json({
        account: null,
        authenticated: false,
        message: 'Another user is currently logged in via Codex.',
      });
    }

    console.log(`[codex/account] no account returned from getAccount`);
    res.json({ account: null, authenticated: false });
  } catch (err) {
    console.error(`[codex/account] error: ${err.message}`);
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
        // If the sidecar redirects to its own /success endpoint (localhost:1455/success?...),
        // we MUST follow that redirect internally. The /success handler is where the sidecar
        // finalizes token storage. Without calling it, account/read returns requiresOpenaiAuth:true
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

          // Return success page — auth is now finalized in the sidecar
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

    // Propagate non-success responses from the sidecar
    if (!response.ok) {
      console.error(`[codex-proxy] Sidecar returned ${response.status}: ${body.substring(0, 200)}`);
      return res.status(response.status).json({ error: `Sidecar error ${response.status}: ${body.substring(0, 200)}` });
    }

    // Return a success page
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

// Logout
app.post('/codex/logout', requireSession, async (_req, res) => {
  try {
    activeSessionToken = null;
    saveSessionToken(null);
    codex._pendingSessionToken = null;
    await codex.logout();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// List available models
app.get('/codex/models', requireSession, async (_req, res) => {
  try {
    const models = await codex.listModels();
    res.json({ models });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Chat completion — supports both streaming (SSE) and non-streaming modes
app.post('/codex/chat/completions', requireSession, async (req, res) => {
  try {
    const { model, messages, reasoningEffort, stream } = req.body;

    if (!model || !messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'model and messages[] are required' });
    }

    console.log(`[chat/completions] model=${model} stream=${!!stream}`);

    if (stream) {
      // SSE streaming mode — required by AI SDK's streamText
      const id = `codex-${Date.now()}`;
      const created = Math.floor(Date.now() / 1000);
      let firstDelta = true;

      res.set({
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
      });

      const sendChunk = (content) => {
        if (firstDelta) {
          // Send role chunk first
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
        });

        // If no deltas were streamed (e.g. sidecar returned full text at end), send now
        if (firstDelta && text) {
          sendChunk(text);
        }

        console.log(`[chat/completions] streaming done, firstDelta=${firstDelta}`);
      } catch (err) {
        console.error('[chat/completions] streaming error:', err.message);
        if (firstDelta) {
          // Send error in OpenAI-compatible format so AI SDK can parse it (not a plain string)
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
      }

      // Final chunk + DONE
      if (!firstDelta) {
        res.write(`data: ${JSON.stringify({
          id, object: 'chat.completion.chunk', created, model,
          choices: [{ index: 0, delta: {}, finish_reason: 'stop' }],
        })}\n\n`);
      }
      res.write('data: [DONE]\n\n');
      res.end();
    } else {
      // Non-streaming mode (used by /api/llmcall template selector)
      const text = await codex.chatCompletion(model, messages, reasoningEffort);

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

// ─── Graceful shutdown ──────────────────────────────────────────────

process.on('SIGINT', async () => {
  console.log('Shutting down codex-proxy...');
  await codex.kill();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('Shutting down codex-proxy...');
  await codex.kill();
  process.exit(0);
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Codex proxy server running on port ${PORT}`);
  // Attempt to restore session from previous run (survives container restarts)
  restoreSession();
});
