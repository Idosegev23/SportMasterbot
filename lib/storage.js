// Simple storage abstraction with file-based persistence and in-memory rate limits
// Designed to be easily replaced with a real DB (e.g., Supabase) later

const fs = require('fs').promises;
const path = require('path');

const RATE_LIMIT_TTL_DEFAULT_SEC = 60;
const rateLimitMap = new Map(); // key -> expiresAt (ms)

function getTodayDateStr() {
  // Use Ethiopian timezone for consistency with match fetching
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Addis_Ababa' });
}

async function getSchedulePath() {
  const dir = path.join(process.cwd(), 'temp');
  await fs.mkdir(dir, { recursive: true }).catch(() => {});
  return path.join(dir, 'daily-schedule.json');
}

async function saveDailySchedule(schedule) {
  try {
    // Try Supabase first (more reliable in production)
    const { supabase } = require('./supabase');
    if (supabase) {
      const { error } = await supabase
        .from('daily_schedule')
        .upsert({
          date: schedule.date,
          schedule_data: schedule,
          updated_at: new Date().toISOString()
        }, { onConflict: 'date' });
      
      if (!error) {
        console.log('📁 Daily schedule saved to Supabase');
        return true;
      } else {
        console.log('⚠️ Supabase save failed, trying file system');
      }
    }
    
    // Fallback to file system
    const file = await getSchedulePath();
    await fs.writeFile(file, JSON.stringify(schedule, null, 2));
    console.log('📁 Daily schedule saved to file system');
    return true;
  } catch (err) {
    console.log('⚠️ saveDailySchedule error:', err.message);
    return false;
  }
}

async function getDailySchedule() {
  try {
    // Try Supabase first
    const { supabase } = require('./supabase');
    if (supabase) {
      const { data, error } = await supabase
        .from('daily_schedule')
        .select('schedule_data')
        .eq('date', getTodayDateStr())
        .single();
      
      if (!error && data?.schedule_data) {
        console.log('📁 Daily schedule loaded from Supabase');
        return data.schedule_data;
      }
    }
    
    // Fallback to file system
    const file = await getSchedulePath();
    const raw = await fs.readFile(file, 'utf8');
    const data = JSON.parse(raw);
    if (data?.date === getTodayDateStr() && Array.isArray(data.matches)) {
      console.log('📁 Daily schedule loaded from file system');
      return data;
    }
    return null;
  } catch (err) {
    console.log('⚠️ getDailySchedule error:', err.message);
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

