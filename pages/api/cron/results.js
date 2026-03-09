// Vercel Cron: daily results at 11 PM (Ethiopia time) — Multi-Channel

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const authHeader = req.headers.authorization;
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    console.log('🕚 Cron: Executing daily results for all channels...');

    const SportMasterScheduler = require('../../../lib/scheduler');
    const { getActiveChannels } = require('../../../lib/channel-config');
    const scheduler = new SportMasterScheduler();

    const channels = await getActiveChannels();
    const results = [];

    for (const ch of channels) {
      try {
        const result = await scheduler.executeManualResults(ch);
        results.push({ channel: ch.channel_id, success: true, messageId: result.messageId });
        console.log(`✅ Results sent to ${ch.channel_id}`);
      } catch (err) {
        results.push({ channel: ch.channel_id, success: false, error: err.message });
        console.error(`❌ Results failed for ${ch.channel_id}:`, err.message);
      }
    }

    res.status(200).json({
      success: true,
      message: `Results sent to ${results.filter(r => r.success).length}/${channels.length} channels`,
      results,
      ethiopianTime: new Date().toLocaleString('en-US', { timeZone: 'Africa/Addis_Ababa' }),
      executedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Cron results error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}
