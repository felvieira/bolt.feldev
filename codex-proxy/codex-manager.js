import { spawn } from 'child_process';
import { createInterface } from 'readline';
import { createHash } from 'crypto';
import { EventEmitter } from 'events';
import fs from 'fs';
import path from 'path';

const THREADS_DIR = path.join('/app', '.sessions');

function ensureThreadsDir() {
  try {
    if (!fs.existsSync(THREADS_DIR)) fs.mkdirSync(THREADS_DIR, { recursive: true });
  } catch {}
}

function threadsCachePath(userId) {
  if (!userId || userId === 'default') return path.join('/app', '.threads_cache.json');
  ensureThreadsDir();
  return path.join(THREADS_DIR, `.threads_${userId}.json`);
}

/**
 * Manages the Codex app-server sidecar process.
 * Communicates via JSON-RPC 2.0 over stdin/stdout (JSONL).
 */
export class CodexManager extends EventEmitter {
  constructor(userId = 'default') {
    super();
    this.userId = userId;
    this.process = null;
    this.initialized = false;
    this.requestId = 0;
    this.pending = new Map(); // id -> { resolve, reject, timer }
    this.account = null;
    // Thread reuse: conversationKey -> { threadId, model, lastUsed }
    this.threads = this._loadThreadsFromDisk();
  }

  _loadThreadsFromDisk() {
    try {
      const file = threadsCachePath(this.userId);
      if (fs.existsSync(file)) {
        const obj = JSON.parse(fs.readFileSync(file, 'utf8'));
        const map = new Map(Object.entries(obj));
        console.log(`[threads:${this.userId}] Loaded ${map.size} cached threads from disk`);
        return map;
      }
    } catch (err) {
      console.warn(`[threads:${this.userId}] Failed to load threads cache: ${err.message}`);
    }
    return new Map();
  }

  _saveThreadsToDisk() {
    try {
      const obj = Object.fromEntries(this.threads);
      fs.writeFileSync(threadsCachePath(this.userId), JSON.stringify(obj), 'utf8');
    } catch (err) {
      console.warn(`[threads:${this.userId}] Failed to persist threads cache: ${err.message}`);
    }
  }

