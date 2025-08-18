// 📰 Daily News Cron Job
export default async function handler(req, res) {
  // Security: Only allow cron calls
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    console.log('📰 Cron: Executing daily news...');
    
    const TelegramManager = require('../../../lib/telegram');
    const telegram = new TelegramManager();
    
    // Fetch single detailed news article from RSS feeds
    const NewsFetcher = require('../../../lib/news-fetcher');
    const newsFetcher = new NewsFetcher();
    const newsData = await newsFetcher.fetchLatestNews(1);
    
    // Send news to channel
    await telegram.sendNews(newsData.content, newsData.originalItem);
    
    console.log('✅ News sent successfully via cron');
    res.status(200).json({ 
      success: true, 
      message: 'Daily news sent successfully',
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Cron news error:', error);
    res.status(200).json({ 
      success: false, 
      message: 'News cron completed with errors',
      error: error.message 
    });
  }
}