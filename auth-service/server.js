import express from 'express';
import pg from 'pg';
import bcrypt from 'bcrypt';
import * as jose from 'jose';
import rateLimit from 'express-rate-limit';
import cors from 'cors';
import crypto from 'crypto';
import { readFileSync } from 'fs';

const app = express();
app.use(cors());
app.use(express.json());

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'change-me-in-production');
const JWT_ISSUER = 'bolt-auth';
const JWT_EXPIRY = '7d';

// Encryption helpers for secrets
const ENCRYPTION_KEY = process.env.SECRETS_ENCRYPTION_KEY || process.env.JWT_SECRET || 'change-me-in-production';

function encrypt(text) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', crypto.scryptSync(ENCRYPTION_KEY, 'salt', 32), iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

function decrypt(text) {
  const [ivHex, encrypted] = text.split(':');
  const decipher = crypto.createDecipheriv('aes-256-cbc', crypto.scryptSync(ENCRYPTION_KEY, 'salt', 32), Buffer.from(ivHex, 'hex'));
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

// Auth helpers
async function authenticateRequest(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return null;
  try {
    const { payload } = await jose.jwtVerify(authHeader.split(' ')[1], JWT_SECRET, { issuer: JWT_ISSUER });
    return payload;
  } catch { return null; }
}

async function verifyProjectOwnership(projectId, userId) {
  const result = await pool.query('SELECT id FROM projects WHERE id = $1 AND user_id = $2', [projectId, userId]);
  return result.rows.length > 0;
}

// Auto-run schema on startup
async function initDB() {
  try {
    const schema = readFileSync(new URL('./schema.sql', import.meta.url), 'utf8');
    await pool.query(schema);
    console.log('[auth] Database schema initialized');
  } catch (err) {
    console.error('[auth] Schema init error:', err.message);
  }
}

// Rate limiting
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 20,
  message: { error: { message: 'Too many attempts, try again later', type: 'rate_limit' } },
});

// Helper: create JWT
async function createToken(user) {
  return await new jose.SignJWT({ userId: user.id, email: user.email, displayName: user.display_name })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setIssuer(JWT_ISSUER)
    .setExpirationTime(JWT_EXPIRY)
    .sign(JWT_SECRET);
}

// Helper: verify JWT
async function verifyToken(token) {
  const { payload } = await jose.jwtVerify(token, JWT_SECRET, { issuer: JWT_ISSUER });
  return payload;
}

// POST /auth/register
app.post('/auth/register', authLimiter, async (req, res) => {
  try {
    const { email, password, displayName } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: { message: 'Email and password required', type: 'validation' } });
    }

    if (password.length < 8) {
      return res.status(400).json({ error: { message: 'Password must be at least 8 characters', type: 'validation' } });
    }

    // Check if email already exists
    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);

    if (existing.rows.length > 0) {
      return res.status(409).json({ error: { message: 'Email already registered', type: 'conflict' } });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const result = await pool.query(
      'INSERT INTO users (email, password_hash, display_name) VALUES ($1, $2, $3) RETURNING id, email, display_name, created_at',
      [email.toLowerCase(), passwordHash, displayName || email.split('@')[0]],
    );

    const user = result.rows[0];
    const token = await createToken(user);

    res.status(201).json({ token, user: { id: user.id, email: user.email, displayName: user.display_name } });
  } catch (err) {
    console.error('[auth] Register error:', err);
    res.status(500).json({ error: { message: 'Internal server error', type: 'server' } });
  }
});

// POST /auth/login
app.post('/auth/login', authLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: { message: 'Email and password required', type: 'validation' } });
    }

    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email.toLowerCase()]);

    if (result.rows.length === 0) {
      return res.status(401).json({ error: { message: 'Invalid credentials', type: 'auth' } });
    }

    const user = result.rows[0];
    const validPassword = await bcrypt.compare(password, user.password_hash);

    if (!validPassword) {
      return res.status(401).json({ error: { message: 'Invalid credentials', type: 'auth' } });
    }

    // Update last login
    await pool.query('UPDATE users SET updated_at = NOW() WHERE id = $1', [user.id]);

    const token = await createToken(user);
    res.json({ token, user: { id: user.id, email: user.email, displayName: user.display_name } });
  } catch (err) {
    console.error('[auth] Login error:', err);
    res.status(500).json({ error: { message: 'Internal server error', type: 'server' } });
  }
});

