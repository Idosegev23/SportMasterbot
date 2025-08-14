// Check timing cron - runs every 30 minutes
// Checks if it's time to send individual predictions based on today's match schedule

const ContentGenerator = require('../../../lib/content-generator');
const TelegramManager = require('../../../lib/telegram');
const fs = require('fs');
const path = require('path');

// Memory-based tracking for Vercel serverless (resets every cold start)
let sentPredictionsToday = new Set();
let lastCheckDate = null;

// Helper functions for tracking sent predictions
function getSentPredictionsFilePath() {
  return path.join('/tmp', 'sent-predictions.json');
}

function loadSentPredictions() {
  try {
    const today = new Date().toISOString().split('T')[0];
    
    // Reset if it's a new day
    if (lastCheckDate !== today) {
      sentPredictionsToday.clear();
      lastCheckDate = today;
    }
    
    if (fs.existsSync(getSentPredictionsFilePath())) {
      const data = JSON.parse(fs.readFileSync(getSentPredictionsFilePath(), 'utf8'));
      if (data.date === today) {
        sentPredictionsToday = new Set(data.predictions);
      }
    }
  } catch (error) {
    console.log('⚠️ Error loading sent predictions:', error.message);
  }
}

function saveSentPrediction(matchId, matchData = null) {
  try {
    const today = new Date().toISOString().split('T')[0];
    sentPredictionsToday.add(matchId);
    
    // Also save tracked matches for live updates
    const trackedFilePath = path.join('/tmp', 'tracked-matches.json');
    let trackedMatches = {};
    
    if (fs.existsSync(trackedFilePath)) {
      try {
        trackedMatches = JSON.parse(fs.readFileSync(trackedFilePath, 'utf8'));
      } catch (e) {
        trackedMatches = {};
      }
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
      console.log(`📋 Tracking match for live updates: ${matchData.homeTeam?.name || matchData.homeTeam} vs ${matchData.awayTeam?.name || matchData.awayTeam}`);
    }
    
    const data = {
      date: today,
      predictions: Array.from(sentPredictionsToday)
    };
    
    fs.writeFileSync(getSentPredictionsFilePath(), JSON.stringify(data), 'utf8');
  } catch (error) {
    console.log('⚠️ Error saving sent prediction:', error.message);
  }
}

function hasPredictionBeenSent(matchId) {
  return sentPredictionsToday.has(matchId);
}

