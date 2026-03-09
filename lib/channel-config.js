// Multi-Channel Configuration Module
// Manages per-channel settings stored in Supabase `channels` table
//
// Supabase table schema:
//   channels (
//     id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
//     channel_id    TEXT NOT NULL UNIQUE,   -- e.g. "@africansportdata"
//     display_name  TEXT NOT NULL,          -- e.g. "Africa Sport Data"
//     language      TEXT DEFAULT 'en',      -- en, am (Amharic), sw (Swahili), fr, etc.
//     coupon_code   TEXT DEFAULT 'SM100',
//     bonus_offer   TEXT DEFAULT '100% Bonus',
//     leagues       JSONB DEFAULT '[]',     -- array of API-Football league IDs (empty = all popular)
//     timezone      TEXT DEFAULT 'Africa/Addis_Ababa',
//     active        BOOLEAN DEFAULT true,
//     buttons       JSONB DEFAULT '[]',     -- custom inline keyboard buttons [{text, url}]
//     created_at    TIMESTAMPTZ DEFAULT now(),
//     updated_at    TIMESTAMPTZ DEFAULT now()
//   )

const { supabase } = require('./supabase');

// In-memory cache (refreshed every 5 minutes)
let channelsCache = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 5 * 60 * 1000;

// Default channel config (used when Supabase is unavailable)
const DEFAULT_CHANNEL = {
  id: 'default',
  channel_id: process.env.CHANNEL_ID || '@africansportdata',
  display_name: 'SportMaster',
  language: 'en',
  coupon_code: 'SM100',
  bonus_offer: '100% Bonus',
  leagues: [],
  timezone: 'Africa/Addis_Ababa',
  active: true,
  buttons: [],
};

// Get all active channels
async function getActiveChannels() {
  // Return cache if fresh
  if (channelsCache && (Date.now() - cacheTimestamp) < CACHE_TTL_MS) {
    return channelsCache;
  }

  try {
    if (!supabase) {
      console.log('⚠️ Supabase not available, using default channel');
      channelsCache = [DEFAULT_CHANNEL];
      cacheTimestamp = Date.now();
      return channelsCache;
    }

    const { data, error } = await supabase
      .from('channels')
      .select('*')
      .eq('active', true)
      .order('created_at', { ascending: true });

    if (error) throw error;

    if (!data || data.length === 0) {
      console.log('⚠️ No channels in DB, using default');
      channelsCache = [DEFAULT_CHANNEL];
    } else {
      channelsCache = data;
      console.log(`📡 Loaded ${data.length} active channel(s)`);
    }

    cacheTimestamp = Date.now();
    return channelsCache;
  } catch (err) {
    console.error('❌ Error loading channels:', err.message);
    // Return cached or default
    return channelsCache || [DEFAULT_CHANNEL];
  }
}

// Get a single channel by its Telegram channel_id
async function getChannel(channelId) {
  const channels = await getActiveChannels();
  return channels.find(c => c.channel_id === channelId) || null;
}

// Get channel by DB id
async function getChannelById(id) {
  const channels = await getActiveChannels();
  return channels.find(c => c.id === id) || null;
}

// Create a new channel
async function createChannel({ channel_id, display_name, language, coupon_code, bonus_offer, leagues, timezone, buttons }) {
  if (!supabase) throw new Error('Supabase not configured');

  const { data, error } = await supabase
    .from('channels')
    .insert({
      channel_id,
      display_name: display_name || channel_id,
      language: language || 'en',
      coupon_code: coupon_code || 'SM100',
      bonus_offer: bonus_offer || '100% Bonus',
      leagues: leagues || [],
      timezone: timezone || 'Africa/Addis_Ababa',
      buttons: buttons || [],
      active: true,
    })
    .select()
    .single();

  if (error) throw error;

  // Invalidate cache
  channelsCache = null;
  console.log(`✅ Channel created: ${channel_id}`);
  return data;
}

// Update channel settings
async function updateChannel(channelId, updates) {
  if (!supabase) throw new Error('Supabase not configured');

  const { data, error } = await supabase
    .from('channels')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('channel_id', channelId)
    .select()
    .single();

  if (error) throw error;

  // Invalidate cache
  channelsCache = null;
  console.log(`✅ Channel updated: ${channelId}`);
  return data;
}

// Deactivate a channel
async function deactivateChannel(channelId) {
  return updateChannel(channelId, { active: false });
}

// Get channel by owner's Telegram user ID
async function getChannelByOwner(userId) {
  if (!userId) return null;
  const channels = await getActiveChannels();
  const numericId = Number(userId);
  return channels.find(c => Number(c.owner_user_id) === numericId) || null;
}

// Force cache refresh
function invalidateCache() {
  channelsCache = null;
  cacheTimestamp = 0;
}

module.exports = {
  getActiveChannels,
  getChannel,
  getChannelById,
  getChannelByOwner,
  createChannel,
  updateChannel,
  deactivateChannel,
  invalidateCache,
  DEFAULT_CHANNEL,
};
