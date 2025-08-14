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

    // Get tracked matches (ones we sent predictions for)
    const fs = require('fs');
    const path = require('path');
    const trackedFilePath = path.join('/tmp', 'tracked-matches.json');
    let trackedMatches = {};
    
    if (fs.existsSync(trackedFilePath)) {
      try {
        trackedMatches = JSON.parse(fs.readFileSync(trackedFilePath, 'utf8'));
        console.log(`📋 Found ${Object.keys(trackedMatches).length} tracked matches from predictions`);
      } catch (e) {
        console.log('⚠️ Error reading tracked matches:', e.message);
      }
    }

    if (Object.keys(trackedMatches).length === 0) {
      return res.status(200).json({ success: true, message: "No tracked matches from predictions", action: 'skipped' });
    }

    // Get live matches and filter to only our tracked ones
    const allLiveMatches = await footballAPI.getLiveMatches();
    const ourLiveMatches = allLiveMatches.filter(match => {
      // Try to match by team names
      return Object.values(trackedMatches).some(tracked => 
        (tracked.homeTeam === match.homeTeam && tracked.awayTeam === match.awayTeam) ||
        (match.homeTeam.includes(tracked.homeTeam) || tracked.homeTeam.includes(match.homeTeam)) &&
        (match.awayTeam.includes(tracked.awayTeam) || tracked.awayTeam.includes(match.awayTeam))
      );
    });

    if (ourLiveMatches.length === 0) {
      return res.status(200).json({ 
        success: true, 
        message: "None of our predicted matches are currently live", 
        trackedCount: Object.keys(trackedMatches).length,
        allLiveCount: allLiveMatches.length,
        action: 'skipped' 
      });
    }

    console.log(`🎯 Found ${ourLiveMatches.length} of our predicted matches currently live`);
    const midGame = ourLiveMatches;

    const content = await contentGenerator.generateLiveStatus(midGame);
    const result = await telegram.sendLiveStatus(content, midGame);

    return res.status(200).json({
      success: true,
      message: `Live status sent for ${midGame.length} predicted match(es)`,
      liveCount: midGame.length,
      trackedCount: Object.keys(trackedMatches).length,
      ethiopianTime,
      result
    });
  } catch (error) {
    console.error('❌ Cron live-status error:', error);
    return res.status(500).json({ success: false, message: 'Failed to execute live status cron', error: error.message });
  }
}

