export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const authHeader = req.headers.authorization;
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    console.log('✈️ Cron: Aviator promo for all channels...');
    const ContentGenerator = require('../../../../lib/content-generator');
    const TelegramManager = require('../../../../lib/telegram');
    const { getActiveChannels } = require('../../../../lib/channel-config');

    const channels = await getActiveChannels();
    const results = [];

    for (const ch of channels) {
      try {
        const cg = new ContentGenerator({
          language: ch.language || 'en',
          timezone: ch.timezone || 'Africa/Addis_Ababa',
        });
        const telegram = new TelegramManager();
        const code = ch.coupon_code || 'SM100';
        const content = await cg.generateAviatorPromo(code);
        const result = await telegram.sendAviator(content, 'promo', code, ch);
        results.push({ channel: ch.channel_id, success: true, messageId: result?.message_id });
      } catch (err) {
        results.push({ channel: ch.channel_id, success: false, error: err.message });
        console.error(`❌ Aviator promo failed for ${ch.channel_id}:`, err.message);
      }
    }

    return res.status(200).json({
      success: true,
      message: `Aviator promo sent to ${results.filter(r => r.success).length}/${channels.length} channels`,
      results
    });
  } catch (error) {
    console.error('❌ Cron aviator promo error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}
