// Manual Summary API - Generates and optionally posts a daily summary

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed. Use POST.' });
  }

  try {
    const FootballAPI = require('../../../lib/football-api.js');
    const TelegramManager = require('../../../lib/telegram.js');
    const { getDailySchedule } = require('../../../lib/storage');
    const { acquireLock, releaseLock } = require('../../../lib/lock');
    const { isCooldownActive, markCooldown } = require('../../../lib/cooldown');

    const dryRun = Boolean(
      (req.query && (req.query.dryRun === '1' || req.query.dryRun === 'true')) ||
      (req.body && (req.body.dryRun === true || req.body.dryRun === 'true' || req.body.dryRun === 1))
    );

    // Cooldown + lock to avoid flooding
    const COOLDOWN_MS = 30 * 60 * 1000; // 30 minutes
    const cdKey = 'summary-global';
    if (await isCooldownActive(cdKey, COOLDOWN_MS)) {
      return res.status(429).json({ success: false, message: 'Summary cooldown active. Try again later.' });
    }

    const lock = await acquireLock('summary-run', 2 * 60 * 1000);
    if (!lock.acquired) {
      return res.status(423).json({ success: false, message: 'Summary is already running. Please wait.' });
    }

    const footballAPI = new FootballAPI();
    const telegram = new TelegramManager();

    // Data sources - collect ALL finished fixtures to rank top 5
    const rawFinished = await footballAPI.getAllYesterdayFixturesRaw();
    const cached = await getDailySchedule();
    const todayMatches = cached?.matches || [];

    // Build concise summary content in English
    const etTime = new Date().toLocaleString('en-US', { timeZone: 'Africa/Addis_Ababa' });
    const lines = [];
    lines.push('📋 DAILY SUMMARY');
    lines.push('────────────────────');
    lines.push(`🕒 Time (ET): ${etTime}`);
    lines.push('');
    // Rank and pick Top 5 finished matches
    const scored = (rawFinished || [])
      .filter(f => f.fixture?.status?.short === 'FT')
      .map(f => ({
        f,
        score: (() => {
          let s = 0;
          const league = f.league?.name || '';
          const leagueScores = {
            'UEFA Champions League': 100,
            'Premier League': 90,
            'La Liga': 85,
            'Serie A': 80,
            'Bundesliga': 75,
            'Ligue 1': 70
          };
          s += leagueScores[league] || 50;
          const bigTeams = ['Real Madrid','Barcelona','Manchester City','Manchester United','Liverpool','Arsenal','Chelsea','Tottenham Hotspur','Bayern Munich','Borussia Dortmund','Paris Saint-Germain','Juventus','AC Milan','Inter Milan','Napoli','Atletico Madrid','PSG'];
          const home = f.teams?.home?.name || '';
          const away = f.teams?.away?.name || '';
          if (bigTeams.some(t => home.includes(t))) s += 25;
          if (bigTeams.some(t => away.includes(t))) s += 25;
          if ((f.goals?.home ?? 0) + (f.goals?.away ?? 0) >= 4) s += 15;
          return s;
        })()
      }))
      .sort((a,b) => b.score - a.score)
      .slice(0,5)
      .map(x => x.f);

    lines.push(`✅ Yesterday Top 5 Results (ranked): ${scored.length}`);
    if (scored.length > 0) {
      const summaries = scored.map(r => {
        const home = r.teams?.home?.name;
        const away = r.teams?.away?.name;
        const score = `${r.goals?.home ?? ''}-${r.goals?.away ?? ''}`;
        const league = r.league?.name || '';
        // Short one-liner summary
        return `• ${home} ${score} ${away}${league ? ` — ${league}` : ''}`;
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
        const t = m.kickoffTime ? new Date(m.kickoffTime).toLocaleTimeString('en-US', { timeZone: 'Africa/Addis_Ababa', hour: '2-digit', minute: '2-digit' }) : '';
        return `• ${home} vs ${away}${league ? ` (${league})` : ''}${t ? ` — ${t} ET` : ''}`;
      });
      lines.push(...topMx);
      if (todayMatches.length > 3) lines.push(`… and ${todayMatches.length - 3} more`);
    }
    lines.push('');
    // No external website link for SportMaster

    const content = lines.join('\n');

    if (dryRun) {
      await releaseLock('summary-run');
      return res.json({
        success: true,
        dryRun: true,
        message: 'Summary generated (not sent)',
        preview: content,
        yesterdayCount: scored.length,
        todayCount: todayMatches.length,
        timestamp: new Date().toISOString(),
        ethiopianTime: etTime
      });
    }

    // Try generate scoreboard image for these 5 (with team logos abstract per current image gen)
    let sent;
    try {
      const ImageGenerator = require('../../../lib/image-generator');
      const imgGen = new ImageGenerator();
      const imgInput = scored.map(r => ({
        homeTeam: r.teams.home.name,
        awayTeam: r.teams.away.name,
        homeScore: r.goals.home,
        awayScore: r.goals.away,
        competition: r.league.name
      }));
      const imageBuffer = await imgGen.generateResultsImage(imgInput);
      if (imageBuffer) {
        const keyboard = await telegram.createResultsKeyboard();
        const message = await telegram.bot.sendPhoto(telegram.channelId, imageBuffer, {
          caption: content,
          parse_mode: 'HTML',
          reply_markup: { inline_keyboard: keyboard }
        });
        sent = message;
        try { await telegram.logPostToSupabase('summary', content, message?.message_id); } catch (_) {}
      }
    } catch (e) { console.log('⚠️ Summary image generation failed:', e.message); }

    const message = sent || await telegram.sendSummary(content);
    try { await telegram.logPostToSupabase('summary', content, message?.message_id); } catch (_) {}
    await markCooldown(cdKey);
    await releaseLock('summary-run');

    return res.json({
      success: true,
      message: 'Summary sent successfully',
      messageId: message?.message_id || null,
      yesterdayCount: scored.length,
      todayCount: todayMatches.length,
      timestamp: new Date().toISOString(),
      ethiopianTime: etTime
    });

  } catch (error) {
    try { const { releaseLock } = require('../../../lib/lock'); await releaseLock('summary-run'); } catch (_) {}
    console.error('❌ Summary error:', error);
    return res.status(500).json({ success: false, message: 'Failed to send summary', error: error.message });
  }
}

