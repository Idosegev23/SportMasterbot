// 🤖 SportMaster Simple Bot Commands - Clean & Direct
// All essential commands in one file - no complex modules!

const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');

class SimpleBotCommands {
  constructor() {
    if (!process.env.TELEGRAM_BOT_TOKEN) {
      throw new Error('❌ TELEGRAM_BOT_TOKEN is required');
    }

    const token = (process.env.TELEGRAM_BOT_TOKEN || '').trim();
    if (!token) {
      throw new Error('❌ TELEGRAM_BOT_TOKEN is required');
    }
    this.bot = new TelegramBot(token, { 
      polling: false, // Disable polling for webhook mode
      request: {
        agentOptions: {
          keepAlive: true,
          family: 4
        }
      }
    });
    this.channelId = (process.env.CHANNEL_ID || '').trim();
    
    // Admin users - from environment variable or default
    this.adminUsers = this.parseAdminUsers();

    console.log('🤖 Simple Bot Commands initialized');
  }

  // 👥 Show users who clicked "Get Personal Coupons"
  async showPersonalSubscribers(chatId) {
    try {
      const { supabase } = require('./supabase');
      if (!supabase) {
        return await this.bot.sendMessage(chatId, '⚠️ Supabase not configured');
      }

      // 1) Pull interactions/clicks (no date filter to include historical data)
      // Try to pull button_analytics if exists (but it may not be populated in this project)
      let clickedUserIds = [];
      try {
        const { data: clickRows } = await supabase
          .from('button_analytics')
          .select('user_id, button_text, url_clicked, clicked_at')
          .or('button_text.ilike.%Personal Coupons%,url_clicked.ilike.%t.me/Sportmsterbot%');
        clickedUserIds = [...new Set((clickRows || [])
          .map(r => Number(String(r.user_id).replace(/[^0-9-]/g, '')))
          .filter(v => Number.isFinite(v) && v > 0))];
      } catch (_) {}

      // 2) Cross with interactions for consent AND opt_in (both flows are used)
      const { data: interRows } = await supabase
        .from('interactions')
        .select('user_id, ts, type')
        .in('type', ['consent', 'opt_in'])
        ;
      const consentUserIds = new Set((interRows || []).map(r => Number(r.user_id)));

      // 2b) Also include users table where consent flag = true
      const { data: consentUsers } = await supabase
        .from('users')
        .select('user_id')
        .eq('consent', true);
      (consentUsers || []).forEach(u => consentUserIds.add(Number(u.user_id)));

      // 3) Fetch user details
      const targetIds = Array.from(new Set([...(clickedUserIds || []), ...Array.from(consentUserIds)]));
      if (targetIds.length === 0) {
        return await this.bot.sendMessage(chatId, '👥 No recent Personal Coupons clicks/opt-ins found in the last 30 days.');
      }
      const { data: usersRows } = await supabase
        .from('users')
        .select('user_id, username, first_name, last_name, last_seen_at, consent')
        .in('user_id', targetIds);

      // 4) Coupon status join
      const { data: couponRows } = await supabase
        .from('user_coupons')
        .select('user_id, sent_at, redeemed_at')
        .in('user_id', targetIds);
      const userIdToCoupon = new Map((couponRows || []).map(r => [Number(r.user_id), r]));

      // 5) Build list with flags: clicked, consented, redeemed
      const clickedSet = new Set(clickedUserIds);
      const lines = (usersRows || []).sort((a,b)=>Number(b.last_seen_at?new Date(b.last_seen_at):0)-Number(a.last_seen_at?new Date(a.last_seen_at):0)).slice(0,100).map((u, idx) => {
        const name = [u.first_name, u.last_name].filter(Boolean).join(' ') || u.username || String(u.user_id);
        const seen = u.last_seen_at ? new Date(u.last_seen_at).toLocaleString('en-US', { timeZone: 'Africa/Addis_Ababa' }) : '';
        const clicked = clickedSet.has(Number(u.user_id)) ? '✅' : '—';
        const consented = (u.consent || consentUserIds.has(Number(u.user_id))) ? '✅' : '—';
        const coupon = userIdToCoupon.get(Number(u.user_id));
        const redeemed = coupon?.redeemed_at ? '✅' : '—';
        return `${idx + 1}. ${name} (${u.user_id}) ${seen ? `— seen: ${seen} ` : ''}\n   clicked:${clicked}  consent:${consented}  redeemed:${redeemed}`;
      });

      const header = `👥 <b>Personal Subscribers</b>\n` +
        `Found: clicks=${clickedUserIds.length}, consent=${consentUserIds.size}, listed=${lines.length}\n\n`;
      await this.bot.sendMessage(chatId, header + lines.join('\n'), { parse_mode: 'HTML' });
    } catch (e) {
      console.error('❌ personal subscribers error:', e);
      await this.bot.sendMessage(chatId, '❌ Failed to fetch: ' + (e.message || e));
    }
  }

  // 🔧 Parse admin users from environment
  parseAdminUsers() {
    const adminIds = [];
    
    // Try to get from environment variable
    if (process.env.ADMIN_USER_IDS) {
      const envIds = process.env.ADMIN_USER_IDS.split(',')
        .map(id => parseInt(id.trim()))
        .filter(id => !isNaN(id));
      adminIds.push(...envIds);
    }
    
    // Add default test admin if no IDs found
    if (adminIds.length === 0) {
      adminIds.push(2024477887); // Test admin
      console.log('⚠️ No ADMIN_USER_IDS found, using default test admin');
    }
    
    console.log('🔑 Admin users:', adminIds);
    return adminIds;
  }

  // 🔐 Check if user is admin
  isAdmin(userId) {
    return this.adminUsers.includes(userId);
  }

  // 🔐 Check if user is admin OR channel owner (can use content commands)
  async isAuthorized(userId) {
    if (this.isAdmin(userId)) return true;
    const channel = await this.getOwnedChannel(userId);
    return !!channel;
  }

  // 🔐 Admin/Owner verification with detailed logging
  checkAdminAccess(msg) {
    const userId = msg.from.id;
    const userName = msg.from.first_name || msg.from.username || 'Unknown';

    console.log(`🔍 Access check: User ${userName} (${userId})`);

    // First, always send a response so user knows bot is working
    this.bot.sendMessage(msg.chat.id, '🤖 <i>Processing your request...</i>', { parse_mode: 'HTML' });

    if (!this.isAdmin(userId)) {
      // Don't deny yet — might be a channel owner (checked async in webhook)
      console.log(`⚠️ User ${userId} is not admin, checking owner status in webhook`);
      return false;
    }

    console.log(`✅ Access GRANTED for admin ${userId}`);
    return true;
  }

  // Resolve base URL for API calls
  getBaseUrl() {
    return process.env.NODE_ENV === 'development'
      ? 'http://localhost:3000'
      : (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://sport-masterbot.vercel.app');
  }

  // 🏠 Main Menu - The heart of the bot
  async showMainMenu(chatId) {
    // Resolve user's channel for display
    const channel = await this.getOwnedChannel(chatId);
    const channelName = channel?.display_name || process.env.CHANNEL_ID || 'Default';
    const channelId = channel?.channel_id || process.env.CHANNEL_ID || '';

    const menuText = `🎮 <b>SportMaster Control Panel</b> 🎮

📡 <b>Channel:</b> ${channelName} (<code>${channelId}</code>)
⏰ ${new Date().toLocaleString('en-US', { timeZone: channel?.timezone || 'Africa/Addis_Ababa' })}

📝 <b>Content</b> — Predictions, promos, results, news
🔴 <b>Live</b> — Live matches & today's games
⚙️ <b>System</b> — Status & analytics`;

    const keyboard = [
      [
        { text: '⚽ Predictions', callback_data: 'cmd_predictions' },
        { text: '🎁 Promo', callback_data: 'cmd_promo' }
      ],
      [
        { text: '📊 Results', callback_data: 'cmd_results' },
        { text: '📋 Summary', callback_data: 'cmd_summary' }
      ],
      [
        { text: '📅 Today', callback_data: 'cmd_today' },
        { text: '⚡ Hype', callback_data: 'cmd_today_hype' }
      ],
      [
        { text: '📰 News', callback_data: 'cmd_news' },
        { text: '📈 Status', callback_data: 'cmd_status' }
      ],
      [
        { text: '🔄 Refresh', callback_data: 'cmd_menu' },
        { text: '🎯 Targeted', callback_data: 'cmd_send_targeted' }
      ]
    ];

    return await this.bot.sendMessage(chatId, menuText, {
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard: keyboard }
    });
  }

