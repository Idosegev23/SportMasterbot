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

    // Daily limit check to prevent spam
    const fs = require('fs');
    const path = require('path');
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const dailyCountFile = path.join('/tmp', `live-updates-${today}.txt`);
    
    let dailyCount = 0;
    if (fs.existsSync(dailyCountFile)) {
      try {
        dailyCount = parseInt(fs.readFileSync(dailyCountFile, 'utf8')) || 0;
      } catch (e) {
        dailyCount = 0;
      }
    }
    
    // Max 10 live updates per day to prevent spam
    if (dailyCount >= 10) {
      return res.status(200).json({ 
        success: true, 
        message: 'Daily live update limit reached (10)', 
        dailyCount, 
        action: 'skipped-daily-limit' 
      });
    }

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
        .eq('type', 'prediction')
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Extract match info from metadata
      posts.forEach(post => {
        if (post.metadata && post.metadata.homeTeam && post.metadata.awayTeam) {
          const matchKey = `${post.metadata.homeTeam}_vs_${post.metadata.awayTeam}`;
          trackedMatches[matchKey] = {
            homeTeam: post.metadata.homeTeam,
            awayTeam: post.metadata.awayTeam,
            matchId: post.metadata.matchId,
            sentAt: post.created_at,
            messageId: post.message_id
          };
        }
      });

      console.log(`📋 Found ${Object.keys(trackedMatches).length} tracked matches from predictions in last 24h`);
    } catch (e) {
      console.log('⚠️ Error reading tracked matches from Supabase:', e.message);
      return res.status(200).json({ success: true, message: "Error reading tracked matches", action: 'skipped' });
    }

    if (Object.keys(trackedMatches).length === 0) {
      return res.status(200).json({ success: true, message: "No tracked matches from predictions in last 24h", action: 'skipped' });
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
    
    // Check if there's SIGNIFICANT change since last update (goals, red cards, major status change)
    const { createHash } = require('crypto');
    const getSignificantState = (matches) => {
      return matches.map(m => {
        // Only track significant events and score changes
        const significantEvents = m.events ? m.events.filter(e => 
          e.type === 'Goal' || (e.type === 'Card' && e.detail === 'Red Card')
        ) : [];
        
        return {
          id: m.fixtureId,
          homeScore: m.homeScore,
          awayScore: m.awayScore,
          // Only track major minute milestones to reduce noise
          minuteBracket: Math.floor((m.minute || 0) / 15) * 15, // 0, 15, 30, 45, 60, 75, 90
          status: m.status,
          significantEvents: significantEvents.map(e => `${e.type}_${e.minute}_${e.player}`),
          // Track if match just started or ended
          isStarting: m.minute <= 5,
          isEnding: m.minute >= 85
        };
      });
    };
    
    const currentMatchState = JSON.stringify(getSignificantState(ourLiveMatches));
    const currentHash = createHash('md5').update(currentMatchState).digest('hex');
    
    // Store last hash in temp file
    const hashFilePath = path.join('/tmp', 'last-live-state.txt');
    
    let lastHash = '';
    if (fs.existsSync(hashFilePath)) {
      try {
        lastHash = fs.readFileSync(hashFilePath, 'utf8');
      } catch (e) {
        // ignore
      }
    }
    
    // Only send update if state changed significantly
    if (currentHash === lastHash) {
      return res.status(200).json({
        success: true,
        message: "No significant changes in live matches, skipping update",
        liveCount: ourLiveMatches.length,
        trackedCount: Object.keys(trackedMatches).length,
        action: 'skipped-no-change'
      });
    }
    
    // Additional check: only send if there are actual significant events to report
    const hasSignificantContent = ourLiveMatches.some(m => {
      // Has goals, red cards, or just started/ending
      const hasImportantEvents = m.events && m.events.some(e => 
        e.type === 'Goal' || (e.type === 'Card' && e.detail === 'Red Card')
      );
      const isKeyMoment = m.minute <= 5 || m.minute >= 85 || m.minute === 45 || m.minute === 90; // Kickoff, final minutes, halftime, fulltime
      const hasScoreChange = (m.homeScore || 0) > 0 || (m.awayScore || 0) > 0;
      const isTacticalMoment = m.minute === 30 || m.minute === 60; // Mid-half tactical analysis moments
      
      return hasImportantEvents || isKeyMoment || hasScoreChange || isTacticalMoment;
    });
    
    if (!hasSignificantContent) {
      return res.status(200).json({
        success: true,
        message: "No significant events to report, skipping update",
        liveCount: ourLiveMatches.length,
        trackedCount: Object.keys(trackedMatches).length,
        action: 'skipped-no-events'
      });
    }
    
    const midGame = ourLiveMatches;
    const content = await contentGenerator.generateLiveStatus(midGame);
    const result = await telegram.sendLiveStatus(content, midGame);
    
    // Save current state
    fs.writeFileSync(hashFilePath, currentHash, 'utf8');
    
    // Update daily counter
    dailyCount++;
    fs.writeFileSync(dailyCountFile, dailyCount.toString(), 'utf8');
    
    return res.status(200).json({
      success: true,
      message: `Live status sent for ${midGame.length} predicted match(es) (${dailyCount}/10 today)`,
      liveCount: midGame.length,
      trackedCount: Object.keys(trackedMatches).length,
      dailyCount,
      ethiopianTime,
      result,
      stateChanged: true
    });
  } catch (error) {
    console.error('❌ Cron live-status error:', error);
    return res.status(500).json({ success: false, message: 'Failed to execute live status cron', error: error.message });
  }
}