  /** Send a JSON-RPC request and wait for a response */
  async rpcRequest(method, params = {}, timeoutMs = 120_000) {
    if (!this.process) {
      throw new Error('Codex sidecar not running');
    }

    const id = ++this.requestId;
    const request = JSON.stringify({ method, id, params }) + '\n';

    console.log(`[codex rpc] -> ${request.trim()}`);

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`Codex RPC timeout (${timeoutMs}ms) for method: ${method}`));
      }, timeoutMs);

      this.pending.set(id, { resolve, reject, timer });

      try {
        this.process.stdin.write(request);
      } catch (err) {
        this.pending.delete(id);
        clearTimeout(timer);
        reject(new Error(`Failed to write to codex stdin: ${err.message}`));
      }
    });
  }

  /** Send a JSON-RPC notification (no response expected) */
  rpcNotify(method, params = {}) {
    if (!this.process) return;
    const notification = JSON.stringify({ method, params }) + '\n';
    try {
      this.process.stdin.write(notification);
    } catch (err) {
      console.error(`Failed to send notification: ${err.message}`);
    }
  }

  /** Spawn and initialize the codex app-server process */
  async start() {
    if (this.initialized) return;

    await this.kill();

    const codexCmd = process.platform === 'win32' ? 'codex.cmd' : 'codex';
    console.log(`Spawning codex app-server from: ${codexCmd}`);

    this.process = spawn(codexCmd, ['app-server'], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env },
    });

    this.process.on('error', (err) => {
      console.error(`Codex process error: ${err.message}`);
      this.initialized = false;
      this.process = null;
    });

    this.process.on('exit', (code) => {
      console.log(`Codex process exited with code: ${code}`);
      this.initialized = false;
      this.process = null;
      // Reject all pending requests
      for (const [id, { reject, timer }] of this.pending) {
        clearTimeout(timer);
        reject(new Error('Codex process exited'));
      }
      this.pending.clear();
    });

    // Read stdout line by line for JSON-RPC responses and events
    const rl = createInterface({ input: this.process.stdout });
    rl.on('line', (line) => {
      const trimmed = line.trim();
      if (!trimmed) return;

      try {
        const msg = JSON.parse(trimmed);

        // Response to a pending request
        if (msg.id !== undefined && this.pending.has(msg.id)) {
          const { resolve, reject, timer } = this.pending.get(msg.id);
          this.pending.delete(msg.id);
          clearTimeout(timer);

          if (msg.error) {
            reject(new Error(`Codex RPC error: ${msg.error.message || 'Unknown error'}`));
          } else {
            resolve(msg.result !== undefined ? msg.result : null);
          }
        }
        // Event/notification from Codex
        else if (msg.method) {
          const params = msg.params || {};
          this.emit(`codex:${msg.method}`, params);
          this.emit('codex:event', { method: msg.method, params });
        }
      } catch (err) {
        console.warn(`Failed to parse codex JSONL: ${err.message} - line: ${trimmed}`);
      }
    });

    // Log stderr
    if (this.process.stderr) {
      const stderrRl = createInterface({ input: this.process.stderr });
      stderrRl.on('line', (line) => {
        const trimmed = line.trim();
        if (trimmed) console.warn(`[codex stderr] ${trimmed}`);
      });
    }

    // Initialize the sidecar
    const result = await this.rpcRequest('initialize', {
      clientInfo: {
        name: 'bolt_ai',
        title: 'Bolt AI',
        version: '1.0.0',
      },
    });

    console.log('Codex app-server initialized:', result);
    this.rpcNotify('initialized', {});
    this.initialized = true;
  }

  /** Ensure sidecar is running */
  async ensureRunning() {
    if (!this.initialized || !this.process) {
      await this.start();
    }
  }

  /** Kill the sidecar process */
  async kill() {
    if (this.process) {
      try {
        this.process.kill();
      } catch (err) {
        console.error(`Failed to kill codex process: ${err.message}`);
      }
      this.process = null;
    }
    this.initialized = false;
    this.account = null;
    this.threads.clear();
    for (const [id, { reject, timer }] of this.pending) {
      clearTimeout(timer);
      reject(new Error('Codex process killed'));
    }
    this.pending.clear();
  }

  /** Start OAuth login flow - returns { loginId, authUrl } */
  async startLogin() {
    await this.ensureRunning();

    const result = await this.rpcRequest('account/login/start', { type: 'chatgpt' });

    const loginId = result?.loginId || '';
    const authUrl = result?.authUrl || '';

    if (!authUrl) {
      throw new Error(`Codex did not return an auth URL. Response: ${JSON.stringify(result)}`);
    }

    console.log(`Codex login started. Auth URL: ${authUrl}`);
    return { loginId, authUrl };
  }

  /** Get the authenticated account */
  async getAccount(refreshToken = true) {
    await this.ensureRunning();

    try {
      console.log(`[getAccount] calling account/read refreshToken=${refreshToken}`);
      const result = await this.rpcRequest('account/read', { refreshToken }, 30_000);
      console.log(`[getAccount] account/read response: ${JSON.stringify(result)}`);
      this.account = this._parseAccount(result);
      return this.account;
    } catch (err) {
      if (refreshToken) {
        // Fallback to cached read
        console.warn(`account/read with refreshToken=true failed, falling back: ${err.message}`);
        try {
          const result = await this.rpcRequest('account/read', { refreshToken: false }, 10_000);
          console.log(`[getAccount] account/read fallback response: ${JSON.stringify(result)}`);
          this.account = this._parseAccount(result);
          return this.account;
        } catch (err2) {
          console.error(`[getAccount] fallback also failed: ${err2.message}`);
          return null;
        }
      }
      return null;
    }
  }

  /** Logout and kill sidecar */
  async logout() {
    if (this.initialized) {
      try {
        await this.rpcRequest('account/logout', {}, 10_000);
      } catch (err) {
        console.warn(`Logout RPC failed: ${err.message}`);
      }
    }
    await this.kill();
    return true;
  }

  /** List available models */
  async listModels() {
    await this.ensureRunning();

    const accountResult = await this.rpcRequest('account/read', { refreshToken: true }, 30_000);
    const account = this._parseAccount(accountResult);

    if (!account) {
      throw new Error('Codex not authenticated. Login first.');
    }

    if (account.plan === 'free') {
      throw new Error('ChatGPT Free does not support Codex. Use Plus/Pro/Team.');
    }

    const result = await this.rpcRequest('model/list', { limit: 50, includeHidden: false });
    return this._parseModels(result);
  }

  /**
   * Derive a stable conversation key from the messages.
   * Uses a hash of ALL user message contents + session context so that
   * the same bolt conversation always maps to the same Codex thread,
   * even when message arrays differ (e.g., llmcall vs main chat).
   */
  _conversationKey(messages) {
    const userMessages = messages.filter((m) => m.role === 'user');
    if (!userMessages.length) return null;

    // Normalize each user message: strip [Model: ...], [Provider: ...] prefixes
    // and template boilerplate to find the actual user intent
    const normalized = userMessages.map((m) => {
      let content = typeof m.content === 'string' ? m.content : JSON.stringify(m.content);
      // Strip common prefixes injected by bolt
      content = content.replace(/^\[Model:\s*[^\]]*\]\s*/i, '');
      content = content.replace(/^\[Provider:\s*[^\]]*\]\s*/i, '');
      return content.trim();
    });

    // Hash all user messages together for a stable key.
    // NOTE: sessionToken is intentionally excluded — userId already provides
    // user isolation, and including the token breaks thread reuse after
    // browser restarts (new token = different hash = new thread every time).
    const hash = createHash('sha256');
    for (const content of normalized) {
      hash.update(':' + content.substring(0, 500));
    }

    return hash.digest('hex').substring(0, 16);
  }

  /** Evict threads not used for over 30 minutes */
  _evictStaleThreads() {
    const maxAge = 30 * 60 * 1000;
    const now = Date.now();
    let evicted = 0;

    for (const [key, entry] of this.threads) {
      if (now - entry.lastUsed > maxAge) {
        console.log(`[threads:${this.userId}] evicting stale thread ${entry.threadId} (key=${key})`);
        this.threads.delete(key);
        evicted++;
      }
    }

    if (evicted > 0) this._saveThreadsToDisk();
  }

  /** Chat completion via Codex threads — reuses threads for the same conversation */
  async chatCompletion(model, messages, reasoningEffort, deltaCallback = null, sessionToken = null) {
    await this.ensureRunning();

    // Validate account
    const accountResult = await this.rpcRequest('account/read', { refreshToken: true }, 30_000);
    const account = this._parseAccount(accountResult);

    if (!account) {
      throw new Error('Codex not authenticated. Login first.');
    }
    if (account.plan === 'free') {
      throw new Error('ChatGPT Free does not support Codex. Use Plus/Pro/Team.');
    }

    // Extract system prompt and user messages
    const systemPrompt = messages
      .filter((m) => m.role === 'system')
      .map((m) => (typeof m.content === 'string' ? m.content : JSON.stringify(m.content)))
      .join('\n');

    const userMessages = messages
      .filter((m) => m.role === 'user')
      .map((m) => (typeof m.content === 'string' ? m.content : JSON.stringify(m.content)));
    const lastUserMsg = userMessages[userMessages.length - 1] || '';

    // --- Thread reuse logic ---
    this._evictStaleThreads();
    const convKey = this._conversationKey(messages);
    const cached = convKey ? this.threads.get(convKey) : null;
    const canReuse = cached && cached.model === model;

    let threadId;
    let isNewThread = false;

    if (canReuse) {
      // Reuse existing thread — just send a new turn
      threadId = cached.threadId;
      cached.lastUsed = Date.now();
      console.log(`[threads] reusing thread ${threadId} for key=${convKey}`);
    } else {
      // Create a new thread
      isNewThread = true;
      const threadParams = { model };
      if (systemPrompt) {
        threadParams.developerInstructions = systemPrompt;
      }

      let threadResult;
      try {
        threadResult = await this.rpcRequest('thread/start', threadParams);
      } catch (err) {
        if (err.message.toLowerCase().includes('missing field model')) {
          threadParams.model = 'o3';
          threadResult = await this.rpcRequest('thread/start', threadParams);
        } else {
          throw err;
        }
      }

      threadId = threadResult?.thread?.id || '';
      if (!threadId) {
        throw new Error('Failed to get thread ID from Codex');
      }

      // Store for reuse
      if (convKey) {
        this.threads.set(convKey, { threadId, model, lastUsed: Date.now() });
        this._saveThreadsToDisk();
        console.log(`[threads:${this.userId}] created thread ${threadId} for key=${convKey} model=${model}`);
      }
    }

    // Build the turn input.
    // For a NEW thread with multiple messages, include context from ALL messages
    // (user + assistant) but use smart truncation to stay within token limits.
    // This is critical because bolt sends the original user request via llmcall
    // (template selection) and then sends follow-up messages via the main chat.
    const MAX_CONTEXT_CHARS = 12000; // ~3000 tokens
    let turnInput;

    if (canReuse) {
      // Thread already has context from previous turns — just send latest message
      turnInput = lastUserMsg;
    } else if (isNewThread) {
      const nonSystemMsgs = messages.filter((m) => m.role !== 'system');

      if (nonSystemMsgs.length > 1) {
        // Smart compaction: keep first + last in full, truncate middle messages
        const first = nonSystemMsgs[0];
        const last = nonSystemMsgs[nonSystemMsgs.length - 1];
        const middle = nonSystemMsgs.slice(1, -1);

        const contextParts = [];

        // First message (original request) - always include in full
        const firstContent = typeof first.content === 'string' ? first.content : JSON.stringify(first.content);
        contextParts.push(`[Original request]\n${firstContent}`);

        // Middle messages - truncated, newest messages get priority
        let middleChars = 0;
        const middleParts = [];

        for (let i = middle.length - 1; i >= 0; i--) {
          const m = middle[i];
          const content = typeof m.content === 'string' ? m.content : JSON.stringify(m.content);
          const prefix = m.role === 'user' ? 'User' : 'Assistant';
          const truncated = content.length > 500 ? content.substring(0, 500) + '...[truncated]' : content;

          if (middleChars + truncated.length > MAX_CONTEXT_CHARS) break;
          middleParts.unshift(`${prefix}: ${truncated}`);
          middleChars += truncated.length;
        }

        if (middleParts.length > 0) {
          const skipped = middle.length - middleParts.length;

          if (skipped > 0) {
            contextParts.push(`[...${skipped} earlier messages omitted...]`);
          }

          contextParts.push('[Conversation history]');
          contextParts.push(middleParts.join('\n\n'));
        }

        // Last message (current request) - always include in full
        const lastContent = typeof last.content === 'string' ? last.content : JSON.stringify(last.content);
        contextParts.push(`[Current request]\n${lastContent}`);

        turnInput = contextParts.join('\n\n---\n\n');
        console.log(`[threads] new thread: compacted ${nonSystemMsgs.length} messages into ${turnInput.length} chars`);
      } else {
        turnInput = lastUserMsg;
      }
    } else {
      turnInput = lastUserMsg;
    }

    const turnParams = {
      threadId,
      input: [{ type: 'text', text: turnInput }],
      model,
    };
    if (reasoningEffort) {
      turnParams.effort = reasoningEffort;
    }

    let turnResult;
    try {
      turnResult = await this.rpcRequest('turn/start', turnParams);
    } catch (err) {
      // If the thread is stale or invalid, create a new one and retry
      if (canReuse && (err.message.includes('not found') || err.message.includes('invalid'))) {
        console.warn(`[threads:${this.userId}] cached thread ${threadId} is invalid, creating new one`);
        this.threads.delete(convKey);
        this._saveThreadsToDisk();
        return this.chatCompletion(model, messages, reasoningEffort, deltaCallback, sessionToken);
      }
      if (err.message.toLowerCase().includes('missing field model')) {
        turnParams.model = 'o3';
        turnResult = await this.rpcRequest('turn/start', turnParams);
      } else {
        throw err;
      }
    }

    const turnId = turnResult?.turn?.id || '';

    // Wait for turn completion
    return this._awaitTurnCompletion(threadId, turnId, deltaCallback);
  }

  /** Wait for a turn to complete, collecting streamed text */
  async _awaitTurnCompletion(threadId, turnId, deltaCallback = null) {
    let streamedText = '';
    const maxAttempts = 300;

    return new Promise((resolve, reject) => {
      let attempts = 0;
      let pollInterval;

      const onDelta = (params) => {
        const evtTurnId = params.turnId || params.turn_id || '';
        if (!turnId || !evtTurnId || evtTurnId === turnId) {
          if (params.delta) {
            streamedText += params.delta;
            if (deltaCallback) deltaCallback(params.delta);
          }
        }
      };

      const onComplete = (params) => {
        const turnObj = params.turn || params;
        const evtTurnId = turnObj.id || turnObj.turn_id || params.id || '';

        if (turnId && evtTurnId && evtTurnId !== turnId) return;

        const status = turnObj.status || '';
        console.log(`[_awaitTurnCompletion] turn/completed event: status=${status} turnId=${evtTurnId}`);

        if (status === 'failed') {
          cleanup();
          const errorMsg = turnObj.error?.message || 'Unknown error';
          console.error(`[_awaitTurnCompletion] turn FAILED: ${errorMsg}`);
          reject(new Error(`Codex turn failed: ${errorMsg}`));
          return;
        }
        if (status === 'interrupted') {
          cleanup();
          console.error(`[_awaitTurnCompletion] turn INTERRUPTED`);
          reject(new Error('Codex turn interrupted'));
          return;
        }

        const text = this._extractTextFromTurn(turnObj);
        cleanup();
        if (text) {
          console.log(`[_awaitTurnCompletion] turn completed via event, text length=${text.length}`);
          resolve(text);
        } else if (streamedText) {
          console.log(`[_awaitTurnCompletion] turn completed via stream, text length=${streamedText.length}`);
          resolve(streamedText);
        } else if (status === 'completed') {
          console.error(`[_awaitTurnCompletion] turn completed but no text found. turnObj keys: ${Object.keys(turnObj).join(',')}`);
          reject(new Error('Codex turn completed but no response text found'));
        }
      };

      const cleanup = () => {
        if (pollInterval) clearInterval(pollInterval);
        this.removeListener('codex:item/agentMessage/delta', onDelta);
        this.removeListener('codex:turn/completed', onComplete);
      };

      this.on('codex:item/agentMessage/delta', onDelta);
      this.on('codex:turn/completed', onComplete);

      // Poll thread/read as fallback
      pollInterval = setInterval(async () => {
        attempts++;
        if (attempts >= maxAttempts) {
          cleanup();
          console.error(`[_awaitTurnCompletion] TIMEOUT after ${maxAttempts} attempts (5 min)`);
          reject(new Error('Codex completion timed out (5 min)'));
          return;
        }

        try {
          const data = await this.rpcRequest(
            'thread/read',
            { threadId, includeTurns: true },
            10_000,
          );
          const turns = data?.turns || [];
          for (const turn of turns) {
            const status = turn.status || '';
            if (status === 'completed' || status === 'failed' || status === 'interrupted') {
              console.log(`[_awaitTurnCompletion] poll found turn status=${status} attempt=${attempts}`);
              const text = this._extractTextFromTurn(turn);
              cleanup();
              if (text) {
                console.log(`[_awaitTurnCompletion] resolved via poll, text length=${text.length}`);
                resolve(text);
              } else if (streamedText) {
                console.log(`[_awaitTurnCompletion] resolved via stream, text length=${streamedText.length}`);
                resolve(streamedText);
              } else if (status === 'failed') {
                const errMsg = turn.error?.message || 'Unknown';
                console.error(`[_awaitTurnCompletion] poll turn FAILED: ${errMsg}`);
                reject(new Error(`Codex turn failed: ${errMsg}`));
              } else {
                console.error(`[_awaitTurnCompletion] poll turn completed but no text. turn keys: ${Object.keys(turn).join(',')}`);
                reject(new Error('Codex turn completed but no response text found'));
              }
              return;
            }
          }
        } catch (err) {
          if (err.message?.toLowerCase().includes('not supported when using codex with a chatgpt account')) {
            cleanup();
            reject(new Error(err.message));
          }
          // Otherwise just keep polling
        }
      }, 1000);
    });
  }

  /** Extract text from a completed turn object */
  _extractTextFromTurn(turn) {
    // Try output array
    if (Array.isArray(turn.output)) {
      const texts = turn.output
        .filter((item) => item.type === 'text' || item.type === 'agentMessage')
        .map((item) => item.text || item.content || '')
        .filter(Boolean);
      if (texts.length) return texts.join('');
    }

    // Try content array
    if (Array.isArray(turn.content)) {
      const texts = turn.content
        .filter((item) => item.type === 'text' || typeof item === 'string')
        .map((item) => (typeof item === 'string' ? item : item.text || ''))
        .filter(Boolean);
      if (texts.length) return texts.join('');
    }

    // Try direct text/content
    if (turn.text) return turn.text;
    if (turn.content && typeof turn.content === 'string') return turn.content;

    return '';
  }

  /** Parse account info from Codex response */
  _parseAccount(result) {
    console.log(`[_parseAccount] raw result: ${JSON.stringify(result)}`);

    if (!result || typeof result !== 'object') return null;

    // Could be nested: { account: { type, email, plan } } or direct
    const acc = result.account || result;
    const type = (acc.type || acc.account_type || 'chatgpt').toLowerCase();
    const email = acc.email || '';
    const plan = (acc.plan || acc.planType || '').toLowerCase();

    // If explicitly marked as authenticated, trust it even without email/plan
    const isAuthenticated = acc.authenticated === true || result.authenticated === true;

    if (!email && !plan && type === 'chatgpt' && !isAuthenticated) {
      console.log(`[_parseAccount] returning null — no email, plan, or authenticated flag`);
      return null; // Not authenticated
    }

    const parsed = {
      type: type === 'apikey' ? 'apiKey' : 'chatgpt',
      ...(email ? { email } : {}),
      ...(plan ? { plan } : {}),
    };

    console.log(`[_parseAccount] parsed: ${JSON.stringify(parsed)}`);
    return parsed;
  }

  /** Parse model list from Codex response */
  _parseModels(result) {
    // Response could be { models: [...] } or { items: [...] } or direct array
    const items = result?.models || result?.items || (Array.isArray(result) ? result : []);

    return items
      .map((item) => {
        if (!item || !item.id) return null;
        return {
          id: item.id,
          name: item.name || item.id,
          supportedReasoningEfforts: item.supportedReasoningEfforts || [],
          defaultReasoningEffort: item.defaultReasoningEffort || null,
        };
      })
      .filter(Boolean);
  }
}
