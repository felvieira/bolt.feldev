import express from 'express';
import pg from 'pg';
import bcrypt from 'bcrypt';
import * as jose from 'jose';
import rateLimit from 'express-rate-limit';
import cors from 'cors';
import { readFileSync } from 'fs';

const app = express();
app.use(cors());
app.use(express.json());

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'change-me-in-production');
const JWT_ISSUER = 'bolt-auth';
const JWT_EXPIRY = '7d';

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

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok' }));

// Start
const PORT = process.env.PORT || 3200;
initDB().then(() => {
  app.listen(PORT, () => console.log(`[auth] Auth service running on port ${PORT}`));
});
