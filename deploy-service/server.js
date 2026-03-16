import express from 'express';
import { exec } from 'child_process';
import { mkdir, cp, writeFile, access, readFile } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const app = express();
const PORT = process.env.PORT || 3300;
const INTERNAL_SECRET = process.env.INTERNAL_SECRET || 'bolt-internal';
const DEPLOYMENTS_ROOT = '/deployments';
const BUILD_TIMEOUT = 120_000;

// slug -> { status: "building"|"live"|"error", logs?: string }
const buildStatus = new Map();

app.use(express.json({ limit: '50mb' }));

// --- POST /deploy ---
app.post('/deploy', async (req, res) => {
  if (req.headers['x-internal-secret'] !== INTERNAL_SECRET) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }

  const { projectId, slug, files, buildCommand, outputDir } = req.body;

  if (!slug || !files || typeof files !== 'object') {
    return res.status(400).json({ success: false, error: 'Missing slug or files' });
  }

  const sourceDir = path.join(DEPLOYMENTS_ROOT, slug, 'source');
  const publicDir = path.join(DEPLOYMENTS_ROOT, slug, 'public');
  const output = outputDir || 'dist';

  try {
    // Write all project files to source dir
    await mkdir(sourceDir, { recursive: true });
    await mkdir(publicDir, { recursive: true });

    for (const [filePath, content] of Object.entries(files)) {
      const fullPath = path.join(sourceDir, filePath);
      await mkdir(path.dirname(fullPath), { recursive: true });
      await writeFile(fullPath, content, 'utf-8');
    }

    buildStatus.set(slug, { status: 'building', logs: '' });

    // Run build in background
    const cmd = buildCommand || 'npm install && npm run build';

    exec(cmd, { cwd: sourceDir, timeout: BUILD_TIMEOUT, maxBuffer: 10 * 1024 * 1024 }, async (error, stdout, stderr) => {
      const logs = `${stdout}\n${stderr}`;

      if (error) {
        buildStatus.set(slug, { status: 'error', logs });
        return;
      }

      try {
        const buildOutputDir = path.join(sourceDir, output);
        await cp(buildOutputDir, publicDir, { recursive: true, force: true });
        buildStatus.set(slug, { status: 'live', logs });
      } catch (cpErr) {
        buildStatus.set(slug, { status: 'error', logs: `${logs}\nCopy error: ${cpErr.message}` });
      }
    });

    res.json({ success: true, slug, publicPath: `/deployments/${slug}/public` });
  } catch (err) {
    buildStatus.set(slug, { status: 'error', logs: err.message });
    res.status(500).json({ success: false, error: err.message });
  }
});

// --- GET /status/:slug ---
app.get('/status/:slug', (req, res) => {
  const { slug } = req.params;
  const entry = buildStatus.get(slug);

  if (!entry) {
    return res.status(404).json({ slug, status: 'unknown', error: 'No build found' });
  }

  res.json({ slug, status: entry.status, logs: entry.logs });
});

// --- GET /serve/:slug/* (static + SPA fallback) ---
app.get('/serve/:slug/*', async (req, res) => {
  const { slug } = req.params;
  const reqPath = req.params[0] || '';
  const publicDir = path.join(DEPLOYMENTS_ROOT, slug, 'public');
  const filePath = path.join(publicDir, reqPath);

  try {
    await access(filePath);
    return res.sendFile(filePath);
  } catch {
    // SPA fallback: serve index.html
    const indexPath = path.join(publicDir, 'index.html');
    try {
      await access(indexPath);
      return res.sendFile(indexPath);
    } catch {
      return res.status(404).json({ error: 'Not found' });
    }
  }
});

app.listen(PORT, () => {
  console.log(`Deploy service listening on port ${PORT}`);
});
