// Refresh Telegram Views - manual trigger instead of cron

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  try {
    const { supabase } = require('../../../lib/supabase');
    
    if (!supabase) {
      return res.status(500).json({ success: false, message: 'Supabase not configured' });
    }

    // Check if we have the necessary Telegram API credentials
    if (!process.env.TELEGRAM_API_ID || !process.env.TELEGRAM_API_HASH) {
      return res.status(200).json({ 
        success: false, 
        message: 'טלגרם API לא מוגדר. צריך TELEGRAM_API_ID ו-TELEGRAM_API_HASH בהגדרות הסביבה.' 
      });
    }

    // Pull recent posts
    const { data: posts } = await supabase
      .from('posts')
      .select('id, telegram_message_id')
      .eq('status', 'sent')
      .not('telegram_message_id', 'is', null)
      .order('sent_at', { ascending: false })
      .limit(20);

    const messageIds = (posts || []).map(p => Number(p.telegram_message_id)).filter(Boolean);
    
    if (messageIds.length === 0) {
      return res.status(200).json({ 
        success: true, 
        message: 'אין הודעות לעדכון', 
        count: 0 
      });
    }

    // Use telegram-stats to fetch views
    const TelegramStats = require('../../../lib/telegram-stats');
  const channel = process.env.CHANNEL_USERNAME || '@africansportdata';
    const ts = new TelegramStats();
    
    const views = await ts.getMessageViews(channel, messageIds);

    // Upsert to telegram_message_stats
    const rows = views.map(v => ({
      message_id: v.msg_id,
      views: v.views,
      forwards: v.forwards,
      fetched_at: new Date().toISOString(),
    }));

    if (rows.length > 0) {
      await supabase.from('telegram_message_stats').upsert(rows, { onConflict: 'message_id' });
    }

    return res.status(200).json({ 
      success: true, 
      message: `✅ עודכנו ${rows.length} הודעות`,
      items: rows.length,
      data: rows.slice(0, 5) // Show first 5 for preview
    });

  } catch (error) {
    console.error('❌ refresh-views error:', error);
    return res.status(500).json({ 
      success: false, 
      message: `שגיאה: ${error.message}`
    });
  }
}