  // ⚡ Execute Today Hype (AI-generated) with buttons — channel-aware
  async executeTodayHype(chatId) {
    try {
      const channelConfig = await this.getOwnedChannel(chatId);
      const FootballAPI = require('./football-api');
      const ContentGenerator = require('./content-generator');
      const TelegramManager = require('./telegram');
      const footballAPI = new FootballAPI();
      const cg = new ContentGenerator({
        language: channelConfig?.language || 'en',
        timezone: channelConfig?.timezone || 'Africa/Addis_Ababa',
      });
      const telegram = new TelegramManager();
      const targetChannel = channelConfig?.channel_id || telegram.channelId;

      let matches = await footballAPI.getTodayMatches(channelConfig?.leagues);
      if (!matches || matches.length === 0) {
        matches = await footballAPI.getAllTodayMatchesRanked();
      }
      if (!matches || matches.length === 0) {
        await this.bot.sendMessage(chatId, '📅 No games found for today.');
        return;
      }

      const content = await cg.generateTodayHype(matches);
      const keyboard = await telegram.buildKeyboard(channelConfig, 'predictions');

      const ImageGenerator = require('./image-generator');
      const imageGen = new ImageGenerator();
      let imageBuffer = null;
      try {
        imageBuffer = await imageGen.generateTodayHypeImage(matches);
      } catch (e) {
        console.log('⚠️ Hype image failed:', e?.message || e);
      }

      if (imageBuffer) {
        const msg = await telegram.bot.sendPhoto(targetChannel, imageBuffer, {
          caption: content, parse_mode: 'HTML',
          reply_markup: { inline_keyboard: keyboard }
        });
        await telegram.logPostToSupabase('today_hype', content, msg.message_id, {}, channelConfig);
      } else {
        const msg = await telegram.bot.sendMessage(targetChannel, content, {
          parse_mode: 'HTML', disable_web_page_preview: true,
          reply_markup: { inline_keyboard: keyboard }
        });
        await telegram.logPostToSupabase('today_hype', content, msg.message_id, {}, channelConfig);
      }

      await this.bot.sendMessage(chatId, `✅ Today hype sent to <b>${targetChannel}</b>!`, { parse_mode: 'HTML' });
    } catch (error) {
      console.error('❌ Today hype error:', error);
      await this.bot.sendMessage(chatId, '❌ Failed to send today hype: ' + error.message);
    }
  }

  // 📝 Setup all command handlers
  setupCommands() {
    console.log('🔧 Setting up simple bot commands...');

    // /start and /menu commands
    this.bot.onText(/\/start|\/menu/, async (msg) => {
      if (!this.checkAdminAccess(msg)) return;
      await this.showMainMenu(msg.chat.id);
    });

    // /predictions command
    this.bot.onText(/\/predictions/, async (msg) => {
      if (!this.checkAdminAccess(msg)) return;
      await this.handlePredictionsCommand(msg);
    });

    // /promo command
    this.bot.onText(/\/promo/, async (msg) => {
      if (!this.checkAdminAccess(msg)) return;
      await this.handlePromoCommand(msg);
    });

    // /results command
    this.bot.onText(/\/results/, async (msg) => {
      if (!this.checkAdminAccess(msg)) return;
      await this.handleResultsCommand(msg);
    });

    // /status command
    this.bot.onText(/\/status/, async (msg) => {
      if (!this.checkAdminAccess(msg)) return;
      await this.handleStatusCommand(msg);
    });

    // /today command
    this.bot.onText(/\/today/, async (msg) => {
      if (!this.checkAdminAccess(msg)) return;
      await this.handleTodayCommand(msg);
    });

    // /news command
    this.bot.onText(/\/news/, async (msg) => {
      if (!this.checkAdminAccess(msg)) return;
      await this.executeNews(msg.chat.id);
    });

    // /help command
    this.bot.onText(/\/help/, async (msg) => {
      if (!this.checkAdminAccess(msg)) return;
      await this.handleHelpCommand(msg);
    });

    // === CHANNEL OWNER COMMANDS ===
    // These commands are available to channel owners (not just admins)

    // /mychannel - View channel info
    this.bot.onText(/\/mychannel/, async (msg) => {
      await this.handleMyChannel(msg);
    });

    // /setcoupon CODE - Update coupon code
    this.bot.onText(/\/setcoupon(?:\s+(.+))?/, async (msg, match) => {
      await this.handleSetCoupon(msg, match?.[1]?.trim());
    });

    // /setbonus OFFER - Update bonus text
    this.bot.onText(/\/setbonus(?:\s+(.+))?/, async (msg, match) => {
      await this.handleSetBonus(msg, match?.[1]?.trim());
    });

    // /setlanguage CODE - Update language
    this.bot.onText(/\/setlanguage(?:\s+(.+))?/, async (msg, match) => {
      await this.handleSetLanguage(msg, match?.[1]?.trim());
    });

    // /mylink - Get portal link
    this.bot.onText(/\/mylink/, async (msg) => {
      await this.handleMyLink(msg);
    });

    // /mystats - View channel stats
    this.bot.onText(/\/mystats/, async (msg) => {
      await this.handleMyStats(msg);
    });

    // Handle callback queries (button presses)
    this.setupCallbackHandlers();

    console.log('✅ Simple bot commands ready!');
  }

  // 🔘 Handle button presses
  setupCallbackHandlers() {
    this.bot.on('callback_query', async (callbackQuery) => {
      const action = callbackQuery.data;
      const chatId = callbackQuery.message.chat.id;
      const messageId = callbackQuery.message.message_id;

      // Acknowledge the callback immediately
      await this.bot.answerCallbackQuery(callbackQuery.id);

      try {
        // Handle different actions
        switch (action) {
          case 'cmd_menu':
            await this.bot.editMessageText(
              '🔄 <i>Refreshing menu...</i>',
              { chat_id: chatId, message_id: messageId, parse_mode: 'HTML' }
            );
            await this.showMainMenu(chatId);
            break;

          case 'cmd_predictions':
            await this.bot.editMessageText(
              '🤖 <i>Processing your request...</i>\n\n⚽ <b>Sending predictions...</b>',
              { chat_id: chatId, message_id: messageId, parse_mode: 'HTML' }
            );
            await this.executePredictions(chatId, messageId);
            break;

          case 'cmd_promo':
            await this.bot.editMessageText(
              '🎁 <i>Sending promo...</i>',
              { chat_id: chatId, message_id: messageId, parse_mode: 'HTML' }
            );
            await this.executePromo(chatId);
            break;

          case 'cmd_results':
            await this.bot.editMessageText(
              '📊 <i>Sending results...</i>',
              { chat_id: chatId, message_id: messageId, parse_mode: 'HTML' }
            );
            await this.executeResults(chatId);
            break;

          case 'cmd_summary':
            await this.bot.editMessageText(
              '📋 <i>Sending summary...</i>',
              { chat_id: chatId, message_id: messageId, parse_mode: 'HTML' }
            );
            await this.executeSummary(chatId);
            break;

          case 'cmd_today_hype':
            await this.bot.editMessageText(
              '⚡ <i>Creating today hype (may take up to 60s with image)...</i>',
              { chat_id: chatId, message_id: messageId, parse_mode: 'HTML' }
            );
            await this.executeTodayHype(chatId);
            break;

          case 'cmd_today':
            await this.bot.editMessageText(
              '📅 <i>Loading today\'s games...</i>',
              { chat_id: chatId, message_id: messageId, parse_mode: 'HTML' }
            );
            await this.showTodayGames(chatId);
            break;

          case 'cmd_status':
            await this.bot.editMessageText(
              '📈 <i>Checking system status...</i>',
              { chat_id: chatId, message_id: messageId, parse_mode: 'HTML' }
            );
            await this.showSystemStatus(chatId);
            break;

          case 'cmd_news':
            await this.bot.editMessageText(
              '📰 <i>Generating news content...</i>',
              { chat_id: chatId, message_id: messageId, parse_mode: 'HTML' }
            );
            await this.executeNews(chatId);
            break;

          case 'cmd_send_targeted':
            await this.bot.editMessageText(
              '🎯 <i>Preparing targeted coupons...</i>',
              { chat_id: chatId, message_id: messageId, parse_mode: 'HTML' }
            );
            await this.executeSendTargeted(chatId);
            break;

          default:
            await this.bot.sendMessage(chatId, '❓ Unknown action');
        }
      } catch (error) {
        console.error('❌ Callback error:', error);
        await this.bot.sendMessage(chatId, '❌ Error: ' + error.message);
      }
    });
  }

