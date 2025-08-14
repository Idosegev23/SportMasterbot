// Simple storage abstraction with file-based persistence and in-memory rate limits
// Designed to be easily replaced with a real DB (e.g., Supabase) later

const fs = require('fs').promises;
const path = require('path');

const RATE_LIMIT_TTL_DEFAULT_SEC = 60;
const rateLimitMap = new Map(); // key -> expiresAt (ms)

function getTodayDateStr() {
  return new Date().toISOString().split('T')[0];
}

async function getSchedulePath() {
  const dir = path.join(process.cwd(), 'temp');
  await fs.mkdir(dir, { recursive: true }).catch(() => {});
  return path.join(dir, 'daily-schedule.json');
}

async function saveDailySchedule(schedule) {
  try {
    const file = await getSchedulePath();
    await fs.writeFile(file, JSON.stringify(schedule, null, 2));
    return true;
  } catch (err) {
    console.log('⚠️ saveDailySchedule error:', err.message);
    return false;
  }
}

async function getDailySchedule() {
  try {
    const file = await getSchedulePath();
    const raw = await fs.readFile(file, 'utf8');
    const data = JSON.parse(raw);
    if (data?.date === getTodayDateStr() && Array.isArray(data.matches)) {
      return data;
    }
    return null;
  } catch (err) {
    return null;
  }
}

function isRateLimitedSync(key) {
  const now = Date.now();
  const exp = rateLimitMap.get(key);
  if (exp && exp > now) return true;
  if (exp && exp <= now) rateLimitMap.delete(key);
  return false;
}

async function isRateLimited(key) {
  return isRateLimitedSync(key);
}

async function setRateLimit(key, ttlSec = RATE_LIMIT_TTL_DEFAULT_SEC) {
  const expiresAt = Date.now() + ttlSec * 1000;
  rateLimitMap.set(key, expiresAt);
}

module.exports = {
  saveDailySchedule,
  getDailySchedule,
  isRateLimited,
  setRateLimit,
  getTodayDateStr
};

