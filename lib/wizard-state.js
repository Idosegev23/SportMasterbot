const fs = require('fs').promises;
const fssync = require('fs');
const path = require('path');

const DIR = path.join('/tmp', 'wizard');

async function ensureDir() {
  try { await fs.mkdir(DIR, { recursive: true }); } catch (_) {}
}

function filePath(chatId) {
  return path.join(DIR, `wizard-${chatId}.json`);
}

async function getState(chatId) {
  await ensureDir();
  const p = filePath(chatId);
  if (!fssync.existsSync(p)) return null;
  try {
    const raw = await fs.readFile(p, 'utf8');
    return JSON.parse(raw);
  } catch (_) {
    return null;
  }
}

async function setState(chatId, state) {
  await ensureDir();
  const p = filePath(chatId);
  await fs.writeFile(p, JSON.stringify(state, null, 2), 'utf8');
}

async function clearState(chatId) {
  const p = filePath(chatId);
  try { await fs.unlink(p); } catch (_) {}
}

module.exports = { getState, setState, clearState };

