// /api/channels - CRUD for multi-tenant channel management
const { supabase } = require('../../../lib/supabase');

export default async function handler(req, res) {
  if (!supabase) {
    return res.status(500).json({ error: 'Supabase not configured' });
  }

  // Simple admin auth check - require CRON_SECRET or x-bot-internal header
  const authHeader = req.headers.authorization;
  const isInternal = req.headers['x-bot-internal'] === 'true';
  const validSecret = authHeader === `Bearer ${process.env.CRON_SECRET}`;

  if (!validSecret && !isInternal && req.method !== 'GET') {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    switch (req.method) {
      case 'GET': {
        const { active } = req.query;
        let query = supabase.from('channels').select('*').order('created_at', { ascending: true });
        if (active === 'true') query = query.eq('active', true);
        const { data, error } = await query;
        if (error) throw error;
        return res.json({ channels: data });
      }

      case 'POST': {
        const { channel_id, display_name, language, coupon_code, bonus_offer, leagues, timezone, buttons, owner_user_id } = req.body;
        if (!channel_id) return res.status(400).json({ error: 'channel_id is required' });

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
            owner_user_id: owner_user_id || null,
            active: true,
          })
          .select()
          .single();

        if (error) throw error;
        // Invalidate channel cache
        try { require('../../../lib/channel-config').invalidateCache(); } catch (_) {}
        return res.status(201).json({ channel: data });
      }

      default:
        res.setHeader('Allow', 'GET, POST');
        return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (err) {
    console.error('Channels API error:', err);
    return res.status(500).json({ error: err.message });
  }
}