  // ⚽ Execute predictions DIRECTLY — no HTTP self-call
  async executePredictions(chatId, messageId) {
    try {
      try {
        const { isCooldownActive } = require('./cooldown');
        if (await isCooldownActive('predictions-global', 15 * 60 * 1000)) {
          await this.bot.sendMessage(chatId, '⏳ Predictions are in cooldown. Try again later.');
          return;
        }
      } catch (_) {}

      const channelConfig = await this.getOwnedChannel(chatId);

      const { isRateLimited, setRateLimit } = require('./storage');
      const rlKey = `predictions:${chatId}`;
      if (await isRateLimited(rlKey)) {
        await this.bot.sendMessage(chatId, '⏳ Please wait before triggering predictions again.');
        return;
      }

      const FootballAPI = require('./football-api');
      const ContentGenerator = require('./content-generator');
      const TelegramManager = require('./telegram');
      const footballAPI = new FootballAPI();
      const cg = new ContentGenerator({
        language: channelConfig?.language || 'en',
        timezone: channelConfig?.timezone || 'Africa/Addis_Ababa',
      });
      const telegram = new TelegramManager();
      const targetChannel = channelConfig?.channel_id || telegram.channelId;

      // Get matches — try cached, then popular, then all
      const { getDailySchedule } = require('./storage');
      const cached = await getDailySchedule();
      let matches = cached?.matches?.length ? cached.matches : [];
      if (matches.length === 0) matches = await footballAPI.getTodayMatches(channelConfig?.leagues);
      if (matches.length === 0) matches = await footballAPI.getAllTodayMatchesRanked();

      if (matches.length === 0) {
        await this.bot.sendMessage(chatId, '❌ No matches found for predictions today.');
        return;
      }

      // Get top 5 upcoming matches (ranked by importance, not just next one)
      const now = new Date();
      const upcoming = matches
        .filter(m => new Date(m.kickoffTime) > now)
        .slice(0, 5);

      if (upcoming.length === 0) {
        await this.bot.sendMessage(chatId, '❌ No upcoming matches found.');
        return;
      }

      // Generate predictions for top matches
      const predictions = [];
      for (let i = 0; i < upcoming.length; i++) {
        const pred = await cg.generateSingleMatchPrediction(upcoming[i], i, upcoming.length);
        predictions.push(pred);
      }

      // Send to channel
      const result = await telegram.sendPredictions(predictions, upcoming, channelConfig);

      await setRateLimit(rlKey, 60);
      try { const { markCooldown } = require('./cooldown'); await markCooldown('predictions-global'); } catch (_) {}
      if (messageId) { try { await this.bot.deleteMessage(chatId, messageId); } catch (_) {} }

      await this.bot.sendMessage(chatId,
        `✅ <b>Predictions sent!</b>\n\n` +
        `📊 ${upcoming.length} match predictions\n` +
        `📡 <b>Channel:</b> ${targetChannel}\n` +
        `⏰ ${new Date().toLocaleString('en-US', { timeZone: channelConfig?.timezone || 'Africa/Addis_Ababa' })}`,
        { parse_mode: 'HTML' }
      );
    } catch (error) {
      console.error('❌ Predictions error:', error);
      const errMsg = '❌ Failed: ' + (error.message || 'Unknown');
      if (messageId) {
        try { await this.bot.editMessageText(errMsg, { chat_id: chatId, message_id: messageId, parse_mode: 'HTML' }); } catch (_) {}
      } else {
        await this.bot.sendMessage(chatId, errMsg);
      }
    }
  }

  // 📋 Execute summary DIRECTLY — no HTTP self-call
  async executeSummary(chatId) {
    try {
      try {
        const { isCooldownActive } = require('./cooldown');
        if (await isCooldownActive('summary-global', 30 * 60 * 1000)) {
          await this.bot.sendMessage(chatId, '⏳ Summary is in cooldown. Try again later.');
          return;
        }
      } catch (_) {}

      const channelConfig = await this.getOwnedChannel(chatId);
      const FootballAPI = require('./football-api');
      const TelegramManager = require('./telegram');
      const { getDailySchedule } = require('./storage');
      const footballAPI = new FootballAPI();
      const telegram = new TelegramManager();
      const targetChannel = channelConfig?.channel_id || telegram.channelId;

      const yesterdayResults = await footballAPI.getYesterdayResults();
      const cached = await getDailySchedule();
      let todayMatches = cached?.matches || [];
      if (todayMatches.length === 0) {
        try { todayMatches = await footballAPI.getAllTodayMatchesRanked(); } catch (_) {}
        if (!todayMatches || todayMatches.length === 0) {
          try { todayMatches = await footballAPI.getTodayMatches(); } catch (_) {}
        }
      }

      const tz = channelConfig?.timezone || 'Africa/Addis_Ababa';
      const etTime = new Date().toLocaleString('en-US', { timeZone: tz });
      const scored = yesterdayResults.slice(0, 5);
      const lines = ['📋 DAILY SUMMARY', '────────────────────', `🕒 Time: ${etTime}`, ''];
      lines.push(`✅ Yesterday Top 5 Results: ${scored.length}`);
      if (scored.length > 0) {
        scored.forEach(r => {
          const home = r.homeTeam?.name || r.homeTeam || r.teams?.home?.name;
          const away = r.awayTeam?.name || r.awayTeam || r.teams?.away?.name;
          const hs = r.homeScore ?? r.goals?.home ?? '';
          const as = r.awayScore ?? r.goals?.away ?? '';
          const league = r.competition?.name || r.league?.name || '';
          lines.push(`• ${home} ${hs}-${as} ${away}${league ? ` — ${league}` : ''}`);
        });
      }
      lines.push('', `📅 Today Matches: ${(todayMatches || []).length}`);
      if (todayMatches && todayMatches.length > 0) {
        todayMatches.slice(0, 3).forEach(m => {
          const home = m.homeTeam?.name || m.homeTeam;
          const away = m.awayTeam?.name || m.awayTeam;
          const league = m.competition?.name || m.league?.name || '';
          const t = m.kickoffTime ? new Date(m.kickoffTime).toLocaleTimeString('en-US', { timeZone: tz, hour: '2-digit', minute: '2-digit' }) : '';
          lines.push(`• ${home} vs ${away}${league ? ` (${league})` : ''}${t ? ` — ${t}` : ''}`);
        });
        if (todayMatches.length > 3) lines.push(`… and ${todayMatches.length - 3} more`);
      }

      const content = lines.join('\n');
      const message = await telegram.sendSummary(content, channelConfig);
      try { await telegram.logPostToSupabase('summary', content, message?.message_id, {}, channelConfig); } catch (_) {}
      try { const { markCooldown } = require('./cooldown'); await markCooldown('summary-global'); } catch (_) {}

      await this.bot.sendMessage(chatId, `✅ Summary sent to <b>${targetChannel}</b>!`, { parse_mode: 'HTML' });
    } catch (error) {
      console.error('❌ Summary error:', error);
      await this.bot.sendMessage(chatId, '❌ Failed: ' + error.message);
    }
  }

  // 🎁 Execute promo — channel-aware (sends directly in webhook callback)
  async executePromo(chatId) {
    try {
      const channelConfig = await this.getOwnedChannel(chatId);

      await this.bot.sendMessage(chatId, '📦 Send promo with current buttons?', {
        reply_markup: { inline_keyboard: [[
          { text: '✅ With buttons', callback_data: 'promo:send:with_buttons' },
          { text: '📝 Text only', callback_data: 'promo:send:text_only' }
        ]] }
      });
      this._pendingPromo = this._pendingPromo || new Map();
      this._pendingPromo.set(chatId, { channelId: channelConfig?.channel_id });
    } catch (error) {
      console.error('❌ Promo error:', error);
      await this.bot.sendMessage(chatId, '❌ Failed: ' + error.message);
    }
  }