// GET /auth/me
app.get('/auth/me', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: { message: 'No token provided', type: 'auth' } });
    }

    const token = authHeader.slice(7);
    const payload = await verifyToken(token);

    const result = await pool.query('SELECT id, email, display_name, created_at FROM users WHERE id = $1', [
      payload.userId,
    ]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: { message: 'User not found', type: 'not_found' } });
    }

    const user = result.rows[0];
    res.json({
      user: { id: user.id, email: user.email, displayName: user.display_name, createdAt: user.created_at },
    });
  } catch (err) {
    if (err.code === 'ERR_JWT_EXPIRED') {
      return res.status(401).json({ error: { message: 'Token expired', type: 'auth' } });
    }

    console.error('[auth] Me error:', err);
    res.status(401).json({ error: { message: 'Invalid token', type: 'auth' } });
  }
});

// POST /auth/refresh
app.post('/auth/refresh', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: { message: 'No token provided', type: 'auth' } });
    }

    const token = authHeader.slice(7);
    const payload = await verifyToken(token);

    const result = await pool.query('SELECT id, email, display_name FROM users WHERE id = $1', [payload.userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: { message: 'User not found', type: 'not_found' } });
    }

    const newToken = await createToken(result.rows[0]);
    res.json({ token: newToken });
  } catch (err) {
    res.status(401).json({ error: { message: 'Invalid token', type: 'auth' } });
  }
});

// PATCH /auth/profile — update display name
app.patch('/auth/profile', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: { message: 'No token provided', type: 'auth' } });
    }

    const token = authHeader.slice(7);
    const payload = await verifyToken(token);

    const { displayName } = req.body;

    if (!displayName || !displayName.trim()) {
      return res.status(400).json({ error: { message: 'Display name is required', type: 'validation' } });
    }

    const result = await pool.query(
      'UPDATE users SET display_name = $1, updated_at = NOW() WHERE id = $2 RETURNING id, email, display_name',
      [displayName.trim(), payload.userId],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: { message: 'User not found', type: 'not_found' } });
    }

    const user = result.rows[0];
    res.json({ user: { id: user.id, email: user.email, displayName: user.display_name } });
  } catch (err) {
    if (err.code === 'ERR_JWT_EXPIRED') {
      return res.status(401).json({ error: { message: 'Token expired', type: 'auth' } });
    }

    console.error('[auth] Profile update error:', err);
    res.status(500).json({ error: { message: 'Internal server error', type: 'server' } });
  }
});

// POST /auth/change-password
app.post('/auth/change-password', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: { message: 'No token provided', type: 'auth' } });
    }

    const token = authHeader.slice(7);
    const payload = await verifyToken(token);

    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: { message: 'Current and new password are required', type: 'validation' } });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ error: { message: 'New password must be at least 8 characters', type: 'validation' } });
    }

    const result = await pool.query('SELECT * FROM users WHERE id = $1', [payload.userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: { message: 'User not found', type: 'not_found' } });
    }

    const user = result.rows[0];
    const validPassword = await bcrypt.compare(currentPassword, user.password_hash);

    if (!validPassword) {
      return res.status(401).json({ error: { message: 'Current password is incorrect', type: 'auth' } });
    }

    const newHash = await bcrypt.hash(newPassword, 12);
    await pool.query('UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2', [newHash, payload.userId]);

    res.json({ message: 'Password changed successfully' });
  } catch (err) {
    if (err.code === 'ERR_JWT_EXPIRED') {
      return res.status(401).json({ error: { message: 'Token expired', type: 'auth' } });
    }

    console.error('[auth] Change password error:', err);
    res.status(500).json({ error: { message: 'Internal server error', type: 'server' } });
  }
});

