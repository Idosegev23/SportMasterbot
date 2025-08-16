const { supabase } = require('./supabase');

async function upsertUserFromMsg(msg, consent = false, channelId = null) {
  if (!supabase) return;
  const user = msg.from || {};
  const defaultChannelId = channelId || process.env.CHANNEL_DB_UUID || process.env.SUPABASE_DEFAULT_CHANNEL_ID || process.env.CHANNEL_ID;
  await supabase.from('users').upsert({
    user_id: user.id,
    username: user.username || null,
    first_name: user.first_name || null,
    last_name: user.last_name || null,
    last_seen_at: new Date().toISOString(),
    consent,
    channel_id: defaultChannelId
  });
}

async function ensureUser(user, channelId = null) {
  if (!supabase || !user?.id) return;
  try {
    const defaultChannelId = channelId || process.env.CHANNEL_DB_UUID || process.env.SUPABASE_DEFAULT_CHANNEL_ID || process.env.CHANNEL_ID;
    await supabase.from('users').upsert({
      user_id: user.id,
      username: user.username || null,
      first_name: user.first_name || null,
      last_name: user.last_name || null,
      last_seen_at: new Date().toISOString(),
      consent: false,
      channel_id: defaultChannelId
    });
  } catch (_) {}
}

async function recordInteraction(msgOrCb, type, context = {}) {
  if (!supabase) return;
  const user = (msgOrCb.from) || (msgOrCb.message && msgOrCb.message.from) || {};
  if (!user.id) return;
  const channelId = process.env.CHANNEL_DB_UUID || process.env.SUPABASE_DEFAULT_CHANNEL_ID || process.env.CHANNEL_ID;
  await ensureUser(user, channelId);
  try {
    const botId = process.env.SUPABASE_BOT_ID || null; // now UUID in prod
    await supabase.from('interactions').insert({
      user_id: user.id,
      type,
      context,
      bot_id: botId
    });
  } catch (_) {}
  try {
    const { error: rpcError } = await supabase.rpc('increment_user_metrics', { p_user_id: user.id });
    if (rpcError) console.log('⚠️ increment_user_metrics error:', rpcError.message);
  } catch (e) {
    console.log('⚠️ increment_user_metrics exception:', e.message);
  }
}

module.exports = { upsertUserFromMsg, recordInteraction };

