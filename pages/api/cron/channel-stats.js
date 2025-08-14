// Cron: Pull Telegram channel message views and persist to Supabase

import TelegramStats from '../../../lib/telegram-stats';
import { supabase } from '../../../lib/supabase';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    if (!process.env.TELEGRAM_API_ID || !process.env.TELEGRAM_API_HASH) {
      return res.status(200).json({ success: false, message: 'MTProto not configured' });
    }
    if (!supabase) {
      return res.status(200).json({ success: false, message: 'Supabase not configured' });
    }

    // Pull last sent posts from our DB (limit 30)
    const { data: posts } = await supabase
      .from('posts')
      .select('id, telegram_message_id')
      .eq('status', 'sent')
      .not('telegram_message_id', 'is', null)
      .order('sent_at', { ascending: false })
      .limit(30);

    const messageIds = (posts || []).map(p => Number(p.telegram_message_id)).filter(Boolean);
    if (messageIds.length === 0) {
      return res.status(200).json({ success: true, message: 'No messages to fetch', count: 0 });
    }

  const channel = process.env.CHANNEL_USERNAME || '@africansportdata';
    const ts = new TelegramStats();
    const views = await ts.getMessageViews(channel, messageIds);

    // Upsert into a new table telegram_message_stats (create in DB if missing)
    const rows = views.map(v => ({
      message_id: v.msg_id,
      views: v.views,
      forwards: v.forwards,
      fetched_at: new Date().toISOString(),
    }));
    try {
      await supabase.from('telegram_message_stats').upsert(rows, { onConflict: 'message_id' });
    } catch (e) {
      // If table missing, ignore gracefully
      console.log('⚠️ Upsert telegram_message_stats failed:', e.message);
    }

    return res.status(200).json({ success: true, message: 'Fetched', items: rows.length });
  } catch (e) {
    console.error('❌ channel-stats error:', e);
    return res.status(500).json({ success: false, message: e.message });
  }
}

