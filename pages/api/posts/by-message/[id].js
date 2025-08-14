// Fetch post by Telegram message_id for analytics modal
import { supabase } from '../../../../lib/supabase';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    if (!supabase) {
      return res.status(500).json({ success: false, error: 'Supabase not configured' });
    }

    const { id } = req.query;
    if (!id) {
      return res.status(400).json({ success: false, error: 'Missing message id' });
    }

    const msgId = String(id);

    // Try by telegram_message_id
    const { data: byMsgId, error: e1 } = await supabase
      .from('posts')
      .select('id, content, content_type, status, language, telegram_message_id, created_at')
      .eq('telegram_message_id', msgId)
      .order('created_at', { ascending: false })
      .limit(1);

    let post = Array.isArray(byMsgId) && byMsgId.length ? byMsgId[0] : null;

    // Fallback: try by numeric id
    if (!post && /^\d+$/.test(msgId)) {
      const { data: byId } = await supabase
        .from('posts')
        .select('id, content, content_type, status, language, telegram_message_id, created_at')
        .eq('id', Number(msgId))
        .limit(1);
      post = Array.isArray(byId) && byId.length ? byId[0] : null;
    }

    if (!post) {
      return res.status(404).json({ success: false, error: 'Post not found' });
    }

    return res.status(200).json({ success: true, post });
  } catch (error) {
    console.error('❌ by-message error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}

