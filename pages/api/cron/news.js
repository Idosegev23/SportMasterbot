// 📰 Daily News Cron — Multi-Channel

export default async function handler(req, res) {
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    console.log('📰 Cron: Executing daily news for all channels...');

    const TelegramManager = require('../../../lib/telegram');
    const { getActiveChannels } = require('../../../lib/channel-config');
    const telegram = new TelegramManager();

    const NewsFetcher = require('../../../lib/news-fetcher');
    const newsFetcher = new NewsFetcher();
    const newsData = await newsFetcher.fetchLatestNews(1);

    const channels = await getActiveChannels();
    const results = [];

    for (const ch of channels) {
      try {
        await telegram.sendNews(newsData.content, newsData.originalItem, ch);
        results.push({ channel: ch.channel_id, success: true });
        console.log(`✅ News sent to ${ch.channel_id}`);
      } catch (err) {
        results.push({ channel: ch.channel_id, success: false, error: err.message });
        console.error(`❌ News failed for ${ch.channel_id}:`, err.message);
      }
    }

    res.status(200).json({
      success: true,
      message: `News sent to ${results.filter(r => r.success).length}/${channels.length} channels`,
      results,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Cron news error:', error);
    res.status(200).json({ success: false, error: error.message });
  }
}
