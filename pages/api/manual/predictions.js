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

    // Try cached daily schedule first for consistency with cron
    const cached = await getDailySchedule();
    if (cached?.matches?.length) {
      matches = cached.matches;
      console.log('📋 Using cached daily schedule for consistency');
    } else if (bypassFilters) {
      matches = await footballAPI.getAllTodayMatchesRanked();
      console.log('🌍 Using all leagues as fallback');
    } else {
      matches = await footballAPI.getTodayMatches();
      console.log('⭐ Using popular leagues as fallback');
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

    // Find the next upcoming match (closest kickoff time)
    const now = new Date();
    const upcomingMatches = matches
      .filter(match => new Date(match.kickoffTime) > now)
      .sort((a, b) => new Date(a.kickoffTime) - new Date(b.kickoffTime));
    
    if (upcomingMatches.length === 0) {
      await releaseLock('predictions-run');
      return res.json({
        success: false,
        message: 'No upcoming matches found for predictions',
        matchCount: 0
      });
    }

    // Generate prediction for the next match only
    const nextMatch = upcomingMatches[0];
    const prediction = await contentGenerator.generateSingleMatchPrediction(nextMatch, 0, 1);

    // If dry-run, do NOT send to Telegram – just return the generated content
    if (dryRun) {
      await releaseLock('predictions-run');
      return res.json({
        success: true,
        dryRun: true,
        message: `Prediction generated for next match: ${nextMatch.homeTeam?.name || nextMatch.homeTeam} vs ${nextMatch.awayTeam?.name || nextMatch.awayTeam}`,
        preview: {
          items: [prediction],
          totalItems: 1,
          nextMatch: {
            homeTeam: nextMatch.homeTeam?.name || nextMatch.homeTeam,
            awayTeam: nextMatch.awayTeam?.name || nextMatch.awayTeam,
            kickoffTime: nextMatch.kickoffTime,
            competition: nextMatch.competition?.name || nextMatch.competition
          }
        },
        matchCount: 1,
        timestamp: new Date().toISOString(),
        ethiopianTime: new Date().toLocaleString('en-US', { timeZone: 'Africa/Addis_Ababa' })
      });
    }

    // Otherwise send to Telegram
    const result = await telegram.sendPredictions([prediction], [nextMatch]);
    
    // Track this match for live updates
    const fs = require('fs');
    const path = require('path');
    const trackedFilePath = path.join('/tmp', 'tracked-matches.json');
    let trackedMatches = {};
    
    if (fs.existsSync(trackedFilePath)) {
      try {
        trackedMatches = JSON.parse(fs.readFileSync(trackedFilePath, 'utf8'));
      } catch (e) {
        trackedMatches = {};
      }
    }
    
    const matchId = nextMatch.id || `${nextMatch.homeTeam?.name || nextMatch.homeTeam}_vs_${nextMatch.awayTeam?.name || nextMatch.awayTeam}`;
    trackedMatches[matchId] = {
      homeTeam: nextMatch.homeTeam?.name || nextMatch.homeTeam,
      awayTeam: nextMatch.awayTeam?.name || nextMatch.awayTeam,
      competition: nextMatch.competition?.name || nextMatch.competition,
      kickoffTime: nextMatch.kickoffTime,
      predictedDate: new Date().toISOString().split('T')[0]
    };
    fs.writeFileSync(trackedFilePath, JSON.stringify(trackedMatches), 'utf8');
    console.log(`📋 Tracking match for live updates: ${nextMatch.homeTeam?.name || nextMatch.homeTeam} vs ${nextMatch.awayTeam?.name || nextMatch.awayTeam}`);
    
    await markCooldown(cdKey);
    await releaseLock('predictions-run');

    res.json({
      success: true,
      message: `Prediction sent successfully for next match: ${nextMatch.homeTeam?.name || nextMatch.homeTeam} vs ${nextMatch.awayTeam?.name || nextMatch.awayTeam}`,
      result: {
        messageId: result?.message_id || null,
        matchCount: 1,
        nextMatch: {
          homeTeam: nextMatch.homeTeam?.name || nextMatch.homeTeam,
          awayTeam: nextMatch.awayTeam?.name || nextMatch.awayTeam,
          kickoffTime: nextMatch.kickoffTime,
          competition: nextMatch.competition?.name || nextMatch.competition
        }
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