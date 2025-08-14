const fs = require('fs').promises;
const fssync = require('fs');
const path = require('path');

const CD_DIR = path.join('/tmp', 'gizebot-cd');

async function ensureDir() {
  try {
    await fs.mkdir(CD_DIR, { recursive: true });
  } catch (_) {}
}

function getKeyPath(key) {
  const safe = key.replace(/[^a-zA-Z0-9-_]/g, '_');
  return path.join(CD_DIR, `${safe}.json`);
}

async function isCooldownActive(key, windowMs) {
  await ensureDir();
  const p = getKeyPath(key);
  const now = Date.now();
  if (!fssync.existsSync(p)) return false;
  try {
    const raw = await fs.readFile(p, 'utf8');
    const data = JSON.parse(raw);
    if (!data || !data.lastTs) return false;
    return now - data.lastTs < windowMs;
  } catch (_) {
    return false;
  }
}

async function markCooldown(key) {
  await ensureDir();
  const p = getKeyPath(key);
  const data = { lastTs: Date.now() };
  await fs.writeFile(p, JSON.stringify(data), 'utf8');
}

module.exports = { isCooldownActive, markCooldown };