  // 📊 Execute results DIRECTLY — no HTTP self-call
  async executeResults(chatId) {
    try {
      const channelConfig = await this.getOwnedChannel(chatId);

      const { isRateLimited, setRateLimit } = require('./storage');
      const rlKey = `results:${chatId}`;
      if (await isRateLimited(rlKey)) {
        await this.bot.sendMessage(chatId, '⏳ Please wait before triggering results again.');
        return;
      }

      const FootballAPI = require('./football-api');
      const ContentGenerator = require('./content-generator');
      const TelegramManager = require('./telegram');
      const footballAPI = new FootballAPI();
      const cg = new ContentGenerator({
        language: channelConfig?.language || 'en',
        timezone: channelConfig?.timezone || 'Africa/Addis_Ababa',
      });
      const telegram = new TelegramManager();
      const targetChannel = channelConfig?.channel_id || telegram.channelId;

      const results = await footballAPI.getYesterdayResults();
      if (results.length === 0) {
        await this.bot.sendMessage(chatId, '❌ No results found for yesterday.');
        return;
      }

      const resultsContent = await cg.generateDailyResults(results);
      const result = await telegram.sendResults(resultsContent, results, channelConfig);
      try { await telegram.logPostToSupabase('results', resultsContent, result?.message_id, {}, channelConfig); } catch (_) {}

      await setRateLimit(rlKey, 60);
      await this.bot.sendMessage(chatId,
        `✅ <b>Results sent!</b>\n\n` +
        `📊 ${results.length} match results\n` +
        `📡 <b>Channel:</b> ${targetChannel}\n` +
        `⏰ ${new Date().toLocaleString('en-US', { timeZone: channelConfig?.timezone || 'Africa/Addis_Ababa' })}`,
        { parse_mode: 'HTML' }
      );
    } catch (error) {
      console.error('❌ Results error:', error);
      await this.bot.sendMessage(chatId, '❌ Failed: ' + error.message);
    }
  }

  // 🔴 Show live matches
  async showLiveMatches(chatId) {
    try {
      const FootballAPI = require('./football-api');
      const footballAPI = new FootballAPI();

      const liveMatches = await footballAPI.getLiveMatches();

      if (liveMatches.length === 0) {
        return await this.bot.sendMessage(chatId, 
          '🔴 <b>No Live Matches</b>\n\n' +
          '❌ No matches are currently being played.\n\n' +
          '⏰ Check back later!',
          { parse_mode: 'HTML' }
        );
      }

      let message = '🔴 <b>LIVE MATCHES</b> 🔴\n\n';
      
      liveMatches.slice(0, 5).forEach((match, index) => {
        message += `${index + 1}. <b>${match.homeTeam}</b> ` +
                  `${match.homeScore}-${match.awayScore} ` +
                  `<b>${match.awayTeam}</b>\n` +
                  `   🏆 ${match.competition}\n` +
                  `   ⏱️ ${match.status}\n\n`;
      });

      message += `📊 <b>Total:</b> ${liveMatches.length} live matches\n` +
                `⏰ <b>Updated:</b> ${new Date().toLocaleString('en-US', { timeZone: 'Africa/Addis_Ababa' })}`;

      await this.bot.sendMessage(chatId, message, { parse_mode: 'HTML' });

    } catch (error) {
      console.error('❌ Live matches error:', error);
      await this.bot.sendMessage(chatId, '❌ Failed to get live matches: ' + error.message);
    }
  }

  // 📅 Show today's games
  async showTodayGames(chatId) {
    try {
      const FootballAPI = require('./football-api');
      const footballAPI = new FootballAPI();

      let todayMatches = await footballAPI.getTodayMatches();
      // Fallback: if no popular leagues have matches, use all ranked matches (real data only)
      if (!todayMatches || todayMatches.length === 0) {
        try {
          todayMatches = await footballAPI.getAllTodayMatchesRanked();
        } catch (_) {}
      }

      if (todayMatches.length === 0) {
        return await this.bot.sendMessage(chatId, 
          '📅 <b>No Games Today</b>\n\n' +
          '❌ No scheduled matches for today.\n\n' +
          '🔄 Try again tomorrow!',
          { parse_mode: 'HTML' }
        );
      }

      let message = '📅 <b>TODAY\'S GAMES</b> 📅\n\n';
      
      todayMatches.slice(0, 10).forEach((match, index) => {
        const kickoff = new Date(match.kickoffTime);
        const time = kickoff.toLocaleTimeString('en-US', { 
          timeZone: 'Africa/Addis_Ababa',
          hour: '2-digit', 
          minute: '2-digit' 
        });
        
        const homeName = match.homeTeam?.name || match.homeTeam;
        const awayName = match.awayTeam?.name || match.awayTeam;
        const compName = match.competition?.name || match.league?.name || '';

        message += `${index + 1}. <b>${homeName}</b> vs <b>${awayName}</b>\n` +
                  `   🏆 ${compName}\n` +
                  `   ⏰ ${time} ET\n\n`;
      });

      message += `📊 <b>Total:</b> ${todayMatches.length} games today\n` +
                `📅 <b>Date:</b> ${new Date().toLocaleDateString('en-US', { timeZone: 'Africa/Addis_Ababa' })}`;

      await this.bot.sendMessage(chatId, message, { parse_mode: 'HTML' });

    } catch (error) {
      console.error('❌ Today games error:', error);
      await this.bot.sendMessage(chatId, '❌ Failed to get today\'s games: ' + error.message);
    }
  }

  // 📈 Show system status
  async showSystemStatus(chatId) {
    try {
      // Basic system status check
      const status = {
        timestamp: new Date().toISOString(),
        ethiopianTime: new Date().toLocaleString('en-US', { timeZone: 'Africa/Addis_Ababa' }),
        botOnline: true,
        memoryUsage: process.memoryUsage(),
        uptime: process.uptime()
      };

      const uptimeHours = Math.floor(status.uptime / 3600);
      const uptimeMinutes = Math.floor((status.uptime % 3600) / 60);

      const message = `📈 <b>SYSTEM STATUS</b> 📈\n\n` +
                     `🤖 <b>Bot:</b> ✅ Online\n` +
                     `⏰ <b>Time:</b> ${status.ethiopianTime} (ET)\n` +
                     `🕐 <b>Uptime:</b> ${uptimeHours}h ${uptimeMinutes}m\n` +
                     `💾 <b>Memory:</b> ${Math.round(status.memoryUsage.used / 1024 / 1024)}MB\n\n` +
        `📱 <b>Channel:</b> ${process.env.CHANNEL_ID || '@africansportdata'}\n` +
                     `🌍 <b>Timezone:</b> Africa/Addis_Ababa\n` +
                     `🔧 <b>Version:</b> Simple Bot v1.0\n\n` +
                     `✅ All systems operational`;

      await this.bot.sendMessage(chatId, message, { parse_mode: 'HTML' });

    } catch (error) {
      console.error('❌ Status error:', error);
      await this.bot.sendMessage(chatId, '❌ Failed to get status: ' + error.message);
    }
  }

