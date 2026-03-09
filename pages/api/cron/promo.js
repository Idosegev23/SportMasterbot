// Vercel Cron: promotional messages at 10 AM, 2 PM, 6 PM (Ethiopia time) — Multi-Channel

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const authHeader = req.headers.authorization;
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    console.log('🎁 Cron: Executing scheduled promo for all channels...');

    const SportMasterScheduler = require('../../../lib/scheduler');
    const { getActiveChannels } = require('../../../lib/channel-config');
    const scheduler = new SportMasterScheduler();

    const ethiopianTime = new Date().toLocaleString('en-US', { timeZone: 'Africa/Addis_Ababa' });
    const currentHour = new Date(ethiopianTime).getHours();

    let promoType = 'special';
    if (currentHour >= 9 && currentHour < 12) promoType = 'morning';
    else if (currentHour >= 13 && currentHour < 17) promoType = 'afternoon';
    else if (currentHour >= 17 && currentHour < 21) promoType = 'evening';

    const channels = await getActiveChannels();
    const results = [];

    for (const ch of channels) {
      try {
        const result = await scheduler.executeManualPromo(promoType, ch);
        results.push({ channel: ch.channel_id, success: true, messageId: result.message_id });
        console.log(`✅ ${promoType} promo sent to ${ch.channel_id}`);
      } catch (err) {
        results.push({ channel: ch.channel_id, success: false, error: err.message });
        console.error(`❌ Promo failed for ${ch.channel_id}:`, err.message);
      }
    }

    res.status(200).json({
      success: true,
      message: `${promoType} promo sent to ${results.filter(r => r.success).length}/${channels.length} channels`,
      promoType,
      results,
      ethiopianTime,
      executedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Cron promo error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}
