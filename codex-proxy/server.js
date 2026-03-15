import express from 'express';
import cors from 'cors';
import crypto from 'crypto';
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
 */
let activeSessionToken = null;

function requireSession(req, res, next) {
  const token = req.headers['x-codex-session'];

  if (!activeSessionToken || token !== activeSessionToken) {
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

// Start OAuth login flow (public — anyone can initiate login)
// If someone else was logged in, their session is invalidated.
app.post('/codex/login', async (_req, res) => {
  try {
    // Invalidate previous session
    activeSessionToken = null;

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

  try {
    const account = await codex.getAccount(true);

    if (account) {
      // If there's a pending token from login, activate it now
      if (codex._pendingSessionToken && token === codex._pendingSessionToken) {
        activeSessionToken = codex._pendingSessionToken;
        codex._pendingSessionToken = null;
      }

      // Only return account details if this is the session owner
      if (token === activeSessionToken) {
        return res.json({ account, authenticated: true });
      }

      // Someone else is logged in
      return res.json({
        account: null,
        authenticated: false,
        message: 'Another user is currently logged in via Codex.',
      });
    }

    res.json({ account: null, authenticated: false });
  } catch (err) {
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

    // The codex sidecar usually responds with HTML or a redirect
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');

      if (location) {
        return res.redirect(location);
      }
    }

    const body = await response.text();

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
    res.set('Content-Type', 'text/html');
    res.send(`
      <!DOCTYPE html>
      <html>
        <head><title>Authentication Error</title></head>
        <body style="display:flex;align-items:center;justify-content:center;height:100vh;font-family:system-ui;background:#1a1a2e;color:#fff;">
          <div style="text-align:center">
            <h2 style="color:#ef4444">Authentication Error</h2>
            <p>${err.message}</p>
            <p>The Codex sidecar may not be ready. Please try logging in again.</p>
          </div>
        </body>
      </html>
    `);
  }
});

// ─── Protected endpoints (session required) ─────────────────────────

// Logout
app.post('/codex/logout', requireSession, async (_req, res) => {
  try {
    activeSessionToken = null;
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

// Chat completion (non-streaming, returns full text)
app.post('/codex/chat/completions', requireSession, async (req, res) => {
  try {
    const { model, messages, reasoningEffort } = req.body;

    if (!model || !messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'model and messages[] are required' });
    }

    const text = await codex.chatCompletion(model, messages, reasoningEffort);

    // Return in OpenAI-compatible format
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
  } catch (err) {
    console.error('Chat completion error:', err);
    res.status(500).json({ error: err.message });
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
});