  // 📊 Show analytics report with click tracking
  async showAnalyticsReport(chatId) {
    try {
      // Check if system is running first
      const baseUrl = this.getBaseUrl();

      // Fetch analytics data from API
      const analyticsUrl = `${baseUrl}/api/analytics`;
      const axios = require('axios');
      
      const response = await axios.get(analyticsUrl);
      const data = response.data;
      
      if (!data.success) {
        await this.bot.sendMessage(chatId, 
                  '⚠️ <b>Analytics Not Available</b>\n\n' +
        'System needs to be running to view analytics data.\n' +
        'Start the system with /api/start and try again.',
          { parse_mode: 'HTML' }
        );
        return;
      }

      // Build analytics message in Hebrew
      const overview = data.overview;
      const dailyStats = data.dailyStats;
      const topButtons = data.clickTracking.topButtons;
      
    let message = `📊 <b>SportMaster Analytics Report</b> 📊\n\n`;
      
      // System overview
      message += `🔥 <b>Overview:</b>\n`;
      message += `📡 Status: ${overview.systemStatus}\n`;
      message += `📝 Messages Posted: ${overview.totalMessagesPosted}\n`;
      message += `👆 Total Clicks: ${overview.totalClicks}\n`;
      message += `📈 Average CTR: ${overview.averageCTR}\n\n`;
      
      // Daily stats
      message += `📅 <b>Today's Data:</b>\n`;
      message += `⚽ Predictions: ${dailyStats.predictions.posted} (${dailyStats.predictions.clicks} clicks)\n`;
      message += `📊 Results: ${dailyStats.results.posted} (${dailyStats.results.clicks} clicks)\n`;
      message += `🎁 Promos: ${dailyStats.promos.posted} (${dailyStats.promos.clicks} clicks)\n\n`;
      
      // Top performing content
      if (overview.topPerformingContent && overview.topPerformingContent.length > 0) {
        message += `🏆 <b>Best Performing Content:</b>\n`;
        overview.topPerformingContent.slice(0, 3).forEach((content, index) => {
          const emoji = index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉';
          message += `${emoji} ${content.type}: ${content.clicks} clicks (${content.ctr})\n`;
        });
        message += '\n';
      }
      
      // Recent activity
      if (data.clickTracking.recentActivity && data.clickTracking.recentActivity.length > 0) {
        message += `🔔 <b>Recent Activity:</b>\n`;
        data.clickTracking.recentActivity.slice(0, 5).forEach(activity => {
          const time = new Date(activity.timestamp).toLocaleTimeString('he-IL', {
            timeZone: 'Africa/Addis_Ababa',
            hour: '2-digit',
            minute: '2-digit'
          });
          message += `• ${activity.type} (${time}): ${activity.clicks} clicks\n`;
        });
        message += '\n';
      }
      
      // Performance recommendations
      if (data.recommendations && data.recommendations.length > 0) {
        message += `💡 <b>Recommendations:</b>\n`;
        data.recommendations.slice(0, 2).forEach(rec => {
          const priorityEmoji = rec.priority === 'high' ? '🔴' : rec.priority === 'medium' ? '🟡' : '🟢';
          message += `${priorityEmoji} ${rec.message}\n`;
        });
        message += '\n';
      }
      
      message += `⏰ <b>Last Updated:</b> ${new Date().toLocaleString('en-US', { 
        timeZone: 'Africa/Addis_Ababa' 
      })}\n`;
      message += `🌍 <b>Timezone:</b> Ethiopia`;

      // Create interactive buttons
      const keyboard = {
        inline_keyboard: [
          [
            { text: '🔄 Refresh Data', callback_data: 'cmd_analytics' },
            { text: '📈 System Status', callback_data: 'cmd_status' }
          ],
          [
            { text: '🏠 Main Menu', callback_data: 'cmd_menu' }
          ]
        ]
      };

      await this.bot.sendMessage(chatId, message, { 
        parse_mode: 'HTML',
        reply_markup: keyboard
      });

    } catch (error) {
      console.error('❌ Analytics error:', error);
      
      let errorMessage = '❌ <b>Error Getting Analytics Data</b>\n\n';
      
      if (error.code === 'ECONNREFUSED' || error.response?.status === 400) {
        errorMessage += 'System is not currently active.\n';
        errorMessage += 'Start the system with:\n';
        errorMessage += '• /api/start\n';
        errorMessage += '• Or click the Main Menu button';
      } else {
        errorMessage += `Error: ${error.message}\n`;
        errorMessage += 'Try again in a few minutes.';
      }

      await this.bot.sendMessage(chatId, errorMessage, { parse_mode: 'HTML' });
    }
  }

  // ==============================
  // CHANNEL OWNER COMMAND HANDLERS
  // ==============================

  // Get the channel owned by this Telegram user
  async getOwnedChannel(userId) {
    try {
      const { supabase } = require('./supabase');
      if (!supabase) return null;
      const { data } = await supabase
        .from('channels')
        .select('*')
        .eq('owner_user_id', userId)
        .eq('active', true)
        .single();
      return data;
    } catch (_) {
      return null;
    }
  }

  // /mychannel - Show channel info to its owner
  async handleMyChannel(msg) {
    const userId = msg.from.id;
    const chatId = msg.chat.id;

    // Admins can also see this - but channel owners who aren't admins can too
    const channel = await this.getOwnedChannel(userId);

    if (!channel && !this.isAdmin(userId)) {
      return this.bot.sendMessage(chatId,
        '🔒 <b>No channel assigned</b>\n\n' +
        `Your Telegram ID: <code>${userId}</code>\n` +
        'Ask the admin to assign you as a channel owner.',
        { parse_mode: 'HTML' }
      );
    }

    if (!channel && this.isAdmin(userId)) {
      // Admin without owned channel - show all channels
      try {
        const { supabase } = require('./supabase');
        const { data: channels } = await supabase.from('channels').select('*').eq('active', true);
        if (!channels || channels.length === 0) {
          return this.bot.sendMessage(chatId, '📡 No active channels configured.', { parse_mode: 'HTML' });
        }
        let text = '📡 <b>All Active Channels</b>\n\n';
        channels.forEach((ch, i) => {
          text += `${i + 1}. <b>${ch.display_name}</b> (${ch.channel_id})\n`;
          text += `   Language: ${ch.language} | Coupon: ${ch.coupon_code}\n`;
          text += `   Owner: ${ch.owner_user_id || 'Not set'}\n\n`;
        });
        return this.bot.sendMessage(chatId, text, { parse_mode: 'HTML' });
      } catch (err) {
        return this.bot.sendMessage(chatId, '❌ Error: ' + err.message, { parse_mode: 'HTML' });
      }
    }

    const langNames = { en: 'English', am: 'Amharic', sw: 'Swahili', fr: 'French', ar: 'Arabic', pt: 'Portuguese', es: 'Spanish' };

    const text =
      `📡 <b>Your Channel: ${channel.display_name}</b>\n\n` +
      `🆔 Channel: <code>${channel.channel_id}</code>\n` +
      `🌐 Language: <b>${langNames[channel.language] || channel.language}</b>\n` +
      `🎫 Coupon: <b>${channel.coupon_code}</b>\n` +
      `🎁 Bonus: <b>${channel.bonus_offer}</b>\n` +
      `🕐 Timezone: <b>${channel.timezone}</b>\n` +
      `⚽ Leagues: <b>${channel.leagues?.length || 'All popular'}</b>\n` +
      `🔘 Buttons: <b>${channel.buttons?.length || 0}</b>\n\n` +
      `<i>Use /setcoupon, /setbonus, /setlanguage to update</i>`;

    return this.bot.sendMessage(chatId, text, { parse_mode: 'HTML' });
  }

  // /setcoupon CODE
  async handleSetCoupon(msg, newCode) {
    const userId = msg.from.id;
    const chatId = msg.chat.id;
    const channel = await this.getOwnedChannel(userId);

    if (!channel) {
      return this.bot.sendMessage(chatId, '🔒 No channel assigned to you. Ask the admin.', { parse_mode: 'HTML' });
    }

    if (!newCode) {
      return this.bot.sendMessage(chatId,
        `🎫 Current coupon: <b>${channel.coupon_code}</b>\n\nUsage: <code>/setcoupon NEWCODE</code>`,
        { parse_mode: 'HTML' }
      );
    }

    try {
      const { supabase } = require('./supabase');
      await supabase
        .from('channels')
        .update({ coupon_code: newCode, updated_at: new Date().toISOString() })
        .eq('id', channel.id);

      try { require('./channel-config').invalidateCache(); } catch (_) {}

      return this.bot.sendMessage(chatId,
        `✅ <b>Coupon updated!</b>\n\n${channel.coupon_code} → <b>${newCode}</b>\n\nNew messages will use this coupon code.`,
        { parse_mode: 'HTML' }
      );
    } catch (err) {
      return this.bot.sendMessage(chatId, '❌ Failed to update: ' + err.message, { parse_mode: 'HTML' });
    }
  }

  // /setbonus OFFER
  async handleSetBonus(msg, newBonus) {
    const userId = msg.from.id;
    const chatId = msg.chat.id;
    const channel = await this.getOwnedChannel(userId);

    if (!channel) {
      return this.bot.sendMessage(chatId, '🔒 No channel assigned to you.', { parse_mode: 'HTML' });
    }

    if (!newBonus) {
      return this.bot.sendMessage(chatId,
        `🎁 Current bonus: <b>${channel.bonus_offer}</b>\n\nUsage: <code>/setbonus 200% Welcome Bonus</code>`,
        { parse_mode: 'HTML' }
      );
    }

    try {
      const { supabase } = require('./supabase');
      await supabase
        .from('channels')
        .update({ bonus_offer: newBonus, updated_at: new Date().toISOString() })
        .eq('id', channel.id);

      try { require('./channel-config').invalidateCache(); } catch (_) {}

      return this.bot.sendMessage(chatId,
        `✅ <b>Bonus updated!</b>\n\n${channel.bonus_offer} → <b>${newBonus}</b>`,
        { parse_mode: 'HTML' }
      );
    } catch (err) {
      return this.bot.sendMessage(chatId, '❌ Failed to update: ' + err.message, { parse_mode: 'HTML' });
    }
  }

