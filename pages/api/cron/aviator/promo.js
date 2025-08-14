export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const authHeader = req.headers.authorization;
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    console.log('✈️ Cron: Aviator promo...');
    const ContentGenerator = require('../../../../lib/content-generator');
    const TelegramManager = require('../../../../lib/telegram');
    const { getEffectiveCoupon } = require('../../../../lib/settings-store');

    const contentGen = new ContentGenerator();
    const telegram = new TelegramManager();
    const coupon = await getEffectiveCoupon(true);
    const code = coupon?.code || 'SM100';

    const content = await contentGen.generateAviatorPromo(code);
    const result = await telegram.sendAviator(content, 'promo', code);

    return res.status(200).json({ success: true, type: 'aviator-promo', messageId: result?.message_id || null });
  } catch (error) {
    console.error('❌ Cron aviator promo error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}