// ─── Project CRUD ───

// POST /projects — create project
app.post('/projects', async (req, res) => {
  try {
    const payload = await authenticateRequest(req);
    if (!payload) return res.status(401).json({ error: { message: 'No token provided', type: 'auth' } });

    const { name, description, visibility, chatId } = req.body;
    if (!name?.trim()) {
      return res.status(400).json({ error: { message: 'Project name is required', type: 'validation' } });
    }

    const result = await pool.query(
      `INSERT INTO projects (user_id, name, description, visibility, chat_id)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, user_id, name, description, visibility, share_slug, chat_id, created_at, updated_at`,
      [payload.userId, name.trim(), description || null, visibility || 'private', chatId || null],
    );

    res.status(201).json({ project: result.rows[0] });
  } catch (err) {
    console.error('[auth] Create project error:', err);
    res.status(500).json({ error: { message: 'Internal server error', type: 'server' } });
  }
});

// GET /projects — list user's projects
app.get('/projects', async (req, res) => {
  try {
    const payload = await authenticateRequest(req);
    if (!payload) return res.status(401).json({ error: { message: 'No token provided', type: 'auth' } });

    const result = await pool.query(
      `SELECT p.*, ph.provider AS hosting_provider, ph.deploy_status, ph.domain
       FROM projects p
       LEFT JOIN project_hosting ph ON ph.project_id = p.id
       WHERE p.user_id = $1
       ORDER BY p.updated_at DESC`,
      [payload.userId],
    );

    res.json({ projects: result.rows });
  } catch (err) {
    console.error('[auth] List projects error:', err);
    res.status(500).json({ error: { message: 'Internal server error', type: 'server' } });
  }
});

// GET /projects/:id — get single project
app.get('/projects/:id', async (req, res) => {
  try {
    const payload = await authenticateRequest(req);
    if (!payload) return res.status(401).json({ error: { message: 'No token provided', type: 'auth' } });

    const result = await pool.query(
      `SELECT p.*,
              ph.provider AS hosting_provider, ph.deploy_status, ph.domain,
              ph.netlify_site_id, ph.vercel_project_id, ph.self_container_id, ph.last_deploy_at,
              pd.provider AS db_provider, pd.supabase_url, pd.local_db_name
       FROM projects p
       LEFT JOIN project_hosting ph ON ph.project_id = p.id
       LEFT JOIN project_databases pd ON pd.project_id = p.id
       WHERE p.id = $1 AND p.user_id = $2`,
      [req.params.id, payload.userId],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: { message: 'Project not found', type: 'not_found' } });
    }

    res.json({ project: result.rows[0] });
  } catch (err) {
    console.error('[auth] Get project error:', err);
    res.status(500).json({ error: { message: 'Internal server error', type: 'server' } });
  }
});