  // /setlanguage CODE
  async handleSetLanguage(msg, langCode) {
    const userId = msg.from.id;
    const chatId = msg.chat.id;
    const channel = await this.getOwnedChannel(userId);

    if (!channel) {
      return this.bot.sendMessage(chatId, '🔒 No channel assigned to you.', { parse_mode: 'HTML' });
    }

    const validLangs = { en: 'English', am: 'Amharic', sw: 'Swahili', fr: 'French', ar: 'Arabic', pt: 'Portuguese', es: 'Spanish' };

    if (!langCode || !validLangs[langCode]) {
      return this.bot.sendMessage(chatId,
        `🌐 Current language: <b>${validLangs[channel.language] || channel.language}</b>\n\n` +
        `Usage: <code>/setlanguage CODE</code>\n\n` +
        `Available:\n` +
        Object.entries(validLangs).map(([code, name]) => `• <code>${code}</code> — ${name}`).join('\n'),
        { parse_mode: 'HTML' }
      );
    }

    try {
      const { supabase } = require('./supabase');
      await supabase
        .from('channels')
        .update({ language: langCode, updated_at: new Date().toISOString() })
        .eq('id', channel.id);

      try { require('./channel-config').invalidateCache(); } catch (_) {}

      return this.bot.sendMessage(chatId,
        `✅ <b>Language updated!</b>\n\n${validLangs[channel.language]} → <b>${validLangs[langCode]}</b>\n\nAll new content will be generated in ${validLangs[langCode]}.`,
        { parse_mode: 'HTML' }
      );
    } catch (err) {
      return this.bot.sendMessage(chatId, '❌ Failed to update: ' + err.message, { parse_mode: 'HTML' });
    }
  }

  // /mylink - Get portal link
  async handleMyLink(msg) {
    const userId = msg.from.id;
    const chatId = msg.chat.id;
    const channel = await this.getOwnedChannel(userId);

    if (!channel) {
      return this.bot.sendMessage(chatId, '🔒 No channel assigned to you.', { parse_mode: 'HTML' });
    }

    if (!channel.owner_token) {
      return this.bot.sendMessage(chatId, '⚠️ No portal token generated. Contact the admin.', { parse_mode: 'HTML' });
    }

    const portalUrl = `${this.getBaseUrl()}/portal/${channel.owner_token}`;

    return this.bot.sendMessage(chatId,
      `🔗 <b>Your Channel Portal</b>\n\n` +
      `<a href="${portalUrl}">Open Portal</a>\n\n` +
      `⚠️ <i>This link is private — don't share it with others.</i>`,
      { parse_mode: 'HTML', disable_web_page_preview: true }
    );
  }

  // /mystats - View channel stats
  async handleMyStats(msg) {
    const userId = msg.from.id;
    const chatId = msg.chat.id;
    const channel = await this.getOwnedChannel(userId);

    if (!channel) {
      return this.bot.sendMessage(chatId, '🔒 No channel assigned to you.', { parse_mode: 'HTML' });
    }

    try {
      const { supabase } = require('./supabase');
      const today = new Date().toISOString().split('T')[0];

      // Total posts
      const { count: totalPosts } = await supabase
        .from('posts')
        .select('*', { count: 'exact', head: true })
        .eq('channel_id', channel.channel_id);

      // Today's posts
      const { count: todayPosts } = await supabase
        .from('posts')
        .select('*', { count: 'exact', head: true })
        .eq('channel_id', channel.channel_id)
        .gte('created_at', today);

      // Clicks
      const { count: clicks } = await supabase
        .from('button_analytics')
        .select('*', { count: 'exact', head: true })
        .eq('channel_id', channel.channel_id);

      return this.bot.sendMessage(chatId,
        `📊 <b>Stats for ${channel.display_name}</b>\n\n` +
        `📝 Total posts: <b>${totalPosts || 0}</b>\n` +
        `📅 Today's posts: <b>${todayPosts || 0}</b>\n` +
        `🔗 Total clicks: <b>${clicks || 0}</b>`,
        { parse_mode: 'HTML' }
      );
    } catch (err) {
      return this.bot.sendMessage(chatId, '❌ Error getting stats: ' + err.message, { parse_mode: 'HTML' });
    }
  }

  // 🚀 Start the bot
  async start() {
    try {
      this.setupCommands();
      
      // Set bot commands in Telegram
      await this.setBotCommands();
      
      // Set webhook or start polling based on environment
      if (process.env.VERCEL === '1') {
        console.log('🌐 Bot running in webhook mode (Vercel)');
        console.log('🔄 Force updating webhook to ensure latest deployment...');
        // Force webhook update on every start to ensure latest URL
        await this.setupWebhook();
      } else {
        await this.bot.startPolling();
        console.log('🚀 Bot polling started successfully');
      }
      
      return true;
    } catch (error) {
      console.error('❌ Failed to start bot:', error);
      return false;
    }
  }

  // 🛑 Stop the bot
  async stop() {
    try {
      await this.bot.stopPolling();
      console.log('🛑 Bot stopped successfully');
      return true;
    } catch (error) {
      console.error('❌ Failed to stop bot:', error);
      return false;
    }
  }

  // 🎯 Command handlers for direct calls
  async handlePredictionsCommand(msg) {
    // Early global cooldown guard: do not enqueue work while cooling down
    try {
      const { isCooldownActive } = require('./cooldown');
      const COOLDOWN_MS = 15 * 60 * 1000;
      const cdKey = 'predictions-global';
      if (await isCooldownActive(cdKey, COOLDOWN_MS)) {
        await this.bot.sendMessage(msg.chat.id, '⏳ Predictions are in cooldown. Please try again later.');
        return;
      }
    } catch (_) {}

    await this.bot.sendMessage(msg.chat.id, '⚽ <i>Processing predictions request...</i>', { parse_mode: 'HTML' });
    await this.executePredictions(msg.chat.id);
  }

  async handlePromoCommand(msg) {
    await this.bot.sendMessage(msg.chat.id, '🎁 <i>Processing promo request...</i>', { parse_mode: 'HTML' });
    await this.executePromo(msg.chat.id);
  }

  async handleResultsCommand(msg) {
    await this.bot.sendMessage(msg.chat.id, '📊 <i>Processing results request...</i>', { parse_mode: 'HTML' });
    await this.executeResults(msg.chat.id);
  }

  async handleSummaryCommand(msg) {
    // Early cooldown guard for summary
    try {
      const { isCooldownActive } = require('./cooldown');
      const COOLDOWN_MS = 30 * 60 * 1000;
      const cdKey = 'summary-global';
      if (await isCooldownActive(cdKey, COOLDOWN_MS)) {
        await this.bot.sendMessage(msg.chat.id, '⏳ Summary is in cooldown. Please try again later.');
        return;
      }
    } catch (_) {}

    await this.bot.sendMessage(msg.chat.id, '📋 <i>Generating summary...</i>', { parse_mode: 'HTML' });
    await this.executeSummary(msg.chat.id);
  }

  async handleStatusCommand(msg) {
    await this.showSystemStatus(msg.chat.id);
  }

  async handleTodayCommand(msg) {
    await this.showTodayGames(msg.chat.id);
  }

  async handleLiveCommand(msg) {
    await this.showLiveMatches(msg.chat.id);
  }

