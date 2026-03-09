// Cron: Live Status around 60' minute — Multi-Channel

const FootballAPI = require('../../../lib/football-api');
const ContentGenerator = require('../../../lib/content-generator');
const TelegramManager = require('../../../lib/telegram');

let lastLiveUpdates = new Map();

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const authHeader = req.headers.authorization;
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const ethiopianTime = new Date().toLocaleString('en-US', { timeZone: 'Africa/Addis_Ababa' });
    const currentHour = new Date(ethiopianTime).getHours();
    if (currentHour < 12 || currentHour > 23) {
      return res.status(200).json({ success: true, message: 'Outside live status window', action: 'skipped' });
    }

    const { getActiveChannels } = require('../../../lib/channel-config');
    const footballAPI = new FootballAPI();
    const telegram = new TelegramManager();

    const allLiveMatches = await footballAPI.getLiveMatches();
    console.log(`🔴 Total live matches: ${allLiveMatches.length}`);

    if (allLiveMatches.length === 0) {
      return res.status(200).json({ success: true, message: 'No live matches', action: 'skipped' });
    }

    // Get tracked matches from daily schedule
    let trackedMatches = [];
    try {
      const { getDailySchedule } = require('../../../lib/storage');
      const dailySchedule = await getDailySchedule();
      if (dailySchedule?.matches) trackedMatches = dailySchedule.matches;
    } catch (_) {}

    // Filter to mid-game (45-75') and tracked matches
    let midGame = allLiveMatches.filter(m => {
      const isAround60 = typeof m.minute === 'number' && m.minute >= 45 && m.minute <= 75;
      if (!isAround60) return false;
      if (trackedMatches.length === 0) return true;
      return trackedMatches.some(sm => {
        const sh = sm.homeTeam?.name || sm.homeTeam;
        const sa = sm.awayTeam?.name || sm.awayTeam;
        return (m.homeTeam === sh || m.homeTeam.includes(sh) || sh.includes(m.homeTeam)) &&
               (m.awayTeam === sa || m.awayTeam.includes(sa) || sa.includes(m.awayTeam));
      });
    });

    // Filter to predicted matches via Supabase
    try {
      const { supabase } = require('../../../lib/supabase');
      if (supabase) {
        const { data: posts, error } = await supabase
          .from('telegram_posts').select('metadata').eq('type', 'predictions')
          .gte('created_at', new Date(Date.now() - 24 * 3600000).toISOString());

        if (!error && posts?.length > 0) {
          const predictedPairs = new Set();
          posts.forEach(post => {
            if (post.metadata?.homeTeam && post.metadata?.awayTeam) {
              predictedPairs.add(`${post.metadata.homeTeam.toLowerCase()}__${post.metadata.awayTeam.toLowerCase()}`);
            } else if (post.metadata?.matches) {
              post.metadata.matches.forEach(m => {
                if (m.homeTeam && m.awayTeam) predictedPairs.add(`${m.homeTeam.toLowerCase()}__${m.awayTeam.toLowerCase()}`);
              });
            }
          });
          if (predictedPairs.size > 0) {
            midGame = midGame.filter(g => predictedPairs.has(`${String(g.homeTeam).toLowerCase()}__${String(g.awayTeam).toLowerCase()}`));
          }
        }
      }
    } catch (_) {
      const topLeagues = ['Premier League', 'La Liga', 'Serie A', 'Bundesliga', 'Ligue 1', 'Champions League', 'Europa League'];
      midGame = midGame.filter(g => topLeagues.some(l => (g.competition || '').includes(l)));
    }

    if (midGame.length === 0) {
      return res.status(200).json({ success: true, message: "No predicted mid-game matches (45-75')", action: 'skipped' });
    }

    // Filter to matches with actual changes
    const matchesWithChanges = midGame.filter(match => {
      const matchId = match.fixture?.id || match.id || `${match.homeTeam}-${match.awayTeam}`;
      const currentScore = `${match.homeScore || 0}-${match.awayScore || 0}`;
      const currentMinute = match.minute || 0;
      const lastUpdate = lastLiveUpdates.get(matchId);

      if (!lastUpdate) {
        lastLiveUpdates.set(matchId, { score: currentScore, minute: currentMinute, lastUpdate: Date.now() });
        return true;
      }

      const scoreChanged = lastUpdate.score !== currentScore;
      const significantTime = Math.abs(currentMinute - lastUpdate.minute) >= 5;
      const timeSince = Date.now() - lastUpdate.lastUpdate;

      if (scoreChanged || (significantTime && timeSince > 15 * 60 * 1000)) {
        lastLiveUpdates.set(matchId, { score: currentScore, minute: currentMinute, lastUpdate: Date.now() });
        return true;
      }
      return false;
    });

    if (matchesWithChanges.length === 0) {
      return res.status(200).json({ success: true, message: 'No significant changes', action: 'skipped' });
    }

    // Send to all channels
    const channels = await getActiveChannels();
    const channelResults = [];

    for (const ch of channels) {
      try {
        const cg = new ContentGenerator({
          language: ch.language || 'en',
          timezone: ch.timezone || 'Africa/Addis_Ababa',
        });
        const promoCode = ch.coupon_code || 'SM100';
        const content = await cg.generateLiveStatus(matchesWithChanges, promoCode);
        await telegram.sendLiveStatus(content, matchesWithChanges, ch);
        channelResults.push({ channel: ch.channel_id, success: true });
      } catch (err) {
        channelResults.push({ channel: ch.channel_id, success: false, error: err.message });
      }
    }

    return res.status(200).json({
      success: true,
      message: `Live status sent (${midGame.length} matches)`,
      channelResults,
      ethiopianTime
    });
  } catch (error) {
    console.error('❌ Cron live-status error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}
