// Manual News Endpoint - Send news on demand

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('📰 Manual news execution...');
    
    const TelegramManager = require('../../../lib/telegram');
    const telegram = new TelegramManager();
    
    // Fetch single detailed news article from RSS feeds
    const NewsFetcher = require('../../../lib/news-fetcher');
    const newsFetcher = new NewsFetcher();
    const newsData = await newsFetcher.fetchLatestNews(1);
    
    // Send news to channel
    const result = await telegram.sendNews(newsData.content, newsData.originalItem);
    
    console.log('✅ Manual news sent successfully');
    res.status(200).json({ 
      success: true, 
      message: 'News sent successfully',
      messageId: result.message_id,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Manual news error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to send news',
      error: error.message 
    });
  }
}