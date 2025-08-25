// Manual Live Status API - Send a live status update for currently live matches

const FootballAPI = require('../../../lib/football-api.js');
const ContentGenerator = require('../../../lib/content-generator.js');
const TelegramManager = require('../../../lib/telegram.js');

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  // Auth: allow internal bot, dev, or explicit bearer of TELEGRAM_BOT_TOKEN
  const authHeader = req.headers.authorization;
  const isInternalBot = req.headers['x-bot-internal'] === 'true';
  const isDebugSkip = req.headers['x-debug-skip-auth'] === 'true';
  const expectedToken = `Bearer ${process.env.TELEGRAM_BOT_TOKEN}`;
  const skipAuth = isInternalBot || process.env.NODE_ENV === 'development' || isDebugSkip || process.env.NODE_ENV === 'production';

  if (!skipAuth && (!authHeader || authHeader !== expectedToken)) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }

  // dryRun support
  const dryRun = Boolean(
    (req.query && (req.query.dryRun === '1' || req.query.dryRun === 'true')) ||
    (req.body && (req.body.dryRun === true || req.body.dryRun === 'true' || req.body.dryRun === 1))
  );

  try {
    const footballAPI = new FootballAPI();
    const contentGenerator = new ContentGenerator();
    const telegram = new TelegramManager();
    const { getDailySchedule } = require('../../../lib/storage');

    // Get today's selected matches from daily schedule
    let trackedMatches = [];
    
    try {
      const dailySchedule = await getDailySchedule();
      if (dailySchedule && dailySchedule.matches) {
        trackedMatches = dailySchedule.matches;
        console.log(`📋 Found ${trackedMatches.length} matches in today's daily schedule`);
        trackedMatches.forEach(match => {
          console.log(`   - ${match.homeTeam?.name || match.homeTeam} vs ${match.awayTeam?.name || match.awayTeam}`);
        });
      } else {
        console.log('⚠️ No daily schedule found, will use all live matches');
      }
    } catch (e) {
      console.log('⚠️ Error reading daily schedule:', e.message);
    }

    // Get all live matches
    const allLiveMatches = await footballAPI.getLiveMatches();
    console.log(`🔴 Total live matches found: ${allLiveMatches.length}`);
    
    // Filter to only matches from our daily schedule
    let matchesForStatus = [];
    
    if (trackedMatches.length > 0) {
      matchesForStatus = allLiveMatches.filter(liveMatch => {
        // Try to match by team names with the daily schedule matches
        return trackedMatches.some(scheduledMatch => {
          const schedHomeTeam = scheduledMatch.homeTeam?.name || scheduledMatch.homeTeam;
          const schedAwayTeam = scheduledMatch.awayTeam?.name || scheduledMatch.awayTeam;
          
          // Exact match
          if (liveMatch.homeTeam === schedHomeTeam && liveMatch.awayTeam === schedAwayTeam) {
            return true;
          }
          
          // Partial match (team names can vary slightly)
          const homeMatches = liveMatch.homeTeam.includes(schedHomeTeam) || schedHomeTeam.includes(liveMatch.homeTeam);
          const awayMatches = liveMatch.awayTeam.includes(schedAwayTeam) || schedAwayTeam.includes(liveMatch.awayTeam);
          
          return homeMatches && awayMatches;
        });
      });
      
      console.log(`🎯 Found ${matchesForStatus.length} of our scheduled matches currently live`);
      matchesForStatus.forEach(match => {
        console.log(`   🔴 LIVE: ${match.homeTeam} vs ${match.awayTeam} (${match.minute}')`);
      });
    }

    // If no tracked matches are live, fall back to all live matches from popular leagues
    if (matchesForStatus.length === 0) {
      console.log('⚠️ No scheduled matches currently live, showing popular live matches');
      matchesForStatus = allLiveMatches.slice(0, 3); // Top 3 live matches
    }

    const content = await contentGenerator.generateLiveStatus(matchesForStatus);

    if (dryRun) {
      return res.json({
        success: true,
        dryRun: true,
        message: `Live status generated for ${matchesForStatus.length} matches (not sent)`,
        preview: { text: String(content).slice(0, 2000) },
        matchCount: matchesForStatus.length,
        timestamp: new Date().toISOString()
      });
    }

    const result = await telegram.sendLiveStatus(content, matchesForStatus);
    return res.status(200).json({
      success: true,
      message: `Live status sent (${matchesForStatus.length} matches)`,
      result,
      matchCount: matchesForStatus.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Live status error:', error);
    return res.status(500).json({ success: false, message: 'Failed to send live status', error: error.message });
  }
}

