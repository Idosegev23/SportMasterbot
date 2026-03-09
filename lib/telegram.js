// Telegram Bot Integration for SportMaster — Multi-Channel SaaS
// Handles sending messages to ANY channel with per-channel config

const TelegramBot = require('node-telegram-bot-api');
const ImageGenerator = require('./image-generator.js');
const { supabase } = require('./supabase');

class TelegramManager {
  constructor() {
    const token = (process.env.TELEGRAM_BOT_TOKEN || '').trim();
    if (!token) {
      throw new Error('❌ TELEGRAM_BOT_TOKEN is required');
    }
    this.bot = new TelegramBot(token, {
      polling: false,
      request: { agentOptions: { keepAlive: true, family: 4 } }
    });
    // Default channel (backward compat)
    this.channelId = (process.env.CHANNEL_ID || '').trim();
    this.clickStats = new Map();
    this.imageGenerator = new ImageGenerator();
  }

  // ─── CHANNEL HELPERS ───

  /** Resolve the target channel_id from a channel config or fallback to default */
  resolveChannel(channelConfig) {
    return channelConfig?.channel_id || this.channelId;
  }

  /** Build inline keyboard from channel config or settings-store */
  async buildKeyboard(channelConfig, type = 'predictions') {
    // If channel config has buttons, use them directly
    if (channelConfig?.buttons && channelConfig.buttons.length > 0) {
      const coupon = channelConfig.coupon_code || 'SM100';
      const rows = [];
      // Custom buttons from channel config (max 2 per row)
      for (let i = 0; i < channelConfig.buttons.length; i += 2) {
        const row = channelConfig.buttons.slice(i, i + 2).map(b => ({ text: b.text, url: b.url }));
        rows.push(row);
      }
      rows.push([{ text: `🎁 Enter Coupon ${coupon}`, url: 'https://t.me/Sportmsterbot?start=join_personal' }]);
      rows.push([{ text: '👤 Get Personal Coupons', url: 'https://t.me/Sportmsterbot?start=join' }]);
      return rows;
    }

    // Fallback: use settings-store (for default/legacy channels)
    const keyboardBuilder = {
      predictions: () => this.createPredictionsKeyboard(),
      results: () => this.createResultsKeyboard(),
      promo: (code) => this.createPromoKeyboard(code),
      news: () => this.createNewsKeyboard(),
    };

    if (keyboardBuilder[type]) return keyboardBuilder[type](channelConfig?.coupon_code);
    return this.createPredictionsKeyboard();
  }

  // ─── RETRY ───

  async retryRequest(fn, maxRetries = 3, delayMs = 1000) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        console.log(`❌ Attempt ${attempt} failed:`, error.message);
        if (attempt === maxRetries) throw error;
        if (error.code === 'EFATAL' || error.code === 'ECONNRESET' ||
          error.message.includes('TLS') || error.message.includes('network')) {
          console.log(`🔄 Retrying in ${delayMs}ms...`);
          await new Promise(r => setTimeout(r, delayMs));
          delayMs *= 1.5;
        } else {
          throw error;
        }
      }
    }
  }

  // ─── IMAGE TIMEOUT ───

  async generateImageWithTimeout(imagePromise, description = 'image') {
    const TIMEBOX_MS = Number(process.env.AI_IMAGE_TIMEOUT_MS || 180000);
    console.log(`⏰ Using ${TIMEBOX_MS / 1000}s timeout for ${description} generation`);
    try {
      const imageBuffer = await Promise.race([
        imagePromise,
        new Promise((resolve) => setTimeout(() => resolve(null), TIMEBOX_MS))
      ]);
      if (!imageBuffer) console.log(`⏱️ ${description} generation skipped (timeboxed)`);
      return imageBuffer;
    } catch (e) {
      console.log(`⚠️ ${description} generation failed:`, e.message);
      return null;
    }
  }

  // ─── SEND PREDICTIONS (multi-channel) ───

  async sendPredictions(predictions, matches = null, channelConfig = null) {
    const targetChannel = this.resolveChannel(channelConfig);
    const messageIds = [];

    const getMatchMetadata = (index) => {
      if (!matches || !matches[index]) return {};
      const match = matches[index];
      return {
        homeTeam: match.homeTeam?.name || match.homeTeam,
        awayTeam: match.awayTeam?.name || match.awayTeam,
        competition: match.competition?.name || match.league?.name,
        matchId: match.fixture?.id || match.id,
        kickoffTime: match.fixture?.date || match.date
      };
    };

    if (typeof predictions === 'string') predictions = [predictions];

    try {
      let imageBuffer = null;
      const imagesDisabled = String(process.env.DISABLE_AI_IMAGES || '').toLowerCase() === 'true';
      if (!imagesDisabled && matches && matches.length > 0) {
        console.log('🎨 Generating AI image for predictions...');
        if (String(process.env.AI_IMAGE_NO_TIMEOUT || '').toLowerCase() === 'true') {
          try { imageBuffer = await this.imageGenerator.generatePredictionImage(matches); } catch (_) { imageBuffer = null; }
        } else {
          imageBuffer = await this.generateImageWithTimeout(
            this.imageGenerator.generatePredictionImage(matches), 'prediction image'
          );
        }
      }

      for (let i = 0; i < predictions.length; i++) {
        const prediction = predictions[i];
        await this.retryRequest(async () => {
          const keyboard = await this.buildKeyboard(channelConfig, 'predictions');
          const formattedContent = this.formatSinglePredictionMessage(prediction);

          if (i === 0 && imageBuffer) {
            try {
              const message = await this.bot.sendPhoto(targetChannel, imageBuffer, {
                caption: formattedContent, parse_mode: 'HTML',
                reply_markup: { inline_keyboard: keyboard }
              });
              console.log(`✅ Prediction ${i + 1}/${predictions.length} sent with image to ${targetChannel}`);
              const metadata = { ...getMatchMetadata(i), matchNumber: i + 1, hasImage: true, channel: targetChannel };
              this.trackMessage('predictions', message.message_id, metadata);
              await this.logPostToSupabase('predictions', formattedContent, message.message_id, metadata, channelConfig);
              messageIds.push(message.message_id);
              return;
            } catch (imageError) {
              console.log('⚠️ Failed to send with image, falling back:', imageError.message);
            }
          }

          const message = await this.bot.sendMessage(targetChannel, formattedContent, {
            parse_mode: 'HTML', disable_web_page_preview: true,
            reply_markup: { inline_keyboard: keyboard }
          });
          console.log(`✅ Prediction ${i + 1}/${predictions.length} sent to ${targetChannel}`);
          const metadata = { ...getMatchMetadata(i), matchNumber: i + 1, hasImage: false, channel: targetChannel };
          this.trackMessage('predictions', message.message_id, metadata);
          await this.logPostToSupabase('predictions', formattedContent, message.message_id, metadata, channelConfig);
          messageIds.push(message.message_id);
        });

        if (i < predictions.length - 1) await new Promise(r => setTimeout(r, 1500));
      }

      console.log(`✅ All ${predictions.length} predictions sent to ${targetChannel}`);
      return { messageIds, totalSent: predictions.length };
    } catch (error) {
      console.error(`❌ Error sending predictions to ${targetChannel}:`, error);
      throw error;
    }
  }

  // ─── FORMAT HELPERS ───

  formatSinglePredictionMessage(content) {
    const lines = content.split('\n');
    let formatted = '';
    lines.forEach((line) => {
      if ((line.includes('MATCH') && line.includes('/')) || (line.includes('LIVE MATCH') && line.includes('/'))) {
        formatted += `<b>${line}</b>\n\n`;
      } else if (line.includes('vs') && line.includes('⚽')) {
        formatted += `<b>${line}</b>\n`;
      } else if (line.includes('-') && !line.includes('🔗') && (line.match(/\d+-\d+/))) {
        formatted += `<b>⚽ ${line}</b>\n`;
      } else if (line.includes('🏆')) {
        formatted += `${line}\n`;
      } else if (line.includes('🎯')) {
        formatted += `<b>${line}</b>\n`;
      } else if (line.includes('💡') || line.includes('⚡')) {
        formatted += `<i>${line}</i>\n`;
      } else if (line.includes('💎') || line.includes('🔗') || line.includes('Live code:')) {
        formatted += `\n${line}\n`;
      } else if (line.trim()) {
        formatted += `${line}\n`;
      }
    });
    return formatted.trim();
  }

  formatPredictionsMessage(content) {
    if (content.includes('MATCH') && content.includes('/')) {
      return this.formatSinglePredictionMessage(content);
    }
    let formatted = `<b>🎯 TODAY'S TOP BETTING PREDICTIONS</b>\n\n`;
    const lines = content.split('\n');
    lines.forEach(line => {
      if (line.includes('vs') && (line.includes('Premier League') || line.includes('La Liga') || line.includes('Champions League'))) {
        formatted += `<b>⚽ ${line}</b>\n`;
      } else if (line.includes('Prediction:') || line.includes('Confidence:')) {
        formatted += `<code>${line}</code>\n`;
      } else if (line.trim()) {
        formatted += `${line}\n`;
      } else {
        formatted += `\n`;
      }
    });
    return formatted;
  }

  // ─── SEND LIVE PREDICTIONS (multi-channel) ───

  async sendLivePredictions(predictions, liveMatches = null, channelConfig = null) {
    const targetChannel = this.resolveChannel(channelConfig);
    const messageIds = [];
    if (typeof predictions === 'string') predictions = [predictions];

    try {
      let imageBuffer = null;
      if (liveMatches && liveMatches.length > 0) {
        imageBuffer = await this.generateImageWithTimeout(
          this.imageGenerator.generateLiveImage(liveMatches), 'live image'
        );
      }

      for (let i = 0; i < predictions.length; i++) {
        await this.retryRequest(async () => {
          const keyboard = await this.buildKeyboard(channelConfig, 'predictions');
          const formattedContent = this.formatSinglePredictionMessage(predictions[i]);

          if (i === 0 && imageBuffer) {
            try {
              const message = await this.bot.sendPhoto(targetChannel, imageBuffer, {
                caption: formattedContent, parse_mode: 'HTML',
                reply_markup: { inline_keyboard: keyboard }
              });
              this.trackMessage('live-predictions', message.message_id, { matchNumber: i + 1, hasImage: true, channel: targetChannel });
              await this.logPostToSupabase('live-predictions', formattedContent, message.message_id, {}, channelConfig);
              messageIds.push(message.message_id);
              return;
            } catch (_) {}
          }

          const message = await this.bot.sendMessage(targetChannel, formattedContent, {
            parse_mode: 'HTML', disable_web_page_preview: true,
            reply_markup: { inline_keyboard: keyboard }
          });
          this.trackMessage('live-predictions', message.message_id, { matchNumber: i + 1, channel: targetChannel });
          await this.logPostToSupabase('live-predictions', formattedContent, message.message_id, {}, channelConfig);
          messageIds.push(message.message_id);
        });
        if (i < predictions.length - 1) await new Promise(r => setTimeout(r, 1500));
      }

      console.log(`✅ All ${predictions.length} LIVE predictions sent to ${targetChannel}`);
      return { messageIds, totalSent: predictions.length };
    } catch (error) {
      console.error(`❌ Error sending LIVE predictions to ${targetChannel}:`, error);
      throw error;
    }
  }

  // ─── SEND RESULTS (multi-channel) ───

  async sendResults(content, results = null, channelConfig = null) {
    const targetChannel = this.resolveChannel(channelConfig);
    return await this.retryRequest(async () => {
      const keyboard = await this.buildKeyboard(channelConfig, 'results');
      const formattedContent = this.formatResultsMessage(content);

      let imageBuffer = null;
      if (results && results.length > 0) {
        imageBuffer = await this.generateImageWithTimeout(
          this.imageGenerator.generateResultsImage(results), 'results image'
        );
      }

      if (imageBuffer) {
        try {
          const message = await this.bot.sendPhoto(targetChannel, imageBuffer, {
            caption: formattedContent, parse_mode: 'HTML',
            reply_markup: { inline_keyboard: keyboard }
          });
          this.trackMessage('results', message.message_id, { hasImage: true, channel: targetChannel });
          await this.logPostToSupabase('results', formattedContent, message.message_id, {}, channelConfig);
          return message;
        } catch (_) {}
      }

      const message = await this.bot.sendMessage(targetChannel, formattedContent, {
        parse_mode: 'HTML',
        reply_markup: { inline_keyboard: keyboard },
        disable_web_page_preview: true
      });
      this.trackMessage('results', message.message_id, { hasImage: false, channel: targetChannel });
      await this.logPostToSupabase('results', formattedContent, message.message_id, {}, channelConfig);
      return message;
    });
  }

  // ─── SEND LIVE STATUS (multi-channel) ───

  async sendLiveStatus(content, liveMatches = null, channelConfig = null) {
    const targetChannel = this.resolveChannel(channelConfig);
    return await this.retryRequest(async () => {
      const keyboard = await this.buildKeyboard(channelConfig, 'results');
      const formattedContent = this.formatLiveStatusMessage(content);

      let imageBuffer = null;
      if (liveMatches && liveMatches.length > 0) {
        try { imageBuffer = await this.imageGenerator.generateLiveImage(liveMatches); } catch (_) {}
      }

      if (imageBuffer) {
        try {
          const message = await this.bot.sendPhoto(targetChannel, imageBuffer, {
            caption: formattedContent, parse_mode: 'HTML',
            reply_markup: { inline_keyboard: keyboard }
          });
          this.trackMessage('live-status', message.message_id, { hasImage: true, channel: targetChannel });
          await this.logPostToSupabase('live_status', formattedContent, message.message_id, {}, channelConfig);
          return message;
        } catch (_) {}
      }

      const message = await this.bot.sendMessage(targetChannel, formattedContent, {
        parse_mode: 'HTML', disable_web_page_preview: true,
        reply_markup: { inline_keyboard: keyboard }
      });
      this.trackMessage('live-status', message.message_id, { hasImage: false, channel: targetChannel });
      await this.logPostToSupabase('live_status', formattedContent, message.message_id, {}, channelConfig);
      return message;
    });
  }

  formatLiveStatusMessage(content) {
    if (!content) return '';
    const lines = content.split('\n');
    let formatted = '';
    lines.forEach(line => {
      if (line.startsWith('🔴 ') || line.startsWith('⚡ ')) formatted += `<b>${line}</b>\n\n`;
      else if (line.startsWith('⚽ ')) formatted += `<b>${line}</b>\n`;
      else if (line.startsWith('⏱️')) formatted += `${line}\n\n`;
      else if (line.startsWith('💬')) formatted += `${line}\n`;
      else if (line.trim()) formatted += `${line}\n`;
    });
    return formatted.trim();
  }

  // ─── SEND SUMMARY (multi-channel) ───

  async sendSummary(content, channelConfig = null) {
    const targetChannel = this.resolveChannel(channelConfig);
    return await this.retryRequest(async () => {
      const keyboard = await this.buildKeyboard(channelConfig, 'predictions');
      const message = await this.bot.sendMessage(targetChannel, content, {
        parse_mode: 'HTML', disable_web_page_preview: true,
        reply_markup: { inline_keyboard: keyboard }
      });
      console.log(`✅ Summary sent to ${targetChannel}, Message ID:`, message.message_id);
      this.trackMessage('summary', message.message_id, { channel: targetChannel });
      await this.logPostToSupabase('summary', content, message.message_id, {}, channelConfig);
      return message;
    });
  }

  formatResultsMessage(content) {
    let formatted = `<b>📊 DAILY MATCH RESULTS</b>\n\n`;
    const lines = content.split('\n');
    lines.forEach(line => {
      if (line.includes(' - ') && (line.includes('1') || line.includes('2') || line.includes('3'))) {
        formatted += `<b>⚽ ${line}</b>\n`;
      } else if (line.trim()) {
        formatted += `${line}\n`;
      } else {
        formatted += `\n`;
      }
    });
    return formatted;
  }

  // ─── SEND PROMO (multi-channel) ───

  async sendPromo(content, promoCode, channelConfig = null) {
    const targetChannel = this.resolveChannel(channelConfig);
    return await this.retryRequest(async () => {
      let imageBuffer = null;
      if (promoCode) {
        try {
          imageBuffer = await Promise.race([
            this.imageGenerator.generatePromoImage(promoCode),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Image timeout')), 45000))
          ]);
        } catch (_) {}
      }

      const keyboard = await this.buildKeyboard(channelConfig, 'promo');
      const formattedContent = this.formatPromoMessage(content, promoCode);

      if (imageBuffer) {
        const message = await this.bot.sendPhoto(targetChannel, imageBuffer, {
          caption: formattedContent, parse_mode: 'HTML',
          reply_markup: { inline_keyboard: keyboard }
        });
        this.trackMessage('promo', message.message_id, { promoCode, hasImage: true, channel: targetChannel });
        await this.logPostToSupabase('promo', formattedContent, message.message_id, {}, channelConfig);
        return message;
      }

      const message = await this.bot.sendMessage(targetChannel, formattedContent, {
        parse_mode: 'HTML',
        reply_markup: { inline_keyboard: keyboard },
        disable_web_page_preview: true
      });
      this.trackMessage('promo', message.message_id, { promoCode, hasImage: false, channel: targetChannel });
      await this.logPostToSupabase('promo', formattedContent, message.message_id, {}, channelConfig);
      return message;
    });
  }

  formatPromoMessage(content, promoCode) {
    let formatted = `🎁 <b>Special Offer!</b> 🎁\n\n${content}`;
    if (promoCode && formatted.includes(promoCode)) {
      formatted = formatted.replace(new RegExp(`(${promoCode})`, 'g'), `<code>${promoCode}</code>`);
    }
    formatted = formatted.replace(/(\d+%)/g, '<b>$1</b>');
    formatted = formatted.replace(/(bonus|Bonus|BONUS)/g, '<b>BONUS</b>');
    formatted = formatted.replace(/🔗\s*[^\n]+/g, '');
    return formatted.trim();
  }

  // ─── SEND NEWS (multi-channel) ───

  async sendNews(headlines, originalNewsItem = null, channelConfig = null) {
    const targetChannel = this.resolveChannel(channelConfig);
    return await this.retryRequest(async () => {
      let imageBuffer = null;
      try {
        imageBuffer = await this.generateImageWithTimeout(
          this.imageGenerator.generateNewsImage(originalNewsItem),
          'news'
        );
      } catch (_) {
        try { imageBuffer = await this.imageGenerator.generateFallbackImage('news'); } catch (__) {}
      }

      let newsText;
      const tz = channelConfig?.timezone || 'Africa/Addis_Ababa';
      if (Array.isArray(headlines)) {
        const items = headlines.map((h, i) => `${i + 1}. ${h}`).join('\n\n');
        newsText = `📰 <b>SportMaster Daily News</b>\n\n${items}\n\n⏰ ${new Date().toLocaleString('en-US', { timeZone: tz })}`;
      } else {
        let article = String(headlines);
        // Convert any remaining Markdown to HTML
        article = article
          .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
          .replace(/\*(.+?)\*/g, '<b>$1</b>')
          .replace(/_(.+?)_/g, '<i>$1</i>');
        const timestamp = `\n\n⏰ ${new Date().toLocaleString('en-US', { timeZone: tz })}`;
        const maxLength = 1024 - timestamp.length - 50;
        if (article.length > maxLength) article = article.substring(0, maxLength - 3) + '...';
        newsText = `${article}${timestamp}`;
      }

      const keyboard = await this.buildKeyboard(channelConfig, 'news');

      if (imageBuffer) {
        const message = await this.bot.sendPhoto(targetChannel, imageBuffer, {
          caption: newsText, parse_mode: 'HTML',
          reply_markup: { inline_keyboard: keyboard }
        });
        await this.logPostToSupabase('news', newsText, message.message_id, {}, channelConfig);
        return message;
      }

      const message = await this.bot.sendMessage(targetChannel, newsText, {
        parse_mode: 'HTML',
        disable_web_page_preview: true,
        reply_markup: { inline_keyboard: keyboard }
      });
      await this.logPostToSupabase('news', newsText, message.message_id, {}, channelConfig);
      return message;
    });
  }

  // ─── SEND AVIATOR (multi-channel) ───

  async sendAviator(content, variant = 'session', promoCode = 'SM100', channelConfig = null) {
    const targetChannel = this.resolveChannel(channelConfig);
    return await this.retryRequest(async () => {
      const keyboard = await this.buildKeyboard(channelConfig, 'promo');
      let imageBuffer = null;
      try { imageBuffer = await this.imageGenerator.generateAviatorImage(variant, promoCode); } catch (_) {}

      if (imageBuffer) {
        try {
          const message = await this.bot.sendPhoto(targetChannel, imageBuffer, {
            caption: content, parse_mode: 'HTML',
            reply_markup: { inline_keyboard: keyboard }
          });
          this.trackMessage(`aviator-${variant}`, message.message_id, { hasImage: true, channel: targetChannel });
          await this.logPostToSupabase('promo', content, message.message_id, {}, channelConfig);
          return message;
        } catch (_) {}
      }

      const msg = await this.bot.sendMessage(targetChannel, content, {
        parse_mode: 'HTML', disable_web_page_preview: true,
        reply_markup: { inline_keyboard: keyboard }
      });
      this.trackMessage(`aviator-${variant}`, msg.message_id, { hasImage: false, channel: targetChannel });
      await this.logPostToSupabase('promo', content, msg.message_id, {}, channelConfig);
      return msg;
    });
  }

  // ─── SEND BONUS ───

  async sendBonus(content, bonusCode = 'SPECIAL', channelConfig = null) {
    const targetChannel = this.resolveChannel(channelConfig);
    try {
      const keyboard = this.createBonusKeyboard(bonusCode);
      const message = await this.bot.sendMessage(targetChannel, content, {
        parse_mode: 'HTML', reply_markup: { inline_keyboard: keyboard }
      });
      this.trackMessage('bonus', message.message_id, { bonusCode, channel: targetChannel });
      return message;
    } catch (error) {
      console.error('❌ Error sending bonus:', error);
      throw error;
    }
  }

  // ─── KEYBOARD BUILDERS (settings-store fallback) ───

  async createPredictionsKeyboard() {
    const { getEffectiveButtons, getEffectiveCoupon } = require('./settings-store');
    const buttons = await getEffectiveButtons(true);
    const coupon = await getEffectiveCoupon(true);

    const filtered = (buttons || []).filter(b => {
      const text = String(b.text || '');
      const url = String(b.url || '');
      return !/enter\s*coupon/i.test(text) && !/personal\s*coupons/i.test(text) && !/promo-campaigns/i.test(url);
    });

    const rows = [];
    const row1 = filtered.slice(0, 2).map(b => ({ text: b.text, url: b.url }));
    if (row1.length) rows.push(row1);
    if (filtered[2]) rows.push([{ text: filtered[2].text, url: filtered[2].url }]);
    rows.push([{ text: `🎁 Enter Coupon ${coupon.code}`, url: 'https://t.me/Sportmsterbot?start=join_personal' }]);
    rows.push([{ text: '👤 Get Personal Coupons', url: 'https://t.me/Sportmsterbot?start=join' }]);
    return rows;
  }

  async createResultsKeyboard() {
    return this.createPredictionsKeyboard();
  }

  async createNewsKeyboard() {
    const { getEffectiveButtons } = require('./settings-store');
    const buttons = await getEffectiveButtons(true);
    const actionButtons = buttons.slice(0, 2);
    const rows = [];
    if (actionButtons.length > 0) {
      rows.push(actionButtons.map(btn => ({ text: btn.text, url: btn.url })));
    }
    rows.push([{ text: '👤 Get Personal Coupons', url: 'https://t.me/Sportmsterbot?start=join_personal' }]);
    return rows;
  }

  async createPromoKeyboard(promoCode) {
    const { getEffectiveButtons } = require('./settings-store');
    const buttons = await getEffectiveButtons(true);
    const code = promoCode || 'SM100';

    const actionCandidate = buttons.find(b => {
      const text = String(b.text || '');
      const url = String(b.url || '');
      return !/enter\s*coupon/i.test(text) && !/personal\s*coupons/i.test(text) && !/promo-campaigns/i.test(url);
    });

    const rows = [[{ text: `🎁 Enter Coupon ${code}`, url: 'https://t.me/Sportmsterbot?start=join_personal' }]];
    const secondRow = [];
    if (actionCandidate) secondRow.push({ text: actionCandidate.text, url: actionCandidate.url });
    secondRow.push({ text: '👤 Get Personal Coupons', url: 'https://t.me/Sportmsterbot?start=join_personal' });
    if (secondRow.length > 0) rows.push(secondRow);
    return rows;
  }

  createBonusKeyboard(bonusCode) {
    return [
      [{ text: `🎁 Enter Coupon ${bonusCode}`, url: 'https://t.me/Sportmsterbot?start=join_personal' }],
      [{ text: '📣 Channel', url: 'https://t.me/africansportdata' }],
      [{ text: '👤 Get Personal Coupons', url: 'https://t.me/Sportmsterbot?start=join_personal' }]
    ];
  }

  // ─── PROMO COMMAND (multi-channel) ───

  async executePromoCommand(promoType = 'football', channelConfig = null) {
    try {
      const ContentGenerator = require('./content-generator');
      const cg = new ContentGenerator({
        language: channelConfig?.language || 'en',
        timezone: channelConfig?.timezone || 'Africa/Addis_Ababa',
      });

      const code = channelConfig?.coupon_code || 'SM100';
      const offer = channelConfig?.bonus_offer || '100% Bonus';

      const aiContent = await cg.generatePromoMessage(code, offer);
      return await this.sendPromo(aiContent, code, channelConfig);
    } catch (error) {
      console.error('❌ Error executing promo command:', error);
      throw error;
    }
  }

  async executeBonusCommand(bonusText, channelConfig = null) {
    const content = `🎉 Special Bonus Announcement! 🎉\n\n${bonusText}\n\n⏰ Limited time only!\n🔥 Claim now\n\n💸 https://t.me/Sportmsterbot?start=promo\n📱 Join us on Telegram for exclusive bonuses`;
    return await this.sendBonus(content, 'SPECIAL', channelConfig);
  }

  // ─── TRACKING & ANALYTICS ───

  createTrackingUrl(baseUrl, trackingId, options = {}) {
    const dest = new URL(baseUrl);
    dest.searchParams.set('utm_source', 'telegram');
    dest.searchParams.set('utm_medium', 'sportmaster');
    dest.searchParams.set('utm_campaign', 'daily_auto');
    dest.searchParams.set('utm_content', trackingId);
    dest.searchParams.set('track_id', trackingId);
    if (options.appendUserId && options.userId) dest.searchParams.set('tg_user', String(options.userId));

    const host = process.env.NODE_ENV === 'development' ? 'http://localhost:3000' :
      (process.env.PUBLIC_BASE_URL || 'https://sport-masterbot.vercel.app');
    const redirect = new URL('/api/redirect', host);
    redirect.searchParams.set('to', dest.toString());
    redirect.searchParams.set('track_id', trackingId);
    if (options.appendUserId && options.userId) redirect.searchParams.set('uid', String(options.userId));
    return redirect.toString();
  }

  trackMessage(type, messageId, metadata = {}) {
    const timestamp = new Date().toISOString();
    this.clickStats.set(messageId, { type, messageId, timestamp, clicks: 0, ...metadata });
    console.log(`📊 Tracking ${type} message:`, { messageId, timestamp, metadata });
  }

  async logPostToSupabase(contentType, content, messageId, metadata = {}, channelConfig = null) {
    try {
      if (!supabase) return;
      const typeMap = {
        predictions: 'betting_tip', 'live-predictions': 'betting_tip',
        results: 'news', promo: 'coupon', summary: 'summary', today_hype: 'news'
      };
      const mapped = typeMap[contentType] || 'news';
      await supabase.from('posts').insert({
        content, content_type: mapped, status: 'sent',
        language: channelConfig?.language || 'en',
        telegram_message_id: messageId,
        bot_id: process.env.SUPABASE_BOT_ID || 'sportmaster',
        channel_id: channelConfig?.channel_id || this.channelId,
      });

      await supabase.from('telegram_posts').insert({
        message_id: messageId, type: contentType,
        content: content.substring(0, 1000),
        metadata: { ...metadata, channel: channelConfig?.channel_id || this.channelId },
        created_at: new Date().toISOString()
      });
    } catch (e) {
      console.log('⚠️ Failed to log post to Supabase:', e.message);
    }
  }

  getClickStats() {
    const stats = {};
    for (const [messageId, data] of this.clickStats.entries()) {
      if (!stats[data.type]) stats[data.type] = { totalMessages: 0, totalClicks: 0, messages: [] };
      stats[data.type].totalMessages++;
      stats[data.type].totalClicks += data.clicks;
      stats[data.type].messages.push({ messageId, timestamp: data.timestamp, clicks: data.clicks });
    }
    return stats;
  }

  async testConnection() {
    try {
      const me = await this.bot.getMe();
      console.log('✅ Telegram bot connected:', me.username);
      return true;
    } catch (error) {
      console.error('❌ Telegram connection failed:', error);
      return false;
    }
  }

  // ─── PERSONAL COUPONS ───

  createPersonalCouponKeyboard(userId, promoCode) {
    const trackId = `pc_${userId}_${promoCode}`;
    return [
      [{ text: `🎁 Enter Coupon ${promoCode}`, url: this.createTrackingUrl('https://t.me/Sportmsterbot?start=promo', trackId, { appendUserId: true, userId }) }],
      [{ text: '🔴 Live Football', url: this.createTrackingUrl('https://t.me/Sportmsterbot?start=live', 'pc_live', { appendUserId: true, userId }) }]
    ];
  }

  async sendPersonalCouponToUser(userId, promoCode, text) {
    let imageBuffer = null;
    try { imageBuffer = await this.imageGenerator.generatePromoImage(promoCode); } catch (_) {}

    const caption = text || `🎁 Personal Bonus Just for You\n\nUse code: ${promoCode}\n\nTap below to redeem.`;
    const reply_markup = { inline_keyboard: this.createPersonalCouponKeyboard(userId, promoCode) };

    if (imageBuffer) {
      try {
        const message = await this.bot.sendPhoto(userId, imageBuffer, { caption, parse_mode: 'HTML', reply_markup });
        return { ok: true, message_id: message.message_id };
      } catch (_) {}
    }

    const msg = await this.bot.sendMessage(userId, caption, { parse_mode: 'HTML', reply_markup });
    return { ok: true, message_id: msg.message_id };
  }
}

module.exports = TelegramManager;
