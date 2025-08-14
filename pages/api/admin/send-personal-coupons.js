// Admin API: send personal coupon to a list of users who clicked

export default async function handler(req, res) {
  const authHeader = req.headers.authorization;
  if (authHeader !== `Bearer ${process.env.ADMIN_SECRET}`) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  try {
    const { supabase } = require('../../../lib/supabase');
    const TelegramManager = require('../../../lib/telegram');
    const telegram = new TelegramManager();

    const { promoCode, messageText, since, tagPrefix = 'pc_' } = req.body || {};
    if (!promoCode) {
      return res.status(400).json({ success: false, message: 'Missing promoCode' });
    }

    if (!supabase) {
      return res.status(500).json({ success: false, message: 'Supabase not configured' });
    }

    // Build time window
    const sinceTs = since ? new Date(since).toISOString() : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    // Find users who clicked personal coupons (analytics_tag or utm_content starts with tagPrefix)
    const { data: clicks, error } = await supabase
      .from('button_analytics')
      .select('user_id, analytics_tag, utm_content')
      .gte('clicked_at', sinceTs)
      .not('user_id', 'is', null)
      .or(`analytics_tag.ilike.${tagPrefix}%,utm_content.ilike.${tagPrefix}%`)
      .limit(5000);

    if (error) {
      return res.status(500).json({ success: false, message: error.message });
    }

    const userIds = Array.from(new Set((clicks || []).map(c => c.user_id).filter(Boolean)));
    if (userIds.length === 0) {
      return res.status(200).json({ success: true, sent: 0, targets: [] });
    }

    const results = [];
    let couponUuid = null;
    try {
      // Try resolve coupon by affiliate_code == promoCode
      const { data: coupon } = await supabase
        .from('coupons')
        .select('id, affiliate_code')
        .eq('affiliate_code', promoCode)
        .maybeSingle();
      couponUuid = coupon?.id || null;
    } catch (_) {}
    for (const uid of userIds) {
      try {
        const r = await telegram.sendPersonalCouponToUser(uid, promoCode, messageText);
        results.push({ userId: uid, ok: true, messageId: r.message_id });
        // Log to user_coupons if couponUuid is available
        if (couponUuid) {
          try { await supabase.from('user_coupons').insert({ user_id: uid, coupon_uuid: couponUuid, sent_at: new Date().toISOString() }); } catch (_) {}
        }
        // Be nice to Telegram rate limits
        await new Promise(r => setTimeout(r, 600));
      } catch (e) {
        results.push({ userId: uid, ok: false, error: e.message });
      }
    }

    return res.status(200).json({ success: true, sent: results.filter(r => r.ok).length, targets: userIds.length, results });
  } catch (error) {
    console.error('❌ send-personal-coupons error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
}

