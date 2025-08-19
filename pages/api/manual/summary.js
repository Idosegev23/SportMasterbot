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

    // Data sources - use filtered results instead of raw data
    const yesterdayResults = await footballAPI.getYesterdayResults(); // Uses our filters!
    const cached = await getDailySchedule();
    let todayMatches = cached?.matches || [];
    
    // Fallback: if cache is empty, get live data  
    if (todayMatches.length === 0) {
      console.log('⚠️ Cache empty, fetching live today matches...');
      try {
        // First try all leagues ranked
        todayMatches = await footballAPI.getAllTodayMatchesRanked();
        console.log(`📊 Found ${todayMatches.length} matches from all leagues`);
        
        // If still empty, try popular leagues
        if (todayMatches.length === 0) {
          todayMatches = await footballAPI.getTodayMatches();
          console.log(`📊 Found ${todayMatches.length} matches from popular leagues`);
        }
        
        console.log(`✅ Live fallback successful: ${todayMatches.length} matches found`);
      } catch (error) {
        console.log('❌ Failed to fetch live matches:', error.message);
      }
    } else {
      console.log(`✅ Using cached matches: ${todayMatches.length} found`);
    }

    // Build concise summary content in English
    const etTime = new Date().toLocaleString('en-US', { timeZone: 'Africa/Addis_Ababa' });
    const lines = [];
    lines.push('📋 DAILY SUMMARY');
    lines.push('────────────────────');
    lines.push(`🕒 Time (ET): ${etTime}`);
    lines.push('');
    // Use already filtered and ranked yesterday results (no more U21 or obscure leagues!)
    const scored = yesterdayResults.slice(0, 5); // Already filtered and ranked by importance

    lines.push(`✅ Yesterday Top 5 Results (ranked): ${scored.length}`);
    if (scored.length > 0) {
      const summaries = scored.map(r => {
        // Handle both API formats (from getYesterdayResults)
        const home = r.homeTeam?.name || r.homeTeam || r.teams?.home?.name;
        const away = r.awayTeam?.name || r.awayTeam || r.teams?.away?.name;
        const homeScore = r.homeScore ?? r.goals?.home ?? '';
        const awayScore = r.awayScore ?? r.goals?.away ?? '';
        const league = r.competition?.name || r.league?.name || '';
        // Short one-liner summary
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

