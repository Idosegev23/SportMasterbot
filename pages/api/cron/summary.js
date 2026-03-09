// Vercel Cron endpoint for daily summary at 00:00 EAT (21:00 UTC) — Multi-Channel

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Verify this is a legitimate cron request
  const authHeader = req.headers.authorization;
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    console.log('🕛 Cron: Executing daily summary for all channels...');

    const FootballAPI = require('../../../lib/football-api');
    const TelegramManager = require('../../../lib/telegram');
    const ContentGenerator = require('../../../lib/content-generator');
    const { getActiveChannels } = require('../../../lib/channel-config');
    const { getDailySchedule } = require('../../../lib/storage');

    const footballAPI = new FootballAPI();
    const telegram = new TelegramManager();

    // Fetch shared data once (results and today matches are the same for all channels)
    const yesterdayResults = await footballAPI.getYesterdayResults();
    const cached = await getDailySchedule();
    let todayMatches = cached?.matches || [];

    // Fallback: if cache is empty, get live data
    if (todayMatches.length === 0) {
      console.log('⚠️ Cache empty, fetching live today matches...');
      try {
        todayMatches = await footballAPI.getAllTodayMatchesRanked();
        if (todayMatches.length === 0) {
          todayMatches = await footballAPI.getTodayMatches();
        }
        console.log(`✅ Live fallback: ${todayMatches.length} matches found`);
      } catch (error) {
        console.log('❌ Failed to fetch live matches:', error.message);
      }
    }

    const scored = yesterdayResults.slice(0, 5);

    // Send to all active channels
    const channels = await getActiveChannels();
    const results = [];

    for (const ch of channels) {
      try {
        const etTime = new Date().toLocaleString('en-US', { timeZone: ch.timezone || 'Africa/Addis_Ababa' });

        // Build summary content
        const lines = [];
        lines.push('📋 DAILY SUMMARY');
        lines.push('────────────────────');
        lines.push(`🕒 Time: ${etTime}`);
        lines.push('');

        lines.push(`✅ Yesterday Top 5 Results (ranked): ${scored.length}`);
        if (scored.length > 0) {
          const summaries = scored.map(r => {
            const home = r.homeTeam?.name || r.homeTeam || r.teams?.home?.name;
            const away = r.awayTeam?.name || r.awayTeam || r.teams?.away?.name;
            const homeScore = r.homeScore ?? r.goals?.home ?? '';
            const awayScore = r.awayScore ?? r.goals?.away ?? '';
            const league = r.competition?.name || r.league?.name || '';
            return `• ${home} ${homeScore}-${awayScore} ${away}${league ? ` — ${league}` : ''}`;
          });
          lines.push(...summaries);
        }
        lines.push('');
        lines.push(`📅 Today Matches: ${todayMatches.length}`);
        if (todayMatches.length > 0) {
          const topMx = todayMatches.slice(0, 3).map(m => {
            const home = m.homeTeam?.name || m.homeTeam;
            const away = m.awayTeam?.name || m.awayTeam;
            const league = m.competition?.name || m.league?.name || '';
            const t = m.kickoffTime ? new Date(m.kickoffTime).toLocaleTimeString('en-US', {
              timeZone: ch.timezone || 'Africa/Addis_Ababa',
              hour: '2-digit', minute: '2-digit'
            }) : '';
            return `• ${home} vs ${away}${league ? ` (${league})` : ''}${t ? ` — ${t}` : ''}`;
          });
          lines.push(...topMx);
          if (todayMatches.length > 3) lines.push(`… and ${todayMatches.length - 3} more`);
        }
        lines.push('');

        const content = lines.join('\n');
        const targetChannel = ch.channel_id || telegram.channelId;

        // Try generate scoreboard image
        let sent = null;
        try {
          const ImageGenerator = require('../../../lib/image-generator');
          const imgGen = new ImageGenerator();
          const imgInput = scored.map(r => ({
            homeTeam: r.teams?.home?.name || r.homeTeam?.name || r.homeTeam,
            awayTeam: r.teams?.away?.name || r.awayTeam?.name || r.awayTeam,
            homeScore: r.goals?.home ?? r.homeScore ?? '',
            awayScore: r.goals?.away ?? r.awayScore ?? '',
            competition: r.league?.name || r.competition?.name || ''
          }));
          const imageBuffer = await imgGen.generateResultsImage(imgInput);
          if (imageBuffer) {
            const keyboard = await telegram.buildKeyboard(ch, 'results');
            const message = await telegram.bot.sendPhoto(targetChannel, imageBuffer, {
              caption: content,
              parse_mode: 'HTML',
              reply_markup: { inline_keyboard: keyboard }
            });
            sent = message;
            try { await telegram.logPostToSupabase('summary', content, message?.message_id, {}, ch); } catch (_) {}
          }
        } catch (e) {
          console.log(`⚠️ Summary image generation failed for ${ch.channel_id}:`, e.message);
        }

        // Fallback to text-only if image failed
        if (!sent) {
          const message = await telegram.sendSummary(content, ch);
          try { await telegram.logPostToSupabase('summary', content, message?.message_id, {}, ch); } catch (_) {}
        }

        results.push({ channel: ch.channel_id, success: true });
        console.log(`✅ Summary sent to ${ch.channel_id}`);
      } catch (err) {
        results.push({ channel: ch.channel_id, success: false, error: err.message });
        console.error(`❌ Summary failed for ${ch.channel_id}:`, err.message);
      }
    }

    return res.status(200).json({
      success: true,
      message: `Summary sent to ${results.filter(r => r.success).length}/${channels.length} channels`,
      results,
      ethiopianTime: new Date().toLocaleString('en-US', { timeZone: 'Africa/Addis_Ababa' }),
      executedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Cron summary error:', error);
    return res.status(500).json({ success: false, message: 'Failed to execute daily summary', error: error.message });
  }
}
