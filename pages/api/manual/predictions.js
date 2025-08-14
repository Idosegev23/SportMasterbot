// Manual Predictions API - Simple version

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ 
      success: false, 
      message: 'Method not allowed. Use POST.' 
    });
  }

  try {
    const { acquireLock, releaseLock } = require('../../../lib/lock');
    const { isCooldownActive, markCooldown } = require('../../../lib/cooldown');
    const FootballAPI = require('../../../lib/football-api.js');
    const ContentGenerator = require('../../../lib/content-generator.js');
    const TelegramManager = require('../../../lib/telegram.js');

    // Support dry-run mode to avoid sending to Telegram
    // Accept from query (?dryRun=1) or JSON body { dryRun: true }
    const dryRun = Boolean(
      (req.query && (req.query.dryRun === '1' || req.query.dryRun === 'true')) ||
      (req.body && (req.body.dryRun === true || req.body.dryRun === 'true' || req.body.dryRun === 1))
    );

    const footballAPI = new FootballAPI();
    const { getDailySchedule } = require('../../../lib/storage');
    const contentGenerator = new ContentGenerator();
    const telegram = new TelegramManager();

    // Global cooldown to prevent channel flooding (e.g., 15 minutes)
    const COOLDOWN_MS = 15 * 60 * 1000;
    const cdKey = `predictions-global`;
    if (await isCooldownActive(cdKey, COOLDOWN_MS)) {
      return res.status(429).json({ success: false, message: 'Predictions cooldown active. Try again later.' });
    }

    // Acquire short-lived lock to avoid concurrent runs (e.g., 2 minutes)
    const lock = await acquireLock('predictions-run', 2 * 60 * 1000);
    if (!lock.acquired) {
      return res.status(423).json({ 
        success: false, 
        message: 'Predictions are already running. Please wait.',
        remainingMs: typeof lock.remainingMs === 'number' ? lock.remainingMs : undefined
      });
    }

    // Source selection: default popular leagues; allow bypass filters
    let matches;
    const bypassFilters = req.query.bypassFilters === '1' || req.query.source === 'all';

    // Try cached daily schedule first
    const cached = await getDailySchedule();
    if (cached?.matches?.length) {
      matches = cached.matches;
    } else if (bypassFilters) {
      matches = await footballAPI.getAllTodayMatchesRanked();
    } else {
      matches = await footballAPI.getTodayMatches();
    }
    
    if (matches.length === 0) {
      // Ensure we release the lock before returning when no matches
      await releaseLock('predictions-run');
      return res.json({
        success: false,
        message: 'No matches found for predictions',
        matchCount: 0
      });
    }

    // Generate predictions (using generateTop5Predictions)
    const predictions = await contentGenerator.generateTop5Predictions(matches);

    // If dry-run, do NOT send to Telegram – just return the generated content
    if (dryRun) {
      await releaseLock('predictions-run');
      return res.json({
        success: true,
        dryRun: true,
        message: `Predictions generated for ${matches.length} matches (not sent)`,
        preview: {
          items: Array.isArray(predictions) ? predictions.slice(0, 5) : [predictions],
          totalItems: Array.isArray(predictions) ? predictions.length : 1
        },
        matchCount: matches.length,
        timestamp: new Date().toISOString(),
        ethiopianTime: new Date().toLocaleString('en-US', { timeZone: 'Africa/Addis_Ababa' })
      });
    }

    // Otherwise send to Telegram
    const result = await telegram.sendPredictions(predictions, matches);
    await markCooldown(cdKey);
    await releaseLock('predictions-run');

    res.json({
      success: true,
      message: `Predictions sent successfully for ${matches.length} matches`,
      result: {
        messageId: result?.message_id || null,
        matchCount: matches.length
      },
      timestamp: new Date().toISOString(),
      ethiopianTime: new Date().toLocaleString('en-US', { timeZone: 'Africa/Addis_Ababa' }),
      channelInfo: { channelId: process.env.CHANNEL_ID, contentType: 'predictions', language: 'English' }
    });

  } catch (error) {
    console.error('❌ Predictions error:', error);
    try { await releaseLock('predictions-run'); } catch (_) {}
    res.status(500).json({
      success: false,
      message: 'Failed to send predictions',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
}