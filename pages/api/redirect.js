import { recordClick } from '../../lib/click-store';
import { supabase } from '../../lib/supabase';

export default async function handler(req, res) {
  try {
    const { to, track_id } = req.query;
    if (!to) {
      return res.status(400).json({ success: false, message: 'Missing to parameter' });
    }
    // Basic allowlist to avoid open redirect abuse
    const url = new URL(to);
    const allowedHosts = ['t.me'];
    if (!allowedHosts.includes(url.hostname)) {
      return res.status(400).json({ success: false, message: 'Destination not allowed' });
    }

    // Log click (local file)
    const ip = req.headers['x-forwarded-for']?.split(',')[0] || req.socket.remoteAddress;
    const ua = req.headers['user-agent'] || '';
    const trackId = track_id || 'unknown';
    await recordClick({ to: url.toString(), track_id: trackId, ip, ua });

    // Best-effort: also persist to Supabase button_analytics with user_id if encoded
    try {
      if (supabase) {
        const channelIdEnv = process.env.SUPABASE_DEFAULT_CHANNEL_ID || null;
        // Try to extract numeric user_id from track_id pattern: pc_<userId>_<code>
        let userIdNum = null;
        const m = /^pc_(\d+)_/i.exec(String(trackId));
        if (m) userIdNum = Number(m[1]);

        const params = new URLSearchParams(url.search);
        const payload = {
          channel_id: channelIdEnv || null,
          user_id: userIdNum || null,
          button_type: 'personal_coupon',
          button_text: 'Enter Coupon',
          analytics_tag: trackId,
          url_clicked: url.toString(),
          utm_source: params.get('utm_source') || 'telegram',
          utm_medium: params.get('utm_medium') || 'gizebot',
          utm_campaign: params.get('utm_campaign') || 'targeted_personal',
          utm_content: params.get('utm_content') || trackId,
          clicked_at: new Date().toISOString(),
          metadata: { ip, ua }
        };

        // Insert only if channel_id is provided (schema requires NOT NULL in some projects)
        if (payload.channel_id) {
          await supabase.from('button_analytics').insert(payload);
        }
      }
    } catch (e) {
      console.log('⚠️ Failed to persist click to Supabase:', e?.message || e);
    }

    // Redirect
    res.writeHead(302, { Location: url.toString() });
    res.end();
  } catch (error) {
    console.error('❌ Redirect error:', error);
    res.status(500).json({ success: false, message: 'Redirect failed' });
  }
}

