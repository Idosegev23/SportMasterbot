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
    
    // Simple news headlines - can be enhanced with RSS feeds later
    const headlines = [
      "🏆 Breaking: Latest Champions League results and upcoming fixtures",
      "⚽ Transfer Update: Major signings completed this week", 
      "🏅 International Football: Key matches and standings",
      "📊 Performance Analysis: Top players and team statistics",
      "🔥 Match Preview: Must-watch games coming up today"
    ];
    
    // Send news to channel
    await telegram.sendNews(headlines);
    
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