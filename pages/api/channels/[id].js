// /api/channels/[id] - Single channel CRUD (by channel_id or UUID)
const { supabase } = require('../../../lib/supabase');

export default async function handler(req, res) {
  if (!supabase) {
    return res.status(500).json({ error: 'Supabase not configured' });
  }

  const { id } = req.query;

  // Auth for write operations
  const authHeader = req.headers.authorization;
  const isInternal = req.headers['x-bot-internal'] === 'true';
  const validSecret = authHeader === `Bearer ${process.env.CRON_SECRET}`;

  if (!validSecret && !isInternal && req.method !== 'GET') {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Determine if id is UUID or channel_id
  const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
  const filterCol = isUUID ? 'id' : 'channel_id';
  const filterVal = isUUID ? id : (id.startsWith('@') ? id : `@${id}`);

  try {
    switch (req.method) {
      case 'GET': {
        const { data, error } = await supabase
          .from('channels')
          .select('*')
          .eq(filterCol, filterVal)
          .single();
        if (error) throw error;
        if (!data) return res.status(404).json({ error: 'Channel not found' });
        return res.json({ channel: data });
      }

      case 'PUT': {
        const updates = req.body;
        // Don't allow changing the channel_id or id
        delete updates.id;
        delete updates.channel_id;
        updates.updated_at = new Date().toISOString();

        const { data, error } = await supabase
          .from('channels')
          .update(updates)
          .eq(filterCol, filterVal)
          .select()
          .single();

        if (error) throw error;
        try { require('../../../lib/channel-config').invalidateCache(); } catch (_) {}
        return res.json({ channel: data });
      }

      case 'DELETE': {
        // Soft delete - just deactivate
        const { data, error } = await supabase
          .from('channels')
          .update({ active: false, updated_at: new Date().toISOString() })
          .eq(filterCol, filterVal)
          .select()
          .single();

        if (error) throw error;
        try { require('../../../lib/channel-config').invalidateCache(); } catch (_) {}
        return res.json({ channel: data, message: 'Channel deactivated' });
      }

      default:
        res.setHeader('Allow', 'GET, PUT, DELETE');
        return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (err) {
    console.error('Channel API error:', err);
    return res.status(500).json({ error: err.message });
  }
}
