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

    // Get tracked matches from Supabase (ones we sent predictions for)
    const { supabase } = require('../../../lib/supabase');
    let trackedMatches = {};
    
    try {
      // Get matches from last 24 hours that we sent predictions for
      const { data: posts, error } = await supabase
        .from('telegram_posts')
        .select('*')
        .eq('type', 'predictions')
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Extract match info from metadata
      posts.forEach(post => {
        if (post.metadata && post.metadata.homeTeam && post.metadata.awayTeam) {
          const matchKey = `${post.metadata.homeTeam}_vs_${post.metadata.awayTeam}`;
          trackedMatches[matchKey] = post.metadata;
        }
      });

      console.log(`📋 Found ${Object.keys(trackedMatches).length} tracked matches from predictions in last 24h`);
    } catch (e) {
      console.log('⚠️ Error reading tracked matches from Supabase:', e.message);
    }

    // Get all live matches and filter to only our tracked ones
    const allLiveMatches = await footballAPI.getLiveMatches();
    let matchesForStatus = allLiveMatches.filter(match => {
      // Try to match by team names
      return Object.values(trackedMatches).some(tracked => 
        (tracked.homeTeam === match.homeTeam && tracked.awayTeam === match.awayTeam) ||
        (match.homeTeam.includes(tracked.homeTeam) || tracked.homeTeam.includes(match.homeTeam)) &&
        (match.awayTeam.includes(tracked.awayTeam) || tracked.awayTeam.includes(match.awayTeam))
      );
    });

    // If no tracked matches are live, fall back to all live matches
    if (matchesForStatus.length === 0) {
      console.log('⚠️ No tracked matches currently live, showing all live matches');
      matchesForStatus = allLiveMatches;
    } else {
      console.log(`🎯 Found ${matchesForStatus.length} of our predicted matches currently live`);
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

