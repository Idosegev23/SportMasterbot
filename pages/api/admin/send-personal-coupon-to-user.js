// Send personal coupon to specific user

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  try {
    const TelegramManager = require('../../../lib/telegram');
    const { supabase } = require('../../../lib/supabase');
    
    const { userId, promoCode, text } = req.body || {};
    
    if (!userId || !promoCode) {
      return res.status(400).json({ success: false, message: 'Missing userId or promoCode' });
    }

    const telegram = new TelegramManager();

    // Send personal coupon
    const result = await telegram.sendPersonalCouponToUser(userId, promoCode, text);

    // Log to user_coupons if supabase available
    if (supabase) {
      try {
        // Try to resolve coupon by affiliate_code
        const { data: coupon } = await supabase
          .from('coupons')
          .select('id')
          .eq('affiliate_code', promoCode)
          .maybeSingle();

        if (coupon?.id) {
          await supabase.from('user_coupons').insert({
            user_id: userId,
            coupon_uuid: coupon.id,
            sent_at: new Date().toISOString()
          });
        }
      } catch (e) {
        console.log('⚠️ Failed to log coupon:', e.message);
      }
    }

    return res.status(200).json({ 
      success: true, 
      message: `✅ Coupon sent to user ${userId}`,
      messageId: result.message_id 
    });

  } catch (error) {
    console.error('❌ send-personal-coupon-to-user error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
}