// PATCH /projects/:id — update project
app.patch('/projects/:id', async (req, res) => {
  try {
    const payload = await authenticateRequest(req);
    if (!payload) return res.status(401).json({ error: { message: 'No token provided', type: 'auth' } });

    if (!(await verifyProjectOwnership(req.params.id, payload.userId))) {
      return res.status(404).json({ error: { message: 'Project not found', type: 'not_found' } });
    }

    const { name, description, visibility } = req.body;
    const fields = [];
    const values = [];
    let idx = 1;

    if (name !== undefined) { fields.push(`name = $${idx++}`); values.push(name.trim()); }
    if (description !== undefined) { fields.push(`description = $${idx++}`); values.push(description); }
    if (visibility !== undefined) { fields.push(`visibility = $${idx++}`); values.push(visibility); }

    if (fields.length === 0) {
      return res.status(400).json({ error: { message: 'No fields to update', type: 'validation' } });
    }

    fields.push(`updated_at = NOW()`);
    values.push(req.params.id);

    const result = await pool.query(
      `UPDATE projects SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
      values,
    );

    res.json({ project: result.rows[0] });
  } catch (err) {
    console.error('[auth] Update project error:', err);
    res.status(500).json({ error: { message: 'Internal server error', type: 'server' } });
  }
});

// DELETE /projects/:id
app.delete('/projects/:id', async (req, res) => {
  try {
    const payload = await authenticateRequest(req);
    if (!payload) return res.status(401).json({ error: { message: 'No token provided', type: 'auth' } });

    const result = await pool.query(
      'DELETE FROM projects WHERE id = $1 AND user_id = $2 RETURNING id',
      [req.params.id, payload.userId],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: { message: 'Project not found', type: 'not_found' } });
    }

    res.json({ message: 'Project deleted' });
  } catch (err) {
    console.error('[auth] Delete project error:', err);
    res.status(500).json({ error: { message: 'Internal server error', type: 'server' } });
  }
});

// ─── Secrets ───

// GET /projects/:id/secrets — list keys only
app.get('/projects/:id/secrets', async (req, res) => {
  try {
    const payload = await authenticateRequest(req);
    if (!payload) return res.status(401).json({ error: { message: 'No token provided', type: 'auth' } });

    if (!(await verifyProjectOwnership(req.params.id, payload.userId))) {
      return res.status(404).json({ error: { message: 'Project not found', type: 'not_found' } });
    }

    const result = await pool.query(
      'SELECT id, key, created_at FROM project_secrets WHERE project_id = $1 ORDER BY key',
      [req.params.id],
    );

    res.json({ secrets: result.rows });
  } catch (err) {
    console.error('[auth] List secrets error:', err);
    res.status(500).json({ error: { message: 'Internal server error', type: 'server' } });
  }
});

// PUT /projects/:id/secrets — create/update secret
app.put('/projects/:id/secrets', async (req, res) => {
  try {
    const payload = await authenticateRequest(req);
    if (!payload) return res.status(401).json({ error: { message: 'No token provided', type: 'auth' } });

    if (!(await verifyProjectOwnership(req.params.id, payload.userId))) {
      return res.status(404).json({ error: { message: 'Project not found', type: 'not_found' } });
    }

    const { key, value } = req.body;
    if (!key?.trim() || value === undefined) {
      return res.status(400).json({ error: { message: 'Key and value are required', type: 'validation' } });
    }

    const encrypted = encrypt(value);
    const result = await pool.query(
      `INSERT INTO project_secrets (project_id, key, value_encrypted)
       VALUES ($1, $2, $3)
       ON CONFLICT (project_id, key) DO UPDATE SET value_encrypted = $3, created_at = NOW()
       RETURNING id, key, created_at`,
      [req.params.id, key.trim(), encrypted],
    );

    res.json({ secret: result.rows[0] });
  } catch (err) {
    console.error('[auth] Upsert secret error:', err);
    res.status(500).json({ error: { message: 'Internal server error', type: 'server' } });
  }
});

// DELETE /projects/:id/secrets/:key
app.delete('/projects/:id/secrets/:key', async (req, res) => {
  try {
    const payload = await authenticateRequest(req);
    if (!payload) return res.status(401).json({ error: { message: 'No token provided', type: 'auth' } });

    if (!(await verifyProjectOwnership(req.params.id, payload.userId))) {
      return res.status(404).json({ error: { message: 'Project not found', type: 'not_found' } });
    }

    const result = await pool.query(
      'DELETE FROM project_secrets WHERE project_id = $1 AND key = $2 RETURNING id',
      [req.params.id, req.params.key],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: { message: 'Secret not found', type: 'not_found' } });
    }

    res.json({ message: 'Secret deleted' });
  } catch (err) {
    console.error('[auth] Delete secret error:', err);
    res.status(500).json({ error: { message: 'Internal server error', type: 'server' } });
  }
});

// ─── Hosting ───

// PUT /projects/:id/hosting — configure hosting provider
app.put('/projects/:id/hosting', async (req, res) => {
  try {
    const payload = await authenticateRequest(req);
    if (!payload) return res.status(401).json({ error: { message: 'No token provided', type: 'auth' } });

    if (!(await verifyProjectOwnership(req.params.id, payload.userId))) {
      return res.status(404).json({ error: { message: 'Project not found', type: 'not_found' } });
    }

    const { provider, domain, netlifySiteId, vercelProjectId, selfContainerId } = req.body;
    if (!provider) {
      return res.status(400).json({ error: { message: 'Provider is required', type: 'validation' } });
    }

    const result = await pool.query(
      `INSERT INTO project_hosting (project_id, provider, domain, netlify_site_id, vercel_project_id, self_container_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (project_id) DO UPDATE SET
         provider = $2, domain = $3, netlify_site_id = $4, vercel_project_id = $5, self_container_id = $6
       RETURNING *`,
      [req.params.id, provider, domain || null, netlifySiteId || null, vercelProjectId || null, selfContainerId || null],
    );

    res.json({ hosting: result.rows[0] });
  } catch (err) {
    console.error('[auth] Upsert hosting error:', err);
    res.status(500).json({ error: { message: 'Internal server error', type: 'server' } });
  }
});

// ─── Database Config ───

// PUT /projects/:id/database — configure database provider
app.put('/projects/:id/database', async (req, res) => {
  try {
    const payload = await authenticateRequest(req);
    if (!payload) return res.status(401).json({ error: { message: 'No token provided', type: 'auth' } });

    if (!(await verifyProjectOwnership(req.params.id, payload.userId))) {
      return res.status(404).json({ error: { message: 'Project not found', type: 'not_found' } });
    }

    const { provider, supabaseUrl, supabaseAnonKey, localDbName, connectionString } = req.body;
    if (!provider) {
      return res.status(400).json({ error: { message: 'Provider is required', type: 'validation' } });
    }

    const encryptedConn = connectionString ? encrypt(connectionString) : null;

    const result = await pool.query(
      `INSERT INTO project_databases (project_id, provider, supabase_url, supabase_anon_key, local_db_name, connection_string_encrypted)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (project_id) DO UPDATE SET
         provider = $2, supabase_url = $3, supabase_anon_key = $4, local_db_name = $5, connection_string_encrypted = $6
       RETURNING project_id, provider, supabase_url, local_db_name, created_at`,
      [req.params.id, provider, supabaseUrl || null, supabaseAnonKey || null, localDbName || null, encryptedConn],
    );

    res.json({ database: result.rows[0] });
  } catch (err) {
    console.error('[auth] Upsert database config error:', err);
    res.status(500).json({ error: { message: 'Internal server error', type: 'server' } });
  }
});

// POST /projects/:id/database/provision — create local PostgreSQL database
app.post('/projects/:id/database/provision', async (req, res) => {
  try {
    const payload = await authenticateRequest(req);
    if (!payload) return res.status(401).json({ error: { message: 'No token provided', type: 'auth' } });

    if (!(await verifyProjectOwnership(req.params.id, payload.userId))) {
      return res.status(404).json({ error: { message: 'Project not found', type: 'not_found' } });
    }

    const dbName = `project_${req.params.id.replace(/-/g, '_')}`;

    // Create the database (ignore if already exists)
    try {
      await pool.query(`CREATE DATABASE "${dbName}"`);
    } catch (dbErr) {
      if (dbErr.code !== '42P04') throw dbErr; // 42P04 = duplicate_database
    }

    const connectionString = `postgresql://${process.env.PGUSER || 'postgres'}:${process.env.PGPASSWORD || ''}@${process.env.PGHOST || 'localhost'}:${process.env.PGPORT || '5432'}/${dbName}`;
    const encryptedConn = encrypt(connectionString);

    await pool.query(
      `INSERT INTO project_databases (project_id, provider, local_db_name, connection_string_encrypted)
       VALUES ($1, 'local', $2, $3)
       ON CONFLICT (project_id) DO UPDATE SET
         provider = 'local', local_db_name = $2, connection_string_encrypted = $3`,
      [req.params.id, dbName, encryptedConn],
    );

    res.status(201).json({ database: { provider: 'local', localDbName: dbName, message: 'Database provisioned' } });
  } catch (err) {
    console.error('[auth] Provision database error:', err);
    res.status(500).json({ error: { message: 'Internal server error', type: 'server' } });
  }
});

// ─── Internal DB proxy (called by app's /api/db-proxy route) ─────────────────
app.post('/db/query', async (req, res) => {
  // Only accept requests from the app service (via internal secret)
  const secret = req.headers['x-internal-secret'];
  if (secret !== 'bolt-internal') {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const { sql, params } = req.body;
  if (!sql?.trim()) {
    return res.status(400).json({ error: 'No SQL provided' });
  }

  try {
    const result = await pool.query(sql, params || []);
    res.json({ rows: result.rows, rowCount: result.rowCount });
  } catch (err) {
    console.error('[auth] DB query error:', err.message);
    res.status(400).json({ error: err.message });
  }
});

// ─── Hosting / Domain management ─────────────────────────────────────────────

// GET /hosting/:projectId — get hosting info
app.get('/hosting/:projectId', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM project_hosting WHERE project_id = $1', [req.params.projectId]);
    if (result.rows.length === 0) return res.json({ hosting: null });
    res.json({ hosting: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /hosting/:projectId — create/update hosting config + generate slug
app.post('/hosting/:projectId', async (req, res) => {
  try {
    const { slug, customDomain, buildCommand, outputDir } = req.body;

    // Generate slug from project name if not provided
    let finalSlug = slug;
    if (!finalSlug) {
      const proj = await pool.query('SELECT name FROM projects WHERE id = $1', [req.params.projectId]);
      if (proj.rows[0]) {
        finalSlug = proj.rows[0].name
          .toLowerCase()
          .replace(/[^a-z0-9]/g, '-')
          .replace(/-+/g, '-')
          .slice(0, 50);
      } else {
        finalSlug = req.params.projectId.slice(0, 8);
      }
    }

    // Ensure slug is unique
    const existing = await pool.query(
      'SELECT project_id FROM project_hosting WHERE slug = $1 AND project_id != $2',
      [finalSlug, req.params.projectId]
    );
    if (existing.rows.length > 0) {
      finalSlug = `${finalSlug}-${Date.now().toString(36).slice(-4)}`;
    }

    await pool.query(
      `INSERT INTO project_hosting (project_id, slug, custom_domain, build_command, output_dir)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (project_id) DO UPDATE SET
         slug = COALESCE($2, project_hosting.slug),
         custom_domain = $3,
         build_command = COALESCE($4, project_hosting.build_command),
         output_dir = COALESCE($5, project_hosting.output_dir),
         deploy_status = 'pending'`,
      [req.params.projectId, finalSlug, customDomain || null, buildCommand || 'npm run build', outputDir || 'dist']
    );

    // Get the instance domain from env
    const instanceDomain = process.env.DOMAIN || 'localhost';
    const autoUrl = `https://${finalSlug}.${instanceDomain}`;
    const customUrl = customDomain ? `https://${customDomain}` : null;

    res.json({
      hosting: {
        slug: finalSlug,
        autoUrl,
        customUrl,
        customDomain: customDomain || null,
      }
    });
  } catch (err) {
    console.error('[auth] Hosting config error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /hosting — list all hosted apps (for Caddy config generation)
app.get('/hosting', async (req, res) => {
  const secret = req.headers['x-internal-secret'];
  if (secret !== 'bolt-internal') {
    return res.status(403).json({ error: 'Forbidden' });
  }
  try {
    const result = await pool.query(
      `SELECT h.*, p.name AS project_name
       FROM project_hosting h
       JOIN projects p ON p.id = h.project_id
       WHERE h.deploy_status = 'live'
       ORDER BY h.last_deploy_at DESC`
    );
    res.json({ apps: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok' }));

// Start
const PORT = process.env.PORT || 3200;
initDB().then(() => {
  app.listen(PORT, () => console.log(`[auth] Auth service running on port ${PORT}`));
});
