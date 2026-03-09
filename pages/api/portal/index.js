// /api/portal - Channel owner portal API
// Auth via owner_token query param
const { supabase } = require('../../../lib/supabase');

async function getChannelByToken(token) {
  if (!token || !supabase) return null;
  const { data } = await supabase
    .from('channels')
    .select('*')
    .eq('owner_token', token)
    .single();
  return data;
}

export default async function handler(req, res) {
  if (!supabase) {
    return res.status(500).json({ error: 'Supabase not configured' });
  }

  const token = req.query.token || req.headers['x-portal-token'];
  if (!token) {
    return res.status(401).json({ error: 'Missing token' });
  }

  const channel = await getChannelByToken(token);
  if (!channel) {
    return res.status(403).json({ error: 'Invalid or expired token' });
  }

  try {
    switch (req.method) {
      case 'GET': {
        // Return channel info + stats
        const channelId = channel.channel_id;

        // Get post count
        const { count: postCount } = await supabase
          .from('posts')
          .select('*', { count: 'exact', head: true })
          .eq('channel_id', channelId);

        // Get today's posts
        const today = new Date().toISOString().split('T')[0];
        const { count: todayPosts } = await supabase
          .from('posts')
          .select('*', { count: 'exact', head: true })
          .eq('channel_id', channelId)
          .gte('created_at', today);

        // Sanitize - don't expose owner_token
        const { owner_token, ...safeChannel } = channel;

        return res.json({
          channel: safeChannel,
          stats: {
            totalPosts: postCount || 0,
            todayPosts: todayPosts || 0,
          }
        });
      }

      case 'PUT': {
        // Owner can update limited fields only
        const allowed = ['display_name', 'language', 'coupon_code', 'bonus_offer', 'leagues', 'buttons', 'timezone'];
        const updates = {};
        for (const key of allowed) {
          if (req.body[key] !== undefined) {
            updates[key] = req.body[key];
          }
        }

        if (Object.keys(updates).length === 0) {
          return res.status(400).json({ error: 'No valid fields to update' });
        }

        updates.updated_at = new Date().toISOString();

        const { data, error } = await supabase
          .from('channels')
          .update(updates)
          .eq('id', channel.id)
          .select()
          .single();

        if (error) throw error;
        try { require('../../../lib/channel-config').invalidateCache(); } catch (_) {}

        const { owner_token: _, ...safeData } = data;
        return res.json({ channel: safeData, message: 'Updated successfully' });
      }

      default:
        res.setHeader('Allow', 'GET, PUT');
        return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (err) {
    console.error('Portal API error:', err);
    return res.status(500).json({ error: err.message });
  }
}
