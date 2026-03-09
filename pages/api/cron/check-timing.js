// Check timing cron — runs every 30 minutes — Multi-Channel
// Sends individual predictions based on today's match schedule

const ContentGenerator = require('../../../lib/content-generator');
const TelegramManager = require('../../../lib/telegram');
const fs = require('fs');
const path = require('path');

let sentPredictionsToday = new Set();
let lastCheckDate = null;

function getSentPredictionsFilePath() {
  return path.join('/tmp', 'sent-predictions.json');
}

function loadSentPredictions() {
  try {
    const today = new Date().toISOString().split('T')[0];
    if (lastCheckDate !== today) { sentPredictionsToday.clear(); lastCheckDate = today; }
    if (fs.existsSync(getSentPredictionsFilePath())) {
      const data = JSON.parse(fs.readFileSync(getSentPredictionsFilePath(), 'utf8'));
      if (data.date === today) sentPredictionsToday = new Set(data.predictions);
    }
  } catch (_) {}
}

function saveSentPrediction(matchId, matchData = null) {
  try {
    const today = new Date().toISOString().split('T')[0];
    sentPredictionsToday.add(matchId);

    const trackedFilePath = path.join('/tmp', 'tracked-matches.json');
    let trackedMatches = {};
    if (fs.existsSync(trackedFilePath)) {
      try { trackedMatches = JSON.parse(fs.readFileSync(trackedFilePath, 'utf8')); } catch (_) {}
    }
    if (matchData) {
      trackedMatches[matchId] = {
        homeTeam: matchData.homeTeam?.name || matchData.homeTeam,
        awayTeam: matchData.awayTeam?.name || matchData.awayTeam,
        competition: matchData.competition?.name || matchData.competition,
        kickoffTime: matchData.kickoffTime,
        predictedDate: today
      };
      fs.writeFileSync(trackedFilePath, JSON.stringify(trackedMatches), 'utf8');
    }

    fs.writeFileSync(getSentPredictionsFilePath(), JSON.stringify({
      date: today, predictions: Array.from(sentPredictionsToday)
    }), 'utf8');
  } catch (_) {}
}

function hasPredictionBeenSent(matchId) { return sentPredictionsToday.has(matchId); }

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const authHeader = req.headers.authorization;
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    console.log('⏰ Checking if it\'s time to send predictions...');
    loadSentPredictions();

    // Load or calculate schedule
    let scheduleData;
    try {
      const { getDailySchedule } = require('../../../lib/storage');
      const cached = await getDailySchedule();
      let matches;
      if (cached?.matches?.length) {
        matches = cached.matches;
      } else {
        const FootballAPI = require('../../../lib/football-api');
        matches = await new FootballAPI().getAllTodayMatchesRanked();
      }
      if (matches.length === 0) {
        return res.status(200).json({ success: true, message: 'No matches today', action: 'skipped' });
      }

      const predictionTimes = matches.map((match, index) => {
        const kickoffTime = new Date(match.kickoffTime);
        return {
          matchId: match.fixtureId || match.id || `match-${index}`,
          match,
          homeTeam: match.homeTeam?.name || match.homeTeam,
          awayTeam: match.awayTeam?.name || match.awayTeam,
          kickoffTime: kickoffTime.toISOString(),
          predictionTime: new Date(kickoffTime.getTime() - 2.5 * 3600000).toISOString(),
          league: match.competition?.name || match.competition
        };
      });

      scheduleData = {
        date: new Date().toISOString().split('T')[0],
        matches, predictionTimes,
        calculatedAt: new Date().toISOString()
      };
    } catch (error) {
      return res.status(200).json({ success: true, message: 'Error calculating schedule', action: 'skipped' });
    }

    const today = new Date().toISOString().split('T')[0];
    if (scheduleData.date !== today) {
      return res.status(200).json({ success: true, message: 'Schedule outdated', action: 'skipped' });
    }

    const now = new Date();
    const ethiopianTime = new Date().toLocaleString('en-US', { timeZone: 'Africa/Addis_Ababa' });
    const currentHour = new Date(ethiopianTime).getHours();
    if (currentHour < 7 || currentHour > 22) {
      return res.status(200).json({ success: true, message: 'Outside active hours', action: 'skipped' });
    }

    // Find matches needing predictions
    const matchesNeeding = scheduleData.predictionTimes.filter(t => {
      const diff = (new Date(t.predictionTime).getTime() - now.getTime()) / 60000;
      return diff >= -15 && diff <= 15 && !hasPredictionBeenSent(t.matchId);
    });

    if (matchesNeeding.length === 0) {
      const next = scheduleData.predictionTimes.find(t =>
        new Date(t.predictionTime).getTime() > now.getTime() && !hasPredictionBeenSent(t.matchId)
      );
      return res.status(200).json({
        success: true, message: 'No predictions needed now',
        nextPrediction: next ? {
          match: `${next.homeTeam} vs ${next.awayTeam}`,
          predictionTime: next.predictionTime,
          minutesUntil: Math.round((new Date(next.predictionTime) - now) / 60000)
        } : null,
        sentToday: sentPredictionsToday.size,
        action: 'waiting'
      });
    }

    // Process first match only
    const matchToPredict = matchesNeeding[0];
    console.log(`📝 Sending prediction for: ${matchToPredict.homeTeam} vs ${matchToPredict.awayTeam}`);

    // Cooldown + lock
    const { acquireLock, releaseLock } = require('../../../lib/lock');
    const { isCooldownActive, markCooldown } = require('../../../lib/cooldown');
    const cdKey = 'cron-individual-prediction';
    if (await isCooldownActive(cdKey, 10 * 60 * 1000)) {
      return res.status(200).json({ success: true, message: 'Cooldown active', action: 'cooldown' });
    }
    const lock = await acquireLock('cron-individual-prediction', 2 * 60 * 1000);
    if (!lock.acquired) {
      return res.status(200).json({ success: true, message: 'Lock held', action: 'locked' });
    }

    // Send to ALL active channels
    const { getActiveChannels } = require('../../../lib/channel-config');
    const channels = await getActiveChannels();
    const telegram = new TelegramManager();
    const channelResults = [];

    for (const ch of channels) {
      try {
        const cg = new ContentGenerator({
          language: ch.language || 'en',
          timezone: ch.timezone || 'Africa/Addis_Ababa',
        });
        const promoCode = ch.coupon_code || 'SM100';
        const content = await cg.generateSingleMatchPrediction(matchToPredict.match, 1, 1, promoCode);
        await telegram.sendPredictions(content, [matchToPredict.match], ch);
        channelResults.push({ channel: ch.channel_id, success: true });
      } catch (err) {
        channelResults.push({ channel: ch.channel_id, success: false, error: err.message });
      }
    }

    await markCooldown(cdKey);
    saveSentPrediction(matchToPredict.matchId, matchToPredict.match);
    await releaseLock('cron-individual-prediction');

    res.status(200).json({
      success: true,
      message: `Prediction sent for ${matchToPredict.homeTeam} vs ${matchToPredict.awayTeam}`,
      channelResults,
      matchId: matchToPredict.matchId,
      sentToday: sentPredictionsToday.size,
      pendingMatches: matchesNeeding.length - 1,
      ethiopianTime,
      action: 'sent'
    });
  } catch (error) {
    console.error('❌ Check timing error:', error);
    try { const { releaseLock } = require('../../../lib/lock'); await releaseLock('cron-individual-prediction'); } catch (_) {}
    res.status(500).json({ success: false, error: error.message, action: 'error' });
  }
}
