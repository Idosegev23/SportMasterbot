const fs = require('fs').promises;
const fssync = require('fs');
const path = require('path');

const LOCK_DIR = path.join('/tmp', 'gizebot-locks');

async function ensureDir() {
  try {
    await fs.mkdir(LOCK_DIR, { recursive: true });
  } catch (_) {}
}

function getLockPath(name) {
  const safe = name.replace(/[^a-zA-Z0-9-_]/g, '_');
  return path.join(LOCK_DIR, `${safe}.lock`);
}

async function acquireLock(name, ttlMs = 5 * 60 * 1000) {
  await ensureDir();
  const lockPath = getLockPath(name);
  const now = Date.now();
  const expiresAt = now + ttlMs;

  try {
    if (fssync.existsSync(lockPath)) {
      const raw = await fs.readFile(lockPath, 'utf8');
      try {
        const data = JSON.parse(raw);
        if (typeof data.expiresAt === 'number' && data.expiresAt > now) {
          return { acquired: false, remainingMs: data.expiresAt - now };
        }
      } catch (_) {}
      // Expired or invalid -> remove
      try { await fs.unlink(lockPath); } catch (_) {}
    }

    const data = { name, createdAt: now, expiresAt };
    await fs.writeFile(lockPath, JSON.stringify(data), 'utf8');
    return { acquired: true };
  } catch (error) {
    return { acquired: false, error: error.message };
  }
}

async function releaseLock(name) {
  const lockPath = getLockPath(name);
  try {
    await fs.unlink(lockPath);
    return true;
  } catch (_) {
    return false;
  }
}

module.exports = { acquireLock, releaseLock };

