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

    // get live matches
    const liveMatches = await footballAPI.getLiveMatches();

    // Optional filter: prioritize around 60' (45-75)
    const midGame = liveMatches.filter(m => typeof m.minute === 'number' && m.minute >= 45 && m.minute <= 75);
    const matchesForStatus = midGame.length > 0 ? midGame : liveMatches;

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