  async handleHelpCommand(msg) {
    const helpMessage = `🤖 <b>SportMaster Admin Bot - Commands List</b>\n\n` +
      `🏠 <b>/start</b> or <b>/menu</b> - Main menu with buttons\n` +
      `❓ <b>/help</b> - Show this commands list\n\n` +
      `⚽ <b>/predictions</b> - Send match predictions to channel\n` +
      `📊 <b>/results</b> - Send match results to channel\n` +
      `🎁 <b>/promo</b> - Send promo message to channel\n` +
      `📋 <b>/summary</b> - Send daily summary (manual)\n\n` +
      `🔴 <b>/live</b> - View live matches now\n` +
      `📅 <b>/today</b> - View today's games\n` +
      `📈 <b>/status</b> - Check system status\n` +
      `📊 <b>/analytics</b> - View click analytics and stats\n` +
      `🧩 <b>/buttons</b> - Configure inline buttons\n` +
      `🎟️ <b>/coupon</b> - Configure coupon code/offer\n\n` +
      `🆘 <b>/emergency_stop</b> or <b>/stop</b> - 🚨 EMERGENCY STOP - Stops all bot operations\n\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `🔑 <b>Only authorized admins can use this bot</b>\n` +
      `📱 <b>Channel:</b> ${process.env.CHANNEL_ID || '@africansportdata'}\n` +
      `⏰ <b>Time:</b> ${new Date().toLocaleString('en-US', { timeZone: 'Africa/Addis_Ababa' })}`;

    await this.bot.sendMessage(msg.chat.id, helpMessage, { parse_mode: 'HTML' });
  }

  async handleAnalyticsCommand(msg) {
    await this.bot.sendMessage(msg.chat.id, '📊 <i>Loading analytics data...</i>', { parse_mode: 'HTML' });
    await this.showAnalyticsReport(msg.chat.id);
  }

  // Wizard: Buttons configuration (step-by-step, inline)
  async startButtonsWizard(chatId, messageId) {
    const { setState, getState, clearState } = require('./wizard-state');
    await setState(chatId, { type: 'buttons', step: 1, awaiting: 'b1_text', data: {} });
    await this.bot.editMessageText('🧩 Step 1/4: Choose text for Button 1', {
      chat_id: chatId, message_id: messageId, parse_mode: 'HTML',
      reply_markup: { inline_keyboard: [[
        { text: '⚽ Football', callback_data: 'wiz:text:⚽ Football' },
        { text: '🔴 Live', callback_data: 'wiz:text:🔴 Live' }
      ], [{ text: '🎁 Coupon', callback_data: 'wiz:text:🎁 Coupon' }],
      [{ text: '✍️ Type Text', callback_data: 'wiz:text:custom' }]] }
    });
  }

  async startCouponWizard(chatId, messageId) {
    const { setState } = require('./wizard-state');
    await setState(chatId, { type: 'coupon', step: 1, awaiting: 'coupon_code', data: {} });
    await this.bot.editMessageText('🎟️ Step 1/3: Choose coupon code', {
      chat_id: chatId, message_id: messageId,
      reply_markup: { inline_keyboard: [[
        { text: 'gize251', callback_data: 'wiz:coupon:1:code:gize251' },
        { text: 'gize200', callback_data: 'wiz:coupon:1:code:gize200' }
      ], [{ text: '✍️ Type code', callback_data: 'wiz:coupon:1:code:custom' }]] }
    });
  }

  async handleCouponConfig(msg) {
    const chatId = msg.chat.id;
    const { setCoupon } = require('./settings-store');
    await this.bot.sendMessage(chatId, '🎟️ Send coupon update in format: code | offer | scope\nScope: once/persist (default persist)\nExample: gize251 | 100 ETB Bonus | persist', { reply_markup: { force_reply: true } });
    this.bot.once('message', async (reply) => {
      try {
        if (!reply.text || !reply.text.includes('|')) {
          return this.bot.sendMessage(chatId, '❌ Invalid format. Cancelled.');
        }
        const parts = reply.text.split('|').map(s => s.trim());
        const code = parts[0];
        const offer = parts[1] || 'Bonus';
        const scope = (parts[2] || 'persist').toLowerCase().startsWith('o') ? 'once' : 'persist';
        await setCoupon({ code, offer }, scope);
        await this.bot.sendMessage(chatId, `✅ Coupon updated (${scope}). Code: ${code}, Offer: ${offer}`);
      } catch (e) {
        await this.bot.sendMessage(chatId, `❌ Failed: ${e.message}`);
      }
    });
  }

  async handleButtonsConfig(msg) {
    const chatId = msg.chat.id;
    const { setButtons } = require('./settings-store');
    const template = `🧩 Send buttons JSON (1-3 buttons), or simple format.\n\n` +
      `JSON example:\n` +
      `[{"text":"⚽ Football","url":"https://t.me/Sportmsterbot?start=football"},{"text":"🔴 Live","url":"https://t.me/Sportmsterbot?start=live"},{"text":"🎁 Coupon","url":"https://t.me/Sportmsterbot?start=promo"}]\n\n` +
      `Simple format (semicolon separated rows, comma separated buttons):\n` +
      `Football=https://t.me/Sportmsterbot?start=football, Live=https://t.me/Sportmsterbot?start=live, Coupon=https://t.me/Sportmsterbot?start=promo\n\n` +
      `Add scope at the end: | once or | persist (default persist)`;
    await this.bot.sendMessage(chatId, template, { reply_markup: { force_reply: true } });
    this.bot.once('message', async (reply) => {
      try {
        let scope = 'persist';
        let text = reply.text || '';
        if (text.includes('|')) {
          const [main, scopeRaw] = text.split('|');
          text = main.trim();
          scope = (scopeRaw || '').trim().toLowerCase().startsWith('o') ? 'once' : 'persist';
        }
        let buttons;
        if (text.trim().startsWith('[')) {
          try { buttons = JSON.parse(text); } catch (_) {}
        }
        if (!buttons) {
          const parts = text.split(',');
          buttons = parts.map(p => {
            const [label, url] = p.split('=').map(s => (s || '').trim());
            return label && url ? { text: label, url } : null;
          }).filter(Boolean).slice(0,3);
        }
        if (!Array.isArray(buttons) || buttons.length === 0) {
          return this.bot.sendMessage(chatId, '❌ Invalid buttons input. Cancelled.');
        }
        await setButtons(buttons, scope);
        await this.bot.sendMessage(chatId, `✅ Buttons updated (${scope}).`);
      } catch (e) {
        await this.bot.sendMessage(chatId, `❌ Failed: ${e.message}`);
      }
    });
  }

  // 📝 Set official bot commands in Telegram
  async setBotCommands() {
    try {
      // Public commands — visible to all users
      const publicCommands = [
        { command: 'start', description: 'Start the bot' },
        { command: 'help', description: 'How to use this bot' },
      ];

      // Owner commands — for channel owners
      const ownerCommands = [
        { command: 'start', description: 'Start the bot' },
        { command: 'mychannel', description: 'View my channel settings' },
        { command: 'setcoupon', description: 'Set coupon code' },
        { command: 'setbonus', description: 'Set bonus offer text' },
        { command: 'setlanguage', description: 'Set channel language' },
        { command: 'mylink', description: 'Get my portal link' },
        { command: 'mystats', description: 'View my channel stats' },
        { command: 'help', description: 'How to use this bot' },
      ];

      // Admin commands — full control
      const adminCommands = [
        { command: 'menu', description: 'Open admin control panel' },
        { command: 'predictions', description: 'Send predictions now' },
        { command: 'results', description: 'Send results now' },
        { command: 'promo', description: 'Send promo now' },
        { command: 'live', description: 'Show live matches' },
        { command: 'today', description: 'Show today\'s matches' },
        { command: 'news', description: 'Send news update' },
        { command: 'status', description: 'System status' },
        { command: 'analytics', description: 'View analytics' },
        { command: 'coupon', description: 'Coupon wizard' },
        { command: 'buttons', description: 'Button wizard' },
        { command: 'summary', description: 'Send daily summary' },
        { command: 'stop', description: 'Emergency stop' },
        { command: 'help', description: 'All commands' },
      ];

      // Default scope — public commands for everyone
      await this.bot.setMyCommands(publicCommands);
      console.log('✅ Public commands set (default scope)');

      // All private chats — public commands
      try {
        await this.bot.setMyCommands(publicCommands, { scope: { type: 'all_private_chats' } });
        console.log('✅ Commands set for all private chats');
      } catch (e) {
        console.log('⚠️ Could not set commands for all_private_chats:', e.message);
      }

      // All group chats — public commands
      try {
        await this.bot.setMyCommands(publicCommands, { scope: { type: 'all_group_chats' } });
        console.log('✅ Commands set for all group chats');
      } catch (e) {
        console.log('⚠️ Could not set commands for all_group_chats:', e.message);
      }

      // Admin users — full admin commands
      for (const adminId of this.adminUsers) {
        try {
          await this.bot.setMyCommands(adminCommands, {
            scope: { type: 'chat', chat_id: adminId }
          });
          console.log(`✅ Admin commands set for ${adminId}`);
        } catch (error) {
          console.log(`⚠️ Could not set commands for admin ${adminId}:`, error.message);
        }
      }

      // Channel owners — owner commands (fetch from Supabase)
      try {
        const { supabase } = require('./supabase');
        if (supabase) {
          const { data: channels } = await supabase
            .from('channels')
            .select('owner_user_id')
            .not('owner_user_id', 'is', null);
          const ownerIds = new Set((channels || []).map(c => String(c.owner_user_id)).filter(Boolean));
          // Remove admins (they already have full commands)
          const adminSet = new Set(this.adminUsers.map(String));
          for (const ownerId of ownerIds) {
            if (adminSet.has(ownerId)) continue;
            try {
              await this.bot.setMyCommands(ownerCommands, {
                scope: { type: 'chat', chat_id: Number(ownerId) }
              });
              console.log(`✅ Owner commands set for ${ownerId}`);
            } catch (e) {
              console.log(`⚠️ Could not set commands for owner ${ownerId}:`, e.message);
            }
          }
        }
      } catch (e) {
        console.log('⚠️ Could not fetch owners for command scopes:', e.message);
      }

    } catch (error) {
      console.error('❌ Failed to set bot commands:', error);
    }
  }

