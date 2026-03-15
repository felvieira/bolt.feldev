import { spawn } from 'child_process';
import { createInterface } from 'readline';
import { EventEmitter } from 'events';

/**
 * Manages the Codex app-server sidecar process.
 * Communicates via JSON-RPC 2.0 over stdin/stdout (JSONL).
 */
export class CodexManager extends EventEmitter {
  constructor() {
    super();
    this.process = null;
    this.initialized = false;
    this.requestId = 0;
    this.pending = new Map(); // id -> { resolve, reject, timer }
    this.account = null;
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
      const result = await this.rpcRequest('account/read', { refreshToken }, 30_000);
      this.account = this._parseAccount(result);
      return this.account;
    } catch (err) {
      if (refreshToken) {
        // Fallback to cached read
        console.warn(`account/read with refreshToken=true failed, falling back: ${err.message}`);
        try {
          const result = await this.rpcRequest('account/read', { refreshToken: false }, 10_000);
          this.account = this._parseAccount(result);
          return this.account;
        } catch (err2) {
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

  /** Chat completion via Codex threads */
  async chatCompletion(model, messages, reasoningEffort) {
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

    // Extract system prompt and last user message
    const systemPrompt = messages
      .filter((m) => m.role === 'system')
      .map((m) => m.content)
      .join('\n');
    const lastUserMsg = [...messages].reverse().find((m) => m.role === 'user')?.content || '';

    // Start thread
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

    const threadId = threadResult?.thread?.id || '';
    if (!threadId) {
      throw new Error('Failed to get thread ID from Codex');
    }

    // Start turn
    const turnParams = {
      threadId,
      input: [{ type: 'text', text: lastUserMsg }],
      model,
    };
    if (reasoningEffort) {
      turnParams.effort = reasoningEffort;
    }

    let turnResult;
    try {
      turnResult = await this.rpcRequest('turn/start', turnParams);
    } catch (err) {
      if (err.message.toLowerCase().includes('missing field model')) {
        turnParams.model = 'o3';
        turnResult = await this.rpcRequest('turn/start', turnParams);
      } else {
        throw err;
      }
    }

    const turnId = turnResult?.turn?.id || '';

    // Wait for turn completion
    return this._awaitTurnCompletion(threadId, turnId);
  }

  /** Wait for a turn to complete, collecting streamed text */
  async _awaitTurnCompletion(threadId, turnId) {
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
          }
        }
      };

      const onComplete = (params) => {
        const turnObj = params.turn || params;
        const evtTurnId = turnObj.id || turnObj.turn_id || params.id || '';

        if (turnId && evtTurnId && evtTurnId !== turnId) return;

        const status = turnObj.status || '';
        if (status === 'failed') {
          cleanup();
          const errorMsg = turnObj.error?.message || 'Unknown error';
          reject(new Error(`Codex turn failed: ${errorMsg}`));
          return;
        }
        if (status === 'interrupted') {
          cleanup();
          reject(new Error('Codex turn interrupted'));
          return;
        }

        const text = this._extractTextFromTurn(turnObj);
        cleanup();
        if (text) {
          resolve(text);
        } else if (streamedText) {
          resolve(streamedText);
        } else if (status === 'completed') {
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
              const text = this._extractTextFromTurn(turn);
              cleanup();
              if (text) {
                resolve(text);
              } else if (streamedText) {
                resolve(streamedText);
              } else if (status === 'failed') {
                reject(new Error(`Codex turn failed: ${turn.error?.message || 'Unknown'}`));
              } else {
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
    if (!result || typeof result !== 'object') return null;

    // Could be nested: { account: { type, email, plan } } or direct
    const acc = result.account || result;
    const type = (acc.type || acc.account_type || 'chatgpt').toLowerCase();
    const email = acc.email || '';
    const plan = (acc.plan || '').toLowerCase();

    if (!email && !plan && type === 'chatgpt') {
      return null; // Not authenticated
    }

    return {
      type: type === 'apikey' ? 'apiKey' : 'chatgpt',
      ...(email ? { email } : {}),
      ...(plan ? { plan } : {}),
    };
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