export default async function handler(req, res) {
  // Only allow GET requests from Vercel Cron
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Verify this is a legitimate cron request
  const authHeader = req.headers.authorization;
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    console.log('⏰ Checking if it\'s time to send predictions...');
    
    // Load sent predictions tracking
    loadSentPredictions();
    
    // Prefer cached daily schedule; fallback to live calculation
    let scheduleData;
    try {
      const { getDailySchedule } = require('../../../lib/storage');
      const cached = await getDailySchedule();
      let matches;
      if (cached?.matches?.length) {
        console.log('📁 Using cached daily schedule');
        matches = cached.matches;
      } else {
        const FootballAPI = require('../../../lib/football-api');
        const footballAPI = new FootballAPI();
        console.log('📅 Calculating live schedule...');
        matches = await footballAPI.getAllTodayMatchesRanked();
      }
      
      if (matches.length === 0) {
        console.log('⚠️ No matches found for today');
        return res.status(200).json({
          success: true,
          message: 'No matches found for today',
          action: 'skipped'
        });
      }

      // Calculate prediction times for each match
      const predictionTimes = matches.map((match, index) => {
        const kickoffTime = new Date(match.kickoffTime);
        const predictionTime = new Date(kickoffTime.getTime() - (2.5 * 60 * 60 * 1000)); // 2.5 hours before
        
        return {
          matchId: match.fixtureId || match.id || `match-${index}`,
          match: match, // Store full match data
          homeTeam: match.homeTeam?.name || match.homeTeam,
          awayTeam: match.awayTeam?.name || match.awayTeam,
          kickoffTime: kickoffTime.toISOString(),
          predictionTime: predictionTime.toISOString(),
          league: match.competition?.name || match.competition
        };
      });

      scheduleData = {
        date: new Date().toISOString().split('T')[0],
        matches: matches,
        predictionTimes: predictionTimes,
        calculatedAt: new Date().toISOString()
      };
      
      console.log(`📊 Live schedule calculated: ${matches.length} matches, ${predictionTimes.length} prediction times`);
      
    } catch (error) {
      console.log('⚠️ Error calculating live schedule:', error.message);
      return res.status(200).json({
        success: true,
        message: 'Error calculating schedule, skipping timing check',
        action: 'skipped'
      });
    }

    // Check if schedule is for today
    const today = new Date().toISOString().split('T')[0];
    if (scheduleData.date !== today) {
      console.log('⚠️ Schedule is not for today, skipping');
      return res.status(200).json({
        success: true,
        message: 'Schedule is outdated, waiting for new daily setup',
        scheduleDate: scheduleData.date,
        currentDate: today,
        action: 'skipped'
      });
    }

    const now = new Date();
    const ethiopianTime = new Date().toLocaleString("en-US", {timeZone: "Africa/Addis_Ababa"});
    const currentHour = new Date(ethiopianTime).getHours();

    // Only run during active hours (7 AM - 10 PM Ethiopian time)
    if (currentHour < 7 || currentHour > 22) {
      return res.status(200).json({
        success: true,
        message: 'Outside active hours, skipping check',
        currentHour: currentHour,
        ethiopianTime: ethiopianTime,
        action: 'skipped'
      });
    }

    // Check if any matches need predictions now (and haven't been sent yet)
    const matchesNeedingPredictions = scheduleData.predictionTimes.filter(timing => {
      const predictionTime = new Date(timing.predictionTime);
      const timeDiff = predictionTime.getTime() - now.getTime();
      const minutesDiff = timeDiff / (1000 * 60);
      
      // Send predictions if we're within 15 minutes of the optimal time AND not already sent
      const isTimeToSend = minutesDiff >= -15 && minutesDiff <= 15;
      const notAlreadySent = !hasPredictionBeenSent(timing.matchId);
      
      return isTimeToSend && notAlreadySent;
    });

    if (matchesNeedingPredictions.length === 0) {
      const nextPrediction = scheduleData.predictionTimes.find(timing => {
        const predictionTime = new Date(timing.predictionTime);
        return predictionTime.getTime() > now.getTime() && !hasPredictionBeenSent(timing.matchId);
      });

      return res.status(200).json({
        success: true,
        message: 'No predictions needed right now',
        nextPrediction: nextPrediction ? {
          match: `${nextPrediction.homeTeam} vs ${nextPrediction.awayTeam}`,
          predictionTime: nextPrediction.predictionTime,
          minutesUntil: Math.round((new Date(nextPrediction.predictionTime).getTime() - now.getTime()) / (1000 * 60))
        } : null,
        sentToday: Array.from(sentPredictionsToday).length,
        ethiopianTime: ethiopianTime,
        action: 'waiting'
      });
    }

    // We have matches that need predictions - send them ONE BY ONE!
    console.log(`🎯 Found ${matchesNeedingPredictions.length} matches ready for individual predictions`);
    
    // Process only the FIRST match to avoid sending multiple at once
    const matchToPredict = matchesNeedingPredictions[0];
    console.log(`📝 Sending prediction for: ${matchToPredict.homeTeam} vs ${matchToPredict.awayTeam}`);

    // Load settings for website URL and promo codes
    let settings;
    try {
      const { systemSettings } = await import('../settings');
      settings = systemSettings;
    } catch (error) {
      console.log('⚠️ Using default settings');
      settings = {
        websiteUrl: '',
        promoCodes: ['SM100'],
        autoPosting: { dynamicTiming: true }
      };
    }

    // Initialize content generator and telegram
    const contentGenerator = new ContentGenerator(settings.websiteUrl);
    const telegram = new TelegramManager();

    // Generate and send single match prediction
    // Cooldown and lock to avoid repeated sends within short window
    const { acquireLock, releaseLock } = require('../../../lib/lock');
    const { isCooldownActive, markCooldown } = require('../../../lib/cooldown');
    const cronCdKey = 'cron-individual-prediction';
    if (await isCooldownActive(cronCdKey, 10 * 60 * 1000)) {
      return res.status(200).json({ success: true, message: 'Cooldown active. Skipping this run.', action: 'cooldown' });
    }
    const lock = await acquireLock('cron-individual-prediction', 2 * 60 * 1000);
    if (!lock.acquired) {
      return res.status(200).json({ success: true, message: 'Another cron run in progress. Skipping.', action: 'locked' });
    }
    const randomPromoCode = settings.promoCodes[Math.floor(Math.random() * settings.promoCodes.length)];
    const content = await contentGenerator.generateSingleMatchPrediction(
      matchToPredict.match, 
      1, 
      1, 
      randomPromoCode
    );
    
    // Send individual prediction for this specific match
    const message = await telegram.sendPredictions(content, [matchToPredict.match]);
    await markCooldown(cronCdKey);

    // Mark this prediction as sent and track for live updates
    saveSentPrediction(matchToPredict.matchId, matchToPredict.match);

    console.log('✅ Individual match prediction sent successfully');
    await releaseLock('cron-individual-prediction');

    res.status(200).json({
      success: true,
      message: 'Individual prediction sent successfully',
      matchCovered: `${matchToPredict.homeTeam} vs ${matchToPredict.awayTeam}`,
      predictionTime: matchToPredict.predictionTime,
      kickoffTime: matchToPredict.kickoffTime,
      matchId: matchToPredict.matchId,
      messageId: message.message_id,
      promoCode: randomPromoCode,
      totalSentToday: Array.from(sentPredictionsToday).length,
      pendingMatches: matchesNeedingPredictions.length - 1,
      ethiopianTime: ethiopianTime,
      executedAt: new Date().toISOString(),
      action: 'sent'
    });

  } catch (error) {
    console.error('❌ Check timing error:', error);
    try {
      const { releaseLock } = require('../../../lib/lock');
      await releaseLock('cron-individual-prediction');
    } catch (_) {}
    
    res.status(500).json({
      success: false,
      message: 'Failed to check timing and send predictions',
      error: error.message,
      ethiopianTime: new Date().toLocaleString("en-US", {timeZone: "Africa/Addis_Ababa"}),
      executedAt: new Date().toISOString(),
      action: 'error'
    });
  }
}