  // 🗑️ Clear old commands (helper function)
  async clearBotCommands() {
    try {
      await this.bot.setMyCommands([]);
      console.log('✅ Bot commands cleared');
    } catch (error) {
      console.error('❌ Failed to clear bot commands:', error);
    }
  }

  // 🌐 Setup webhook automatically in production
  async setupWebhook() {
    try {
      const token = process.env.TELEGRAM_BOT_TOKEN;
      if (!token) {
        console.error('❌ TELEGRAM_BOT_TOKEN not configured');
        return false;
      }

      const baseUrl = `https://api.telegram.org/bot${token}`;
      // FORCE use of stable domain - ignore VERCEL_URL temporary URLs
      const webhookUrl = process.env.PUBLIC_BASE_URL 
        ? `${process.env.PUBLIC_BASE_URL}/api/webhook/telegram`
        : 'https://idosegev23.vercel.app/api/webhook/telegram'; // Always use our stable domain

      console.log('🌐 Setting up webhook:', webhookUrl);

      const response = await fetch(`${baseUrl}/setWebhook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: webhookUrl,
          secret_token: process.env.TELEGRAM_WEBHOOK_SECRET || undefined
        })
      });

      const data = await response.json();
      
      if (data.ok) {
        console.log('✅ Webhook configured successfully');
        return true;
      } else {
        console.error('❌ Failed to configure webhook:', data);
        return false;
      }
    } catch (error) {
      console.error('❌ Webhook setup error:', error);
      return false;
    }
  }

  // 🆘 EMERGENCY STOP - Stops everything immediately
  async emergencyStop(chatId) {
    try {
      console.log('🆘 EMERGENCY STOP ACTIVATED by admin:', chatId);
      
      // Send immediate confirmation
      await this.bot.sendMessage(chatId, 
        '🆘 <b>EMERGENCY STOP ACTIVATED!</b>\n\n' +
        '⏹️ Stopping all bot operations...\n' +
        '🔄 This may take a few seconds...',
        { parse_mode: 'HTML' }
      );

      // 1. Delete webhook to stop receiving messages
      console.log('🔄 Step 1: Deleting webhook...');
      const token = process.env.TELEGRAM_BOT_TOKEN;
      const deleteResponse = await fetch(`https://api.telegram.org/bot${token}/deleteWebhook`, {
        method: 'POST'
      });
      const deleteData = await deleteResponse.json();
      console.log('🔄 Webhook deletion result:', deleteData);

      // 2. Try to stop any running processes via API
      console.log('🔄 Step 2: Stopping system processes...');
      const baseUrl = process.env.NODE_ENV === 'development' 
        ? 'http://localhost:3000' 
        : (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://sportmasterbot-ccv2r9g0q-idosegev23s-projects.vercel.app');

      try {
        await fetch(`${baseUrl}/api/stop`, { 
          method: 'POST',
          timeout: 5000 
        });
      } catch (error) {
        console.log('⚠️ Stop API call failed (expected in serverless):', error.message);
      }

      // 3. Send final status
      await this.bot.sendMessage(chatId,
        '✅ <b>EMERGENCY STOP COMPLETED!</b>\n\n' +
        '🔴 <b>Status:</b>\n' +
        '• ✅ Webhook deleted\n' +
        '• ✅ Bot operations stopped\n' +
        '• ✅ System processes terminated\n\n' +
        '🔄 <b>To restart:</b>\n' +
        '• Run webhook fix: /api/fix-webhook\n' +
        '• Or send /start to reactivate\n\n' +
        '⚠️ <b>Bot is now OFFLINE until manual restart!</b>',
        { 
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [[
              { text: '🔄 Restart Bot', url: (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}/api/fix-webhook` : 'https://sportmasterbot-ccv2r9g0q-idosegev23s-projects.vercel.app/api/fix-webhook') }
            ]]
          }
        }
      );

      console.log('🆘 Emergency stop completed successfully');
      return true;

    } catch (error) {
      console.error('❌ Emergency stop error:', error);
      
      try {
        await this.bot.sendMessage(chatId,
          '❌ <b>Emergency Stop Failed!</b>\n\n' +
          `Error: ${error.message}\n\n` +
          '⚠️ Bot may still be partially active!\n' +
          'Manual intervention required.',
          { parse_mode: 'HTML' }
        );
      } catch (sendError) {
        console.error('❌ Failed to send error message:', sendError);
      }
      
      return false;
    }
  }

  // 🎯 Post a single Personal Coupons button to the channel
  async executePersonalButton(chatId) {
    try {
      const channelConfig = await this.getOwnedChannel(chatId);
      const TelegramManager = require('./telegram');
      const telegram = new TelegramManager();
      const targetChannel = channelConfig?.channel_id || telegram.channelId;
      const text = '🎟️ <b>Personal Coupons</b>\n\nTap to receive personalized coupons in DM:';
      const keyboard = [[{ text: '👤 Get Personal Coupons', url: 'https://t.me/Sportmsterbot?start=join_personal' }]];
      const msg = await telegram.bot.sendMessage(targetChannel, text, {
        parse_mode: 'HTML',
        reply_markup: { inline_keyboard: keyboard },
        disable_web_page_preview: true
      });
      await telegram.logPostToSupabase('promo', text, msg.message_id, {}, channelConfig);
      await this.bot.sendMessage(chatId, `✅ Personal Coupons button posted to <b>${targetChannel}</b>.`, { parse_mode: 'HTML' });
    } catch (e) {
      console.error('❌ executePersonalButton error:', e);
      await this.bot.sendMessage(chatId, '❌ Failed to post personal button: ' + (e.message || e));
    }
  }

  // 📰 Execute news — channel-aware, with image support
  async executeNews(chatId) {
    try {
      const channelConfig = await this.getOwnedChannel(chatId);
      const TelegramManager = require('./telegram');
      const telegram = new TelegramManager();
      const targetChannel = channelConfig?.channel_id || telegram.channelId;

      await this.bot.sendMessage(chatId, '📰 Fetching latest sports news...');

      const NewsFetcher = require('./news-fetcher');
      const newsFetcher = new NewsFetcher();
      const result = await newsFetcher.fetchLatestNews(1);

      if (!result) {
        await this.bot.sendMessage(chatId, '❌ No news found.');
        return;
      }

      const content = typeof result === 'string' ? result : result.content;
      const originalItem = result.originalItem || null;

      if (!content) {
        await this.bot.sendMessage(chatId, '❌ No news content generated.');
        return;
      }

      await telegram.sendNews(content, originalItem, channelConfig);
      await this.bot.sendMessage(chatId, `✅ News sent to <b>${targetChannel}</b>!`, { parse_mode: 'HTML' });
    } catch (e) {
      console.error('❌ executeNews error:', e);
      await this.bot.sendMessage(chatId, '❌ Failed: ' + (e.message || e));
    }
  }

  // 🎯 Execute Send Targeted - send targeted coupons
  async executeSendTargeted(chatId) {
    try {
      await this.bot.sendMessage(chatId, '🎯 Starting targeted coupons process...');

      const axios = require('axios');
      const baseUrl = this.getBaseUrl();

      const response = await axios.post(`${baseUrl}/api/admin/send-personal-coupons`, {}, {
        headers: { 'x-bot-internal': 'true' },
        timeout: 60000
      });
      
      if (response.data.success) {
        await this.bot.sendMessage(chatId, `✅ Targeted coupons sent successfully!\n📊 ${response.data.sent || 0} coupons sent to users.`);
      } else {
        await this.bot.sendMessage(chatId, '❌ Failed to send targeted coupons: ' + response.data.message);
      }
      
    } catch (e) {
      console.error('❌ executeSendTargeted error:', e);
      await this.bot.sendMessage(chatId, '❌ Failed to send targeted coupons: ' + (e.message || e));
    }
  }
}

module.exports = SimpleBotCommands;