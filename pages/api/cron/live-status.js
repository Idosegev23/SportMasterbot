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

    // Filter to only games we predicted/tracked today
    try {
      const { getDailySchedule } = require('../../../lib/storage');
      const sched = await getDailySchedule();
      if (sched && Array.isArray(sched.matches) && sched.matches.length) {
        const predictedPairs = new Set(
          sched.matches.map(x => `${(x.homeTeam?.name||x.homeTeam||'').toLowerCase()}__${(x.awayTeam?.name||x.awayTeam||'').toLowerCase()}`)
        );
        midGame = midGame.filter(g => predictedPairs.has(`${String(g.homeTeam).toLowerCase()}__${String(g.awayTeam).toLowerCase()}`));
      }
    } catch (_) {}
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