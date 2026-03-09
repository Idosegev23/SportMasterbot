// Manual predictions endpoint — Multi-Channel
// Automated scheduling handled by daily-setup.js + check-timing.js

const FootballAPI = require('../../../lib/football-api');
const ContentGenerator = require('../../../lib/content-generator');
const TelegramManager = require('../../../lib/telegram');

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const isManualTest = req.method === 'POST' || !req.headers.authorization;
  if (!isManualTest) {
    const authHeader = req.headers.authorization;
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }

  try {
    console.log('🎯 Manual predictions trigger (all channels)...');

    const { getActiveChannels } = require('../../../lib/channel-config');
    const channels = await getActiveChannels();

    let settings;
    try {
      const { systemSettings } = await import('../settings');
      settings = systemSettings;
    } catch (_) {
      settings = { websiteUrl: '', promoCodes: ['SM100'], autoPosting: { dynamicTiming: true } };
    }

    const footballAPI = new FootballAPI();
    const telegram = new TelegramManager();
    const results = [];

    for (const ch of channels) {
      try {
        const leagues = ch.leagues || [];
        let matches;
        try {
          matches = await footballAPI.getEnhancedTop5Matches(leagues);
        } catch (_) {
          matches = await footballAPI.getTodayMatches(leagues);
        }
        if (matches.length === 0) {
          results.push({ channel: ch.channel_id, success: true, matchCount: 0 });
          continue;
        }

        const cg = new ContentGenerator({
          language: ch.language || 'en',
          timezone: ch.timezone || 'Africa/Addis_Ababa',
          websiteUrl: settings.websiteUrl,
        });

        const promoCode = ch.coupon_code || 'SM100';
        const content = await cg.generateTop5Predictions(matches, promoCode);
        const message = await telegram.sendPredictions(content, matches, ch);

        results.push({ channel: ch.channel_id, success: true, matchCount: matches.length, messageIds: message.messageIds });
        console.log(`✅ Predictions sent to ${ch.channel_id}`);
      } catch (err) {
        results.push({ channel: ch.channel_id, success: false, error: err.message });
        console.error(`❌ Predictions failed for ${ch.channel_id}:`, err.message);
      }
    }

    res.status(200).json({
      success: true,
      message: `Predictions sent to ${results.filter(r => r.success).length}/${channels.length} channels`,
      results,
      ethiopianTime: new Date().toLocaleString('en-US', { timeZone: 'Africa/Addis_Ababa' }),
      executedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Manual predictions error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}
