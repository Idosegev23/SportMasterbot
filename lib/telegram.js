// Telegram Bot Integration for GizeBets
// Handles sending messages and tracking interactions

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
      request: {
        agentOptions: {
          keepAlive: true,
          family: 4
        }
      }
    });
    this.channelId = (process.env.CHANNEL_ID || '').trim(); // e.g., @africansportdata
    this.clickStats = new Map(); // Simple in-memory click tracking
    this.imageGenerator = new ImageGenerator(); // AI image generation
  }

  // Retry mechanism for network errors
  async retryRequest(fn, maxRetries = 3, delayMs = 1000) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        console.log(`❌ Attempt ${attempt} failed:`, error.message);
        
        if (attempt === maxRetries) {
          throw error;
        }
        
        // Check if it's a network/TLS error that might benefit from retry
        if (error.code === 'EFATAL' || error.code === 'ECONNRESET' || 
            error.message.includes('TLS') || error.message.includes('network')) {
          console.log(`🔄 Retrying in ${delayMs}ms...`);
          await new Promise(resolve => setTimeout(resolve, delayMs));
          delayMs *= 1.5; // Exponential backoff
        } else {
          throw error; // Don't retry on non-network errors
        }
      }
    }
  }

  // Send predictions as separate messages with AI-generated image
  async sendPredictions(predictions, matches = null) {
    const messageIds = [];
    
    // If it's a string (old format), convert to array with single item
    if (typeof predictions === 'string') {
      predictions = [predictions];
    }
    
    try {
      // Generate AI image for the first prediction (if we have matches data)
      let imageBuffer = null;
      const imagesDisabled = String(process.env.DISABLE_AI_IMAGES || '').toLowerCase() === 'true';
      if (!imagesDisabled && matches && matches.length > 0) {
        console.log('🎨 Generating AI image for predictions...');
        // Allow full image generation (no timebox) when explicitly requested
        if (String(process.env.AI_IMAGE_NO_TIMEOUT || '').toLowerCase() === 'true') {
          try {
            imageBuffer = await this.imageGenerator.generatePredictionImage(matches);
          } catch (e) {
            console.log('⚠️ Image generation failed, continuing without image:', e.message);
            imageBuffer = null;
          }
        } else {
          // Default safe mode: timebox to avoid serverless timeout
          const TIMEBOX_MS = Number(process.env.AI_IMAGE_TIMEOUT_MS || 8000);
          try {
            imageBuffer = await Promise.race([
              this.imageGenerator.generatePredictionImage(matches),
              new Promise((resolve) => setTimeout(() => resolve(null), TIMEBOX_MS))
            ]);
            if (!imageBuffer) console.log('⏱️ Image generation skipped (timeboxed)');
          } catch (e) {
            console.log('⚠️ Image generation failed, continuing without image:', e.message);
            imageBuffer = null;
          }
        }
      }

      for (let i = 0; i < predictions.length; i++) {
        const prediction = predictions[i];
        
        await this.retryRequest(async () => {
          // Create keyboard for every message
      const keyboard = await this.createPredictionsKeyboard();
      
          // Format each prediction message
          const formattedContent = this.formatSinglePredictionMessage(prediction);
          
          // Send first message with image (if available)
          if (i === 0 && imageBuffer) {
            try {
              const message = await this.bot.sendPhoto(this.channelId, imageBuffer, {
                caption: formattedContent,
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: keyboard
                }
              });
              
              console.log(`✅ Prediction ${i + 1}/${predictions.length} sent with AI image, Message ID: ${message.message_id}`);
              this.trackMessage('predictions', message.message_id, { matchNumber: i + 1, hasImage: true });
              await this.logPostToSupabase('predictions', formattedContent, message.message_id);
              messageIds.push(message.message_id);
            } catch (imageError) {
              console.log('⚠️ Failed to send with image, falling back to text:', imageError.message);
              // Fallback to regular text message
              const message = await this.bot.sendMessage(this.channelId, formattedContent, {
                parse_mode: 'HTML',
                disable_web_page_preview: true,
                reply_markup: {
                  inline_keyboard: keyboard
                }
              });
              
              console.log(`✅ Prediction ${i + 1}/${predictions.length} sent (fallback), Message ID: ${message.message_id}`);
              this.trackMessage('predictions', message.message_id, { matchNumber: i + 1, hasImage: false });
              await this.logPostToSupabase('predictions', formattedContent, message.message_id);
              messageIds.push(message.message_id);
            }
          } else {
            // Regular text message for subsequent predictions
            const message = await this.bot.sendMessage(this.channelId, formattedContent, {
              parse_mode: 'HTML',
              disable_web_page_preview: true,
              reply_markup: {
                inline_keyboard: keyboard
              }
            });
            
            console.log(`✅ Prediction ${i + 1}/${predictions.length} sent, Message ID: ${message.message_id}`);
            this.trackMessage('predictions', message.message_id, { matchNumber: i + 1 });
            await this.logPostToSupabase('predictions', formattedContent, message.message_id);
            messageIds.push(message.message_id);
          }
        });
        
        // Add delay between messages to avoid rate limiting
        if (i < predictions.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 1500)); // 1.5 second delay
        }
      }
      
      console.log(`✅ All ${predictions.length} predictions sent successfully`);
      return { messageIds, totalSent: predictions.length };
      
    } catch (error) {
      console.error('❌ Error sending predictions:', error);
      throw error;
    }
  }

  // Format single prediction message (supports both regular and live formats with dynamic numbering)
  formatSinglePredictionMessage(content) {
    const lines = content.split('\n');
    let formatted = '';
    
    lines.forEach((line) => {
      if ((line.includes('MATCH') && line.includes('/')) || (line.includes('LIVE MATCH') && line.includes('/'))) {
        // Header line with match number and time (regular or live) - supports dynamic numbering like 1/3, 2/2, etc.
        formatted += `<b>${line}</b>\n\n`;
      } else if (line.includes('vs') && line.includes('⚽')) {
        // Match teams
        formatted += `<b>${line}</b>\n`;
      } else if (line.includes('-') && !line.includes('🔗') && (line.match(/\d+-\d+/))) {
        // Live score line (e.g., "Manchester United 1-1 Liverpool") - using regex to detect score patterns
        formatted += `<b>⚽ ${line}</b>\n`;
      } else if (line.includes('🏆')) {
        // Competition
        formatted += `${line}\n`;
      } else if (line.includes('🎯')) {
        // Main prediction
        formatted += `<b>${line}</b>\n`;
      } else if (line.includes('💡') || line.includes('⚡')) {
        // Analysis/reasoning or live analysis
        formatted += `<i>${line}</i>\n`;
      } else if (line.includes('💎') || line.includes('🔗') || line.includes('Live code:')) {
        // Promo footer - replace website with correct links
        let updatedLine = line.replace(/gizebets\.et/g, 'https://t.me/Sportmsterbot');
        updatedLine = updatedLine.replace('🔗 https://gizebets.et/', '⚽ Football: https://t.me/Sportmsterbot?start=football\n🔴 Live Football: https://t.me/Sportmsterbot?start=live\n🎁 Enter Coupon: https://t.me/Sportmsterbot?start=promo\n💎 Promo_Code: SM100');
        formatted += `\n${updatedLine}\n`;
      } else if (line.trim()) {
        formatted += `${line}\n`;
      }
    });
    
    return formatted.trim();
  }

  // Legacy format function for backward compatibility
  formatPredictionsMessage(content) {
    // If it's already formatted as single prediction, use new formatter
    if (content.includes('MATCH') && content.includes('/')) {
      return this.formatSinglePredictionMessage(content);
    }
    
    // Otherwise use old format
    let formatted = `<b>🎯 TODAY'S TOP BETTING PREDICTIONS</b>\n\n`;
    
    const lines = content.split('\n');
    lines.forEach(line => {
      if (line.includes('vs') && (line.includes('Premier League') || line.includes('La Liga') || line.includes('Champions League'))) {
        formatted += `<b>⚽ ${line}</b>\n`;
      } else if (line.includes('Prediction:') || line.includes('Confidence:')) {
        formatted += `<code>${line}</code>\n`;
      } else if (line.includes('🎁') || line.includes('💸') || line.includes('🔗')) {
        // Replace website with correct links
        let updatedLine = line.replace(/gizebets\.et/g, 'https://t.me/Sportmsterbot');
        updatedLine = updatedLine.replace('🔗 https://gizebets.et/', '⚽ Football: https://t.me/Sportmsterbot?start=football\n🔴 Live Football: https://t.me/Sportmsterbot?start=live\n🎁 Enter Coupon: https://t.me/Sportmsterbot?start=promo\n💎 Promo_Code: SM100');
        formatted += `\n${updatedLine}\n`;
      } else if (line.trim()) {
        formatted += `${line}\n`;
      } else {
        formatted += `\n`;
      }
    });
    
    return formatted;
  }

  // Send Live Predictions with AI-generated image
  async sendLivePredictions(predictions, liveMatches = null) {
    const messageIds = [];
    
    // If it's a string (old format), convert to array with single item
    if (typeof predictions === 'string') {
      predictions = [predictions];
    }
    
    try {
      // Generate AI image for live predictions
      let imageBuffer = null;
      if (liveMatches && liveMatches.length > 0) {
        console.log('🔴 Generating AI image for LIVE predictions...');
        imageBuffer = await this.imageGenerator.generateLiveImage(liveMatches);
      }

      for (let i = 0; i < predictions.length; i++) {
        const prediction = predictions[i];
        
        await this.retryRequest(async () => {
          // Create keyboard for every message
            const keyboard = await this.createPredictionsKeyboard();
          
          // Format each prediction message
          const formattedContent = this.formatSinglePredictionMessage(prediction);
          
          // Send first message with LIVE image (if available)
          if (i === 0 && imageBuffer) {
            try {
              const message = await this.bot.sendPhoto(this.channelId, imageBuffer, {
                caption: formattedContent,
                parse_mode: 'HTML',
                reply_markup: {
                  inline_keyboard: keyboard
                }
              });
              
              console.log(`✅ LIVE Prediction ${i + 1}/${predictions.length} sent with AI image, Message ID: ${message.message_id}`);
              this.trackMessage('live-predictions', message.message_id, { matchNumber: i + 1, hasImage: true });
              await this.logPostToSupabase('live-predictions', formattedContent, message.message_id);
              messageIds.push(message.message_id);
            } catch (imageError) {
              console.log('⚠️ Failed to send LIVE with image, falling back to text:', imageError.message);
              // Fallback to regular text message
              const message = await this.bot.sendMessage(this.channelId, formattedContent, {
                parse_mode: 'HTML',
                disable_web_page_preview: true,
                reply_markup: {
                  inline_keyboard: keyboard
                }
              });
              
              console.log(`✅ LIVE Prediction ${i + 1}/${predictions.length} sent (fallback), Message ID: ${message.message_id}`);
              this.trackMessage('live-predictions', message.message_id, { matchNumber: i + 1, hasImage: false });
              await this.logPostToSupabase('live-predictions', formattedContent, message.message_id);
              messageIds.push(message.message_id);
            }
          } else {
            // Regular text message for subsequent predictions
            const message = await this.bot.sendMessage(this.channelId, formattedContent, {
              parse_mode: 'HTML',
              disable_web_page_preview: true,
              reply_markup: {
                inline_keyboard: keyboard
              }
            });
            
            console.log(`✅ LIVE Prediction ${i + 1}/${predictions.length} sent, Message ID: ${message.message_id}`);
            this.trackMessage('live-predictions', message.message_id, { matchNumber: i + 1 });
            await this.logPostToSupabase('live-predictions', formattedContent, message.message_id);
            messageIds.push(message.message_id);
          }
        });
        
        // Add delay between messages to avoid rate limiting
        if (i < predictions.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 1500)); // 1.5 second delay
        }
      }
      
      console.log(`✅ All ${predictions.length} LIVE predictions sent successfully`);
      return { messageIds, totalSent: predictions.length };
      
    } catch (error) {
      console.error('❌ Error sending LIVE predictions:', error);
      throw error;
    }
  }

  // Send Daily Results Message with enhanced formatting and AI image
  async sendResults(content, results = null) {
    return await this.retryRequest(async () => {
      const keyboard = await this.createResultsKeyboard();
      
      // Enhanced formatting for results
      const formattedContent = this.formatResultsMessage(content);
      
      // Generate AI image for results
      let imageBuffer = null;
      if (results && results.length > 0) {
        console.log('📊 Generating AI image for results...');
        imageBuffer = await this.imageGenerator.generateResultsImage(results);
      }

      // Send with image if available
      if (imageBuffer) {
        try {
          const message = await this.bot.sendPhoto(this.channelId, imageBuffer, {
            caption: formattedContent,
            parse_mode: 'HTML',
            reply_markup: {
              inline_keyboard: keyboard
            }
          });

          console.log('✅ Results sent with AI image, Message ID:', message.message_id);
          this.trackMessage('results', message.message_id, { hasImage: true });
          await this.logPostToSupabase('results', formattedContent, message.message_id);
          return message;
        } catch (imageError) {
          console.log('⚠️ Failed to send results with image, falling back to text:', imageError.message);
        }
      }

      // Fallback to regular text message
      const message = await this.bot.sendMessage(this.channelId, formattedContent, {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: keyboard
        },
        disable_web_page_preview: true
      });

      console.log('✅ Results sent successfully, Message ID:', message.message_id);
      this.trackMessage('results', message.message_id, { hasImage: false });
      await this.logPostToSupabase('results', formattedContent, message.message_id);
      
      return message;
    });
  }

  // Send Live Status (around 60' updates) with optional LIVE image
  async sendLiveStatus(content, liveMatches = null) {
    return await this.retryRequest(async () => {
      const keyboard = await this.createResultsKeyboard();
      const formattedContent = this.formatLiveStatusMessage(content);

      let imageBuffer = null;
      if (liveMatches && liveMatches.length > 0) {
        try {
          imageBuffer = await this.imageGenerator.generateLiveImage(liveMatches);
        } catch (_) {}
      }

      if (imageBuffer) {
        try {
          const message = await this.bot.sendPhoto(this.channelId, imageBuffer, {
            caption: formattedContent,
            parse_mode: 'HTML',
            reply_markup: { inline_keyboard: keyboard }
          });
          this.trackMessage('live-status', message.message_id, { hasImage: true });
          await this.logPostToSupabase('live_status', formattedContent, message.message_id);
          return message;
        } catch (_) { /* fall back to text */ }
      }

      const message = await this.bot.sendMessage(this.channelId, formattedContent, {
        parse_mode: 'HTML',
        disable_web_page_preview: true,
        reply_markup: { inline_keyboard: keyboard }
      });
      this.trackMessage('live-status', message.message_id, { hasImage: false });
      await this.logPostToSupabase('live_status', formattedContent, message.message_id);
      return message;
    });
  }

  // Format live status content to align with channel style
  formatLiveStatusMessage(content) {
    // Reuse results formatter behavior for footers/links but keep LIVE header
    if (!content) return '';
    const lines = content.split('\n');
    let formatted = '';
    lines.forEach(line => {
      if (line.startsWith('🔴 ') || line.startsWith('⚡ ')) {
        formatted += `<b>${line}</b>\n\n`;
      } else if (line.startsWith('⚽ ')) {
        formatted += `<b>${line}</b>\n`;
      } else if (line.startsWith('⏱️')) {
        formatted += `${line}\n\n`;
      } else if (line.startsWith('💬')) {
        formatted += `${line}\n`;
        } else if (line.includes('gizebets.et')) {
          // Remove any gizebets links entirely for SportMaster bot
          const updated = line.replace(/gizebets\.et[^\s]*/g, '').trim();
          if (updated) formatted += `\n${updated}\n`;
      } else if (line.trim()) {
        formatted += `${line}\n`;
      }
    });
    return formatted.trim();
  }

  // Send Daily Summary (text-only, concise)
  async sendSummary(content) {
    return await this.retryRequest(async () => {
      const message = await this.bot.sendMessage(this.channelId, content, {
        parse_mode: 'HTML',
        disable_web_page_preview: true,
        reply_markup: {
          inline_keyboard: [
            [
              { text: '⚽ Football', url: this.createTrackingUrl('https://t.me/Sportmsterbot?start=football', 'summary_football') },
              { text: '🔴 Live Football', url: this.createTrackingUrl('https://t.me/Sportmsterbot?start=live', 'summary_live') }
            ],
            [
              { text: '🎁 Enter Coupon', url: this.createTrackingUrl('https://t.me/Sportmsterbot?start=promo', 'summary_promo') }
            ],
      [
        { text: '👤 Get Personal Coupons', url: 'https://t.me/Sportmsterbot?start=join' }
      ]
          ]
        }
      });
      console.log('✅ Summary sent successfully, Message ID:', message.message_id);
      this.trackMessage('summary', message.message_id, {});
      await this.logPostToSupabase('summary', content, message.message_id);
      return message;
    });
  }

  // Format results message for better display
  formatResultsMessage(content) {
    let formatted = `<b>📊 DAILY MATCH RESULTS</b>\n\n`;
    
    const lines = content.split('\n');
    
    lines.forEach(line => {
      if (line.includes(' - ') && (line.includes('1') || line.includes('2') || line.includes('3'))) {
        // Match result line
        formatted += `<b>⚽ ${line}</b>\n`;
      } else if (line.includes('Full Results:') || line.includes('🔗')) {
        // Footer links - replace website with correct links
          let updatedLine = line.replace(/gizebets\.et/g, 'https://t.me/Sportmsterbot');
          updatedLine = updatedLine.replace('🔗 Full Analysis: https://gizebets.et', '⚽ Football: https://t.me/Sportmsterbot?start=football\n🔴 Live Football: https://t.me/Sportmsterbot?start=live\n🎁 Enter Coupon: https://t.me/Sportmsterbot?start=promo\n💎 Promo_Code: SM100');
        formatted += `\n${updatedLine}\n`;
      } else if (line.trim()) {
        formatted += `${line}\n`;
      } else {
        formatted += `\n`;
      }
    });
    
    return formatted;
  }

  // Send Promo Message with enhanced formatting and AI image
  async sendPromo(content, promoCode) {
    return await this.retryRequest(async () => {
      console.log('🚀 Starting promo creation process...');
      
      // STEP 1: Generate AI image first (wait for it)
      let imageBuffer = null;
      if (promoCode) {
        console.log('🎨 Generating AI image before sending...');
        try {
          const imagePromise = this.imageGenerator.generatePromoImage(promoCode);
          imageBuffer = await Promise.race([
            imagePromise,
            new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Image generation timeout')), 45000) // 45 seconds
            )
          ]);
          console.log('✅ AI image generated successfully!');
        } catch (error) {
          console.log('⚠️ Image generation failed, continuing with text only:', error.message);
        }
      }
      
      // STEP 2: Create keyboard and format content
      const keyboard = await this.createPromoKeyboard(promoCode);
      const formattedContent = this.formatPromoMessage(content, promoCode);
      
      // STEP 3: Send complete message (image + text OR text only)
      let finalMessage;
      if (imageBuffer) {
        console.log('📸 Sending promo with image...');
        finalMessage = await this.bot.sendPhoto(this.channelId, imageBuffer, {
          caption: formattedContent,
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: keyboard
          }
        });
        console.log('✅ Promo with image sent! Message ID:', finalMessage.message_id);
        this.trackMessage('promo', finalMessage.message_id, { promoCode, hasImage: true });
        await this.logPostToSupabase('promo', formattedContent, finalMessage.message_id);
      } else {
        console.log('📝 Sending text-only promo...');
        finalMessage = await this.bot.sendMessage(this.channelId, formattedContent, {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: keyboard
        },
        disable_web_page_preview: true
      });
        console.log('✅ Text promo sent! Message ID:', finalMessage.message_id);
        this.trackMessage('promo', finalMessage.message_id, { promoCode, hasImage: false });
        await this.logPostToSupabase('promo', formattedContent, finalMessage.message_id);
      }
      
      return finalMessage;
    });
  }

  // NOTE: upgradePromoWithImage removed - now we generate image BEFORE sending

  // Format promo message - clean and simple
  formatPromoMessage(content, promoCode) {
    let formatted = content;
    
    // Simple clean header
    formatted = `🎁 <b>Special Offer!</b> 🎁\n\n${formatted}`;
    
    // Make promo code prominent but clean
    if (formatted.includes(promoCode)) {
      formatted = formatted.replace(
        new RegExp(`(${promoCode})`, 'g'), 
        `<code>${promoCode}</code>`
      );
    }
    
    // Clean text formatting - less aggressive
    formatted = formatted.replace(/(\d+%)/g, '<b>$1</b>');
    formatted = formatted.replace(/(bonus|Bonus|BONUS)/g, '<b>BONUS</b>');
    
    // Remove website link from content (will be in buttons)
    formatted = formatted.replace(/🔗\s*[^\n]+/g, '');
    formatted = formatted.replace(/gizebets\.et/g, 'https://t.me/Sportmsterbot');
    
    return formatted.trim();
  }

  // Send News Message with AI image
  async sendNews(headlines) {
    return await this.retryRequest(async () => {
      console.log('📰 Starting news creation process...');
      
      // STEP 1: Generate AI image first
      let imageBuffer = null;
      console.log('🎨 Generating AI image for news...');
      try {
        const imagePromise = this.imageGenerator.generateNewsImage();
        imageBuffer = await Promise.race([
          imagePromise,
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Image generation timeout')), 45000)
          )
        ]);
        console.log('✅ AI news image generated successfully!');
      } catch (error) {
        console.log('⚠️ Image generation failed, using fallback:', error.message);
        imageBuffer = await this.imageGenerator.generateFallbackImage('news');
      }
      
      // STEP 2: Format news content
      const newsText = `📰 *SportMaster Daily News*\n\n${headlines.map((h, i) => `${i + 1}. ${h}`).join('\n\n')}\n\n⏰ ${new Date().toLocaleString('en-US', { timeZone: 'Africa/Addis_Ababa' })} (ET)`;
      
      // STEP 3: Create keyboard
      const keyboard = await this.createNewsKeyboard();
      
      // STEP 4: Send message with image
      let finalMessage;
      if (imageBuffer) {
        finalMessage = await this.bot.sendPhoto(this.channelId, imageBuffer, {
          caption: newsText,
          parse_mode: 'Markdown',
          reply_markup: { inline_keyboard: keyboard }
        });
      } else {
        finalMessage = await this.bot.sendMessage(this.channelId, newsText, {
          parse_mode: 'Markdown',
          reply_markup: { inline_keyboard: keyboard }
        });
      }

      console.log('✅ News sent successfully, Message ID:', finalMessage.message_id);
      await this.logPostToSupabase('news', newsText, finalMessage.message_id);
      return finalMessage;
    });
  }

  // Send Custom Bonus Message (for manual commands)
  async sendBonus(content, bonusCode = 'SPECIAL') {
    try {
      const keyboard = this.createBonusKeyboard(bonusCode);
      
      const message = await this.bot.sendMessage(this.channelId, content, {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: keyboard
        }
      });

      console.log('✅ Bonus sent successfully, Message ID:', message.message_id);
      this.trackMessage('bonus', message.message_id, { bonusCode });
      
      return message;
    } catch (error) {
      console.error('❌ Error sending bonus:', error);
      throw error;
    }
  }

  // Create Predictions Keyboard with tracking
  async createPredictionsKeyboard() {
    const { getEffectiveButtons, getEffectiveCoupon } = require('./settings-store');
    const buttons = await getEffectiveButtons(true);
    const coupon = await getEffectiveCoupon(true);

    // Filter out any coupon-like or personal-coupons buttons from settings to avoid duplicates
    const filtered = (buttons || []).filter(b => {
      const text = String(b.text || '');
      const url = String(b.url || '');
      const isCouponText = /enter\s*coupon/i.test(text);
      const isPersonalCoupons = /personal\s*coupons/i.test(text);
      const isCouponUrl = /promo-campaigns/i.test(url);
      return !isCouponText && !isCouponUrl && !isPersonalCoupons;
    });

    // Map to inline keyboard
    const row1 = filtered.slice(0, 2).map(b => ({ text: b.text, url: b.url }));
    const rows = [];
    if (row1.length) rows.push(row1);
    if (filtered[2]) {
      rows.push([{ text: filtered[2].text, url: filtered[2].url }]);
    }
    // Always include coupon button with the ACTIVE code, linking to bot deep-link
    rows.push([{ text: `🎁 Enter Coupon ${coupon.code}`, url: 'https://t.me/Sportmsterbot?start=join_personal' }]);
    // Include personal coupons helper
    rows.push([{ text: '👤 Get Personal Coupons', url: 'https://t.me/Sportmsterbot?start=join' }]);
    return rows;
  }

  // Create Results Keyboard
  async createResultsKeyboard() {
    const { getEffectiveButtons, getEffectiveCoupon } = require('./settings-store');
    const buttons = await getEffectiveButtons(true);
    const coupon = await getEffectiveCoupon(true);

    // Filter out duplicates for coupon/personal entries from settings
    const filtered = (buttons || []).filter(b => {
      const text = String(b.text || '');
      const url = String(b.url || '');
      const isCouponText = /enter\s*coupon/i.test(text);
      const isPersonalCoupons = /personal\s*coupons/i.test(text);
      const isCouponUrl = /promo-campaigns/i.test(url);
      return !isCouponText && !isCouponUrl && !isPersonalCoupons;
    });

    const row1 = filtered.slice(0, 2).map(b => ({ text: b.text, url: b.url }));
    const rows = [];
    if (row1.length) rows.push(row1);
    if (filtered[2]) rows.push([{ text: filtered[2].text, url: filtered[2].url }]);
    rows.push([{ text: `🎁 Enter Coupon ${coupon.code}`, url: 'https://t.me/Sportmsterbot?start=join_personal' }]);
    rows.push([{ text: '👤 Get Personal Coupons', url: 'https://t.me/Sportmsterbot?start=join' }]);
    return rows;
  }

  // Create News Keyboard
  async createNewsKeyboard() {
    const { getEffectiveButtons } = require('./settings-store');
    const buttons = await getEffectiveButtons(true);
    
    // Get first 2 action buttons for news
    const actionButtons = buttons.slice(0, 2);
    const rows = [];
    
    if (actionButtons.length > 0) {
      const row = actionButtons.map(btn => ({
        text: btn.text,
        url: btn.url
      }));
      rows.push(row);
    }
    
    // Always add personal coupons button
    rows.push([{ text: '👤 Get Personal Coupons', url: 'https://t.me/Sportmsterbot?start=join_personal' }]);
    
    return rows;
  }

  // Create Promo Keyboard - attractive and action-oriented with more options
  async createPromoKeyboard(promoCode) {
    const { getEffectiveButtons } = require('./settings-store');
    const buttons = await getEffectiveButtons(true);
    // Base "Enter Coupon" button (always first)
    const enterCouponBtn = { text: `🎁 Enter Coupon ${promoCode}`, url: 'https://t.me/Sportmsterbot?start=join_personal' };

    // Prefer one action button from settings (exclude coupon-like and personal-coupons)
    const actionCandidate = buttons.find(b => {
      const text = String(b.text || '');
      const url = String(b.url || '');
      const isCouponText = /enter\s*coupon/i.test(text);
      const isPersonalCoupons = /personal\s*coupons/i.test(text);
      const isCouponUrl = /promo-campaigns/i.test(url);
      return !isCouponText && !isCouponUrl && !isPersonalCoupons;
    });

    const personalBtn = { text: '👤 Get Personal Coupons', url: 'https://t.me/Sportmsterbot?start=join_personal' };

    // Build rows: total max 3 buttons
    const rows = [[enterCouponBtn]];
    const secondRow = [];
    if (actionCandidate) {
      secondRow.push({ text: actionCandidate.text, url: actionCandidate.url });
    }
    // Always include personal coupons button as part of the 3-button layout
    secondRow.push(personalBtn);
    if (secondRow.length > 0) rows.push(secondRow);
    return rows;
  }

  // Create Bonus Keyboard
  createBonusKeyboard(bonusCode) {
    return [
      [ { text: `🎁 Enter Coupon ${bonusCode}`, url: 'https://t.me/Sportmsterbot?start=join_personal' } ],
      [ { text: '📣 Channel', url: 'https://t.me/africansportdata' } ],
      [ { text: '👤 Get Personal Coupons', url: 'https://t.me/Sportmsterbot?start=join_personal' } ]
    ];
  }

  // Create tracking URL via redirect endpoint for click analytics
  createTrackingUrl(baseUrl, trackingId, options = {}) {
    // Keep UTM on destination
    const dest = new URL(baseUrl);
    dest.searchParams.set('utm_source', 'telegram');
    dest.searchParams.set('utm_medium', 'sportmaster');
    dest.searchParams.set('utm_campaign', 'daily_auto');
    dest.searchParams.set('utm_content', trackingId);
    dest.searchParams.set('track_id', trackingId);
    if (options.appendUserId && options.userId) {
      dest.searchParams.set('tg_user', String(options.userId));
    }

    const host = process.env.NODE_ENV === 'development' ? 'http://localhost:3000' : 
      (process.env.PUBLIC_BASE_URL || 'https://idosegev23.vercel.app');
    const redirect = new URL('/api/redirect', host);
    redirect.searchParams.set('to', dest.toString());
    redirect.searchParams.set('track_id', trackingId);
    if (options.appendUserId && options.userId) {
      redirect.searchParams.set('uid', String(options.userId));
    }
    return redirect.toString();
  }

  // Track message for analytics
  trackMessage(type, messageId, metadata = {}) {
    const timestamp = new Date().toISOString();
    const trackingData = {
      type,
      messageId,
      timestamp,
      clicks: 0,
      ...metadata
    };
    
    this.clickStats.set(messageId, trackingData);
    
    // Log for analytics
    console.log(`📊 Tracking ${type} message:`, {
      messageId,
      timestamp,
      metadata
    });
  }

  async logPostToSupabase(contentType, content, messageId) {
    try {
      if (!supabase) return;
      // Map to allowed content_type values in Supabase
      const typeMap = {
        predictions: 'betting_tip',
        'live-predictions': 'betting_tip',
        results: 'news',
        promo: 'coupon',
        summary: 'summary',
        today_hype: 'news'
      };
      const mapped = typeMap[contentType] || 'news';
      await supabase.from('posts').insert({
        content,
        content_type: mapped,
        status: 'sent',
        language: 'en',
        telegram_message_id: messageId,
        bot_id: process.env.SUPABASE_BOT_ID || 'sportmaster'
      });
    } catch (e) {
      console.log('⚠️ Failed to log post to Supabase:', e.message);
    }
  }

  // Get click statistics
  getClickStats() {
    const stats = {};
    
    for (const [messageId, data] of this.clickStats.entries()) {
      if (!stats[data.type]) {
        stats[data.type] = {
          totalMessages: 0,
          totalClicks: 0,
          messages: []
        };
      }
      
      stats[data.type].totalMessages++;
      stats[data.type].totalClicks += data.clicks;
      stats[data.type].messages.push({
        messageId,
        timestamp: data.timestamp,
        clicks: data.clicks
      });
    }
    
    return stats;
  }

  // Manual command: Send promo to all (ENGLISH AI-generated)
  async executePromoCommand(promoType = 'football') {
    try {
      console.log(`🎯 Executing manual promo command: ${promoType}`);
      
      // Import ContentGenerator for AI-powered promos
      const ContentGenerator = require('./content-generator');
      const contentGenerator = new ContentGenerator();
      
      // Define promo types with AI parameters
      const promoConfigs = {
        football: {
          offer: '100 ETB Bonus',
      code: 'SM100'
        },
        casino: {
          offer: '100 ETB Bonus',
      code: 'SM100'
        },
        sports: {
          offer: '100 ETB Bonus',
      code: 'SM100'
        },
        special: {
          offer: '100 ETB Bonus',
      code: 'SM100'
        }
      };
      
      const config = promoConfigs[promoType] || promoConfigs.football;
      
      // Generate AI content in English
      console.log(`🤖 Generating AI promo content for ${promoType}...`);
      const aiContent = await contentGenerator.generatePromoMessage(config.code, config.offer);
      
      // Send the AI-generated promo
      return await this.sendPromo(aiContent, config.code);
      
    } catch (error) {
      console.error('❌ Error executing promo command:', error);
      throw error;
    }
  }

  // Manual command: Send bonus to all
  async executeBonusCommand(bonusText) {
    try {
      console.log('🎁 Executing manual bonus command');
      
      const content = `🎉 Special Bonus Announcement! 🎉

${bonusText}

⏰ Limited time only!
🔥 Claim now

    💸 https://t.me/Sportmsterbot?start=promo
📱 Join us on Telegram for exclusive bonuses

#SportMaster #Bonus #WinBig`;

      return await this.sendBonus(content, 'SPECIAL');
      
    } catch (error) {
      console.error('❌ Error executing bonus command:', error);
      throw error;
    }
  }

  // Test connection
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

  // Create personal coupon keyboard with tracking per user
  createPersonalCouponKeyboard(userId, promoCode) {
    const trackId = `pc_${userId}_${promoCode}`;
    return [
      [
        {
          text: `🎁 Enter Coupon ${promoCode}`,
      url: this.createTrackingUrl('https://t.me/Sportmsterbot?start=promo', trackId, { appendUserId: true, userId })
        }
      ],
      [
          { text: '🔴 Live Football', url: this.createTrackingUrl('https://t.me/Sportmsterbot?start=live', 'pc_live', { appendUserId: true, userId }) }
      ]
    ];
  }

  // Send personal coupon DM to a specific Telegram user (chat id = userId)
  async sendPersonalCouponToUser(userId, promoCode, text) {
    // Generate image once per call
    let imageBuffer = null;
    try {
      imageBuffer = await this.imageGenerator.generatePromoImage(promoCode);
    } catch (_) {}

    const caption = text || `🎁 Personal Bonus Just for You\n\nUse code: ${promoCode}\n\nTap below to redeem.`;
    const reply_markup = { inline_keyboard: this.createPersonalCouponKeyboard(userId, promoCode) };

    if (imageBuffer) {
      try {
        const message = await this.bot.sendPhoto(userId, imageBuffer, {
          caption,
          parse_mode: 'HTML',
          reply_markup
        });
        return { ok: true, message_id: message.message_id };
      } catch (e) {
        // Fallback to text only
      }
    }

    const msg = await this.bot.sendMessage(userId, caption, {
      parse_mode: 'HTML',
      reply_markup
    });
    return { ok: true, message_id: msg.message_id };
  }
}

module.exports = TelegramManager;