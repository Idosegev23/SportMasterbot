// Cron: Live Status around 60' minute

const FootballAPI = require('../../../lib/football-api');
const ContentGenerator = require('../../../lib/content-generator');
const TelegramManager = require('../../../lib/telegram');

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const authHeader = req.headers.authorization;
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    // Ethiopian time gating: only between 14:00-23:00 to catch most leagues
    const ethiopianTime = new Date().toLocaleString('en-US', { timeZone: 'Africa/Addis_Ababa' });
    const currentHour = new Date(ethiopianTime).getHours();
    if (currentHour < 12 || currentHour > 23) {
      return res.status(200).json({ success: true, message: 'Outside live status window', hour: currentHour, action: 'skipped' });
    }

    const footballAPI = new FootballAPI();
    const contentGenerator = new ContentGenerator();
    const telegram = new TelegramManager();

    const liveMatches = await footballAPI.getLiveMatches();
    // Focus around 60' (45-75)
    let midGame = liveMatches.filter(m => typeof m.minute === 'number' && m.minute >= 45 && m.minute <= 75);

    // Filter to only games we predicted/tracked today from Supabase
    try {
      const { supabase } = require('../../../lib/supabase');
      if (supabase) {
        // Get matches from last 24 hours that we sent predictions for
        const { data: posts, error } = await supabase
          .from('telegram_posts')
          .select('metadata')
          .eq('type', 'prediction')
          .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

        if (!error && posts && posts.length > 0) {
          const predictedPairs = new Set();
          posts.forEach(post => {
            if (post.metadata && post.metadata.matches) {
              post.metadata.matches.forEach(match => {
                if (match.homeTeam && match.awayTeam) {
                  predictedPairs.add(`${match.homeTeam.toLowerCase()}__${match.awayTeam.toLowerCase()}`);
                }
              });
            }
          });
          
          if (predictedPairs.size > 0) {
            console.log(`📋 Found ${predictedPairs.size} predicted matches in last 24h`);
            midGame = midGame.filter(g => predictedPairs.has(`${String(g.homeTeam).toLowerCase()}__${String(g.awayTeam).toLowerCase()}`));
            console.log(`🎯 Filtered to ${midGame.length} live matches that we predicted`);
          }
        }
      }
    } catch (e) {
      console.log('⚠️ Error reading predicted matches from Supabase:', e.message);
    }
    if (midGame.length === 0) {
      return res.status(200).json({ success: true, message: "No predicted mid-game matches (45-75')", liveCount: liveMatches.length, action: 'skipped' });
    }

    const content = await contentGenerator.generateLiveStatus(midGame);
    const result = await telegram.sendLiveStatus(content, midGame);

    return res.status(200).json({
      success: true,
      message: `Live status sent (${midGame.length} matches around 60')`,
      liveCount: midGame.length,
      ethiopianTime,
      result
    });
  } catch (error) {
    console.error('❌ Cron live-status error:', error);
    return res.status(500).json({ success: false, message: 'Failed to execute live status cron', error: error.message });
  }
}