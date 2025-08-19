// Cron: Live Status around 60' minute

const FootballAPI = require('../../../lib/football-api');
const ContentGenerator = require('../../../lib/content-generator');
const TelegramManager = require('../../../lib/telegram');

// Memory for last sent live updates to prevent spam
let lastLiveUpdates = new Map(); // matchId -> { score, minute, lastUpdate }

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

    // Filter to only games we predicted/tracked today from Supabase
    try {
      const { supabase } = require('../../../lib/supabase');
      console.log('🔍 Supabase connection status:', supabase ? 'Connected' : 'Not connected');
      if (supabase) {
        console.log('🔍 Querying Supabase for predictions...');
        // Get matches from last 24 hours that we sent predictions for
        const { data: posts, error } = await supabase
          .from('telegram_posts')
          .select('*')
          .eq('type', 'predictions')
          .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());
        
        console.log(`🔍 Supabase query result: ${posts?.length || 0} posts found, error:`, error?.message || 'none');

        if (!error && posts && posts.length > 0) {
          console.log('🔍 Sample post structure:', JSON.stringify(posts[0], null, 2));
          const predictedPairs = new Set();
          posts.forEach(post => {
            if (post.metadata) {
              // Check if it's a single match metadata (new format)
              if (post.metadata.homeTeam && post.metadata.awayTeam) {
                predictedPairs.add(`${post.metadata.homeTeam.toLowerCase()}__${post.metadata.awayTeam.toLowerCase()}`);
              }
              // Check if it's an array of matches (old format)
              else if (post.metadata.matches) {
                post.metadata.matches.forEach(match => {
                  if (match.homeTeam && match.awayTeam) {
                    predictedPairs.add(`${match.homeTeam.toLowerCase()}__${match.awayTeam.toLowerCase()}`);
                  }
                });
              }
            }
          });
          
          if (predictedPairs.size > 0) {
            console.log(`📋 Found ${predictedPairs.size} predicted matches in last 24h`);
            console.log('🔍 Predicted pairs:', Array.from(predictedPairs));
            console.log('🔍 Live matches before filter:', midGame.map(g => `${String(g.homeTeam).toLowerCase()}__${String(g.awayTeam).toLowerCase()}`));
            midGame = midGame.filter(g => predictedPairs.has(`${String(g.homeTeam).toLowerCase()}__${String(g.awayTeam).toLowerCase()}`));
            console.log(`🎯 Filtered to ${midGame.length} live matches that we predicted`);
          } else {
            console.log('⚠️ No predicted matches found in Supabase, fallback to top-tier leagues only');
            // Fallback: filter to only top-tier leagues
            const topLeagues = ['Premier League', 'La Liga', 'Serie A', 'Bundesliga', 'Ligue 1', 'Champions League', 'Europa League'];
            midGame = midGame.filter(g => {
              const competition = g.competition || g.league || '';
              return topLeagues.some(league => competition.includes(league));
            });
            console.log(`🎯 Fallback: filtered to ${midGame.length} matches from top leagues`);
          }
        }
      }
    } catch (e) {
      console.log('⚠️ Error reading predicted matches from Supabase:', e.message);
      console.log('🔍 Full error details:', JSON.stringify(e, null, 2));
      
      // Fallback: filter to only top-tier leagues
      console.log('🔄 Applying error fallback: top-tier leagues only');
      const topLeagues = ['Premier League', 'La Liga', 'Serie A', 'Bundesliga', 'Ligue 1', 'Champions League', 'Europa League'];
      midGame = midGame.filter(g => {
        const competition = g.competition || g.league || '';
        return topLeagues.some(league => competition.includes(league));
      });
      console.log(`🎯 Error fallback: filtered to ${midGame.length} matches from top leagues`);
    }
    if (midGame.length === 0) {
      return res.status(200).json({ success: true, message: "No predicted mid-game matches (45-75')", liveCount: liveMatches.length, action: 'skipped' });
    }

    // Filter matches that actually have changes since last update
    const matchesWithChanges = midGame.filter(match => {
      const matchId = match.fixture?.id || match.id || `${match.homeTeam?.name}-${match.awayTeam?.name}`;
      const currentScore = `${match.homeScore || 0}-${match.awayScore || 0}`;
      const currentMinute = match.minute || 0;
      
      const lastUpdate = lastLiveUpdates.get(matchId);
      
      // If no previous update, it's a change
      if (!lastUpdate) {
        lastLiveUpdates.set(matchId, {
          score: currentScore,
          minute: currentMinute,
          lastUpdate: Date.now()
        });
        return true;
      }
      
      // Check if score changed or significant minute change (5+ minutes)
      const scoreChanged = lastUpdate.score !== currentScore;
      const significantTimeChange = Math.abs(currentMinute - lastUpdate.minute) >= 5;
      const timeSinceLastUpdate = Date.now() - lastUpdate.lastUpdate;
      const minTimeBetweenUpdates = 15 * 60 * 1000; // 15 minutes minimum
      
      if (scoreChanged || (significantTimeChange && timeSinceLastUpdate > minTimeBetweenUpdates)) {
        // Update memory
        lastLiveUpdates.set(matchId, {
          score: currentScore,
          minute: currentMinute,
          lastUpdate: Date.now()
        });
        return true;
      }
      
      return false;
    });

    if (matchesWithChanges.length === 0) {
      return res.status(200).json({ 
        success: true, 
        message: `No significant changes in ${midGame.length} live matches since last update`, 
        action: 'skipped',
        totalLive: midGame.length
      });
    }

    console.log(`📊 Sending live updates for ${matchesWithChanges.length}/${midGame.length} matches with changes`);
    
    const content = await contentGenerator.generateLiveStatus(matchesWithChanges);
    const result = await telegram.sendLiveStatus(content, matchesWithChanges);

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