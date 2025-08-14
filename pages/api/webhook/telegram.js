// Telegram Webhook Handler - Improved Direct Processing

const SimpleBotCommands = require('../../../lib/simple-bot-commands');
const axios = require('axios');

// Safe edit wrapper to avoid "message is not modified" errors
async function safeEditMessageText(bot, chatId, messageId, text, options = {}) {
  try {
    await bot.editMessageText(text, { chat_id: chatId, message_id: messageId, ...options });
  } catch (err) {
    const desc = err?.response?.body?.description || '';
    if (err?.code === 'ETELEGRAM' && desc.includes('message is not modified')) {
      // Ignore and proceed
      return;
    }
    throw err;
  }
}
const { upsertUserFromMsg, recordInteraction } = require('../../../lib/user-analytics');

// Keep a global instance to avoid recreating
let botInstance = null;

export default async function handler(req, res) {
  // Handle GET requests (Telegram webhook verification)
  if (req.method === 'GET') {
    return res.status(200).json({ 
      status: 'Webhook is active', 
      timestamp: new Date().toISOString(),
      endpoint: 'telegram'
    });
  }
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const update = req.body;
    console.log('📨 Telegram webhook received:', JSON.stringify(update, null, 2));
    
    // Debug logging
    if (update.callback_query) {
      console.log('🔍 DEBUG: Callback query detected:', update.callback_query.data);
      console.log('🔍 DEBUG: Chat ID:', update.callback_query.message.chat.id);
    }

    // Initialize bot instance if needed
    if (!botInstance) {
      console.log('🤖 Initializing Simple Bot Commands for webhook...');
      botInstance = new SimpleBotCommands();
      console.log('✅ Bot commands initialized for webhook mode');
    }

    // Process different types of updates DIRECTLY
    if (update.message) {
      console.log('💬 Processing message update directly...');
      
      // Check if this is a command message
      const msg = update.message;
      const text = msg.text || '';

      // Public opt-in: /start join / join_personal
      if (text.startsWith('/start') && text.includes('join')) {
        await upsertUserFromMsg(msg, true);
        // Extract tag after 'start '
        let sourceTag = 'join';
        try {
          const parts = text.split(' ');
          if (parts.length > 1) sourceTag = parts[1];
        } catch (_) {}
        await recordInteraction(msg, 'opt_in', { source: sourceTag });
        await botInstance.bot.sendMessage(msg.chat.id, 
          '✅ You are all set!\n\nYou will receive personalized coupons and updates.\n\nYou can stop anytime by blocking the bot.',
          { parse_mode: 'HTML' }
        );
        return res.status(200).json({ success: true });
      }
      
      // Wizard flow (step-by-step input capture)
      const { getState, setState, clearState } = require('../../../lib/wizard-state');
      const st = await getState(msg.chat.id);
      if (st) {
        // New: handle awaited manual inputs for wizard (mobile-friendly)
        if (st.awaiting) {
          const { setState, clearState } = require('../../../lib/wizard-state');
          if (st.type === 'buttons') {
            if (st.awaiting === 'b1_text') {
              st.data = st.data || {}; st.data.b1 = st.data.b1 || {}; st.data.b1.text = text;
              st.awaiting = null; st.step = 2; await setState(msg.chat.id, st);
              await botInstance.bot.sendMessage(msg.chat.id, '🧩 Choose URL for Button 1', {
                reply_markup: { inline_keyboard: [[
                  { text: 'Channel', callback_data: 'wiz:buttons:2:url:https://t.me/africansportdata' },
                  { text: 'Personal', callback_data: 'wiz:buttons:2:url:https://t.me/Sportmsterbot?start=join' }
                ], [{ text: 'Coupons', callback_data: 'wiz:buttons:2:url:https://t.me/Sportmsterbot?start=join_personal' }],
                [{ text: '✍️ Type URL', callback_data: 'wiz:buttons:2:url:custom' }],
                [{ text: '⬅️ Back', callback_data: 'wiz:back:buttons:1' }]] }
              });
              return res.status(200).json({ success: true });
            }
            if (st.awaiting === 'b1_url') {
              st.data = st.data || {}; st.data.b1 = st.data.b1 || {}; st.data.b1.url = text;
              st.awaiting = null; st.step = 99; await setState(msg.chat.id, st);
              await botInstance.bot.sendMessage(msg.chat.id, '📦 Save scope?', {
                reply_markup: { inline_keyboard: [[
                  { text: '✅ Persist', callback_data: 'wiz:buttons:scope:persist' },
                  { text: '🕘 Once', callback_data: 'wiz:buttons:scope:once' }
                ], [{ text: '⬅️ Back', callback_data: 'wiz:back:buttons:2' }]] }
              });
              return res.status(200).json({ success: true });
            }
          }
          if (st.type === 'coupon') {
            if (st.awaiting === 'coupon_code') {
              st.data = st.data || {}; st.data.code = text; st.awaiting = null; st.step = 2;
              await setState(msg.chat.id, st);
              await botInstance.bot.sendMessage(msg.chat.id, '🎟️ Choose offer', {
                reply_markup: { inline_keyboard: [[
                  { text: '100 ETB Bonus', callback_data: 'wiz:coupon:2:offer:100 ETB Bonus' },
                  { text: 'Free Bet', callback_data: 'wiz:coupon:2:offer:Free Bet' }
                ], [{ text: 'Boost 10%', callback_data: 'wiz:coupon:2:offer:Boost 10%' }],
                [{ text: '✍️ Type offer', callback_data: 'wiz:coupon:2:offer:custom' }],
                [{ text: '⬅️ Back', callback_data: 'wiz:back:coupon:1' }]] }
              });
              return res.status(200).json({ success: true });
            }
            if (st.awaiting === 'coupon_offer') {
              st.data = st.data || {}; st.data.offer = text; st.awaiting = null; st.step = 3;
              await setState(msg.chat.id, st);
              await botInstance.bot.sendMessage(msg.chat.id, '📦 Save scope?', {
                reply_markup: { inline_keyboard: [[
                  { text: '✅ Persist', callback_data: 'wiz:coupon:3:scope:persist' },
                  { text: '🕘 Once', callback_data: 'wiz:coupon:3:scope:once' }
                ], [{ text: '⬅️ Back', callback_data: 'wiz:back:coupon:2' }]] }
              });
              return res.status(200).json({ success: true });
            }
          }
        }

        if (st.type === 'buttons') {
          const { setButtons } = require('../../../lib/settings-store');
          if (st.step === 1) {
            st.data.b1 = { text: text };
            st.step = 2;
            await setState(msg.chat.id, st);
            await botInstance.bot.sendMessage(msg.chat.id, '🧩 Step 2/4: Enter URL for Button 1');
            return res.status(200).json({ success: true });
          } else if (st.step === 2) {
            st.data.b1.url = text;
            st.step = 3;
            await setState(msg.chat.id, st);
            await botInstance.bot.sendMessage(msg.chat.id, '🧩 Step 3/4: Enter text for Button 2 (or type skip)');
            return res.status(200).json({ success: true });
          } else if (st.step === 3) {
            if (text.toLowerCase() !== 'skip') st.data.b2 = { text };
            st.step = 4;
            await setState(msg.chat.id, st);
            await botInstance.bot.sendMessage(msg.chat.id, st.data.b2 ? '🧩 Step 4/4: Enter URL for Button 2 (or type skip)' : '🧩 Step 4/4: Enter text for Button 3 (or type skip)');
            return res.status(200).json({ success: true });
          } else if (st.step === 4) {
            if (st.data.b2 && text.toLowerCase() !== 'skip') st.data.b2.url = text;
            else if (!st.data.b2 && text.toLowerCase() !== 'skip') st.data.b3 = { text };
            // finalize collect remaining if any
            const buttons = [];
            if (st.data.b1?.text && st.data.b1?.url) buttons.push(st.data.b1);
            if (st.data.b2?.text && st.data.b2?.url) buttons.push(st.data.b2);
            if (st.data.b3?.text && st.data.b3?.url) buttons.push(st.data.b3);
            await setButtons(buttons, 'persist');
            await clearState(msg.chat.id);
            await botInstance.bot.sendMessage(msg.chat.id, '✅ Buttons updated (persist).');
            return res.status(200).json({ success: true });
          }
        }
        if (st.type === 'coupon') {
          const { setCoupon } = require('../../../lib/settings-store');
          if (st.step === 1) {
            st.data.code = text;
            st.step = 2;
            await setState(msg.chat.id, st);
            await botInstance.bot.sendMessage(msg.chat.id, '🎟️ Step 2/3: Enter offer text');
            return res.status(200).json({ success: true });
          } else if (st.step === 2) {
            st.data.offer = text;
            st.step = 3;
            await setState(msg.chat.id, st);
            await botInstance.bot.sendMessage(msg.chat.id, '🎯 Scope? Reply with: once or persist');
            return res.status(200).json({ success: true });
          } else if (st.step === 3) {
            const scope = text.toLowerCase().startsWith('o') ? 'once' : 'persist';
            await setCoupon({ code: st.data.code, offer: st.data.offer }, scope);
            await clearState(msg.chat.id);
            await botInstance.bot.sendMessage(msg.chat.id, `✅ Coupon updated (${scope}).`);
            return res.status(200).json({ success: true });
          }
        }
      }

      // Process commands directly instead of emitting events
      if (text.startsWith('/start') || text.startsWith('/menu')) {
        if (botInstance.checkAdminAccess(msg)) {
          try { await recordInteraction(msg, 'command', { text }); } catch (_) {}
          await botInstance.showMainMenu(msg.chat.id);
        }
      } else if (text.startsWith('/start')) {
        // Public /start without join – invite to join
        await upsertUserFromMsg(msg, false);
        await recordInteraction(msg, 'start', {});
        await botInstance.bot.sendMessage(msg.chat.id,
          '👋 Welcome!\n\nTap to allow personalized coupons and updates:',
          { reply_markup: { inline_keyboard: [[{ text: '✅ Allow', callback_data: 'public:consent' }]] } }
        );
      } else if (text.startsWith('/predictions')) {
        if (botInstance.checkAdminAccess(msg)) {
          try { await recordInteraction(msg, 'command', { text }); } catch (_) {}
          await botInstance.handlePredictionsCommand(msg);
        }
      } else if (text.startsWith('/promo')) {
        if (botInstance.checkAdminAccess(msg)) {
          try { await recordInteraction(msg, 'command', { text }); } catch (_) {}
          await botInstance.handlePromoCommand(msg);
        }
      } else if (text.startsWith('/results')) {
        if (botInstance.checkAdminAccess(msg)) {
          try { await recordInteraction(msg, 'command', { text }); } catch (_) {}
          await botInstance.handleResultsCommand(msg);
        }
      } else if (text.startsWith('/summary')) {
        if (botInstance.checkAdminAccess(msg)) {
          try { await recordInteraction(msg, 'command', { text }); } catch (_) {}
          await botInstance.handleSummaryCommand(msg);
        }
      } else if (text.startsWith('/status')) {
        if (botInstance.checkAdminAccess(msg)) {
          try { await recordInteraction(msg, 'command', { text }); } catch (_) {}
          await botInstance.handleStatusCommand(msg);
        }
      } else if (text.startsWith('/today')) {
        if (botInstance.checkAdminAccess(msg)) {
          try { await recordInteraction(msg, 'command', { text }); } catch (_) {}
          await botInstance.handleTodayCommand(msg);
        }
      } else if (text.startsWith('/live')) {
        if (botInstance.checkAdminAccess(msg)) {
          try { await recordInteraction(msg, 'command', { text }); } catch (_) {}
          await botInstance.handleLiveCommand(msg);
        }
      } else if (text.startsWith('/help')) {
        if (botInstance.checkAdminAccess(msg)) {
          try { await recordInteraction(msg, 'command', { text }); } catch (_) {}
          await botInstance.handleHelpCommand(msg);
        }
      } else if (text.startsWith('/analytics')) {
        if (botInstance.checkAdminAccess(msg)) {
          try { await recordInteraction(msg, 'command', { text }); } catch (_) {}
          await botInstance.handleAnalyticsCommand(msg);
        }
      } else if (text.startsWith('/buttons')) {
        if (botInstance.checkAdminAccess(msg)) {
          await botInstance.startButtonsWizard(msg.chat.id, msg.message_id || update.message.message_id);
        }
      } else if (text.startsWith('/coupon')) {
        if (botInstance.checkAdminAccess(msg)) {
          await botInstance.startCouponWizard(msg.chat.id, msg.message_id || update.message.message_id);
        }
      } else if (text.startsWith('/emergency_stop') || text.startsWith('/stop')) {
        if (botInstance.checkAdminAccess(msg)) {
          await botInstance.emergencyStop(msg.chat.id);
        }
      }
    }

    if (update.callback_query) {
      console.log('🔘 Processing callback query directly...');
      
      const callbackQuery = update.callback_query;
      const action = callbackQuery.data;
      const chatId = callbackQuery.message.chat.id;
      const messageId = callbackQuery.message.message_id;

      // Public consent callback
      if (action === 'public:consent') {
        await upsertUserFromMsg(callbackQuery, true);
        await recordInteraction(callbackQuery, 'consent', {});
        await botInstance.bot.editMessageText('✅ Thank you! You will receive personalized coupons and updates.', { chat_id: chatId, message_id: messageId });
        return res.status(200).json({ success: true });
      }

      // Acknowledge the callback immediately (and ignore "query is too old" errors)
      try {
        await botInstance.bot.answerCallbackQuery(callbackQuery.id, { cache_time: 1 });
      } catch (ackErr) {
        console.log('⚠️ answerCallbackQuery failed (continuing):', ackErr?.message || ackErr);
      }

      // Debounce: ignore repeated clicks on same action within short window
      try {
        const { isRateLimited, setRateLimit } = require('../../../lib/storage');
        const debounceKey = `cb:${chatId}:${action}`;
        if (await isRateLimited(debounceKey)) {
          // Silently ignore spams to avoid flooding
          return res.status(200).json({ success: true, message: 'debounced' });
        }
        await setRateLimit(debounceKey, 5); // 5 seconds debounce per action per chat
      } catch (e) {
        console.log('⚠️ debounce not available:', e.message);
      }

      // Handle different actions directly
      try {
        try { await recordInteraction(callbackQuery, 'callback', { action }); } catch (_) {}
        // Wizard actions prefixed with wiz:
        if (action.startsWith('wiz:')) {
          const { getState, setState, clearState } = require('../../../lib/wizard-state');
          const st = await getState(chatId);
          // Generic text selection helper
          if (action.startsWith('wiz:text:')) {
            const choice = action.replace('wiz:text:', '');
            if (choice === 'custom') {
              st.awaiting = 'b1_text'; await setState(chatId, st);
              return await botInstance.bot.sendMessage(chatId, '✍️ Type text for Button 1');
            }
            st.data = st.data || {}; st.data.b1 = st.data.b1 || {}; st.data.b1.text = choice;
            st.awaiting = null; st.step = 2; await setState(chatId, st);
            return await botInstance.bot.sendMessage(chatId, '🧩 Choose URL for Button 1', {
              reply_markup: { inline_keyboard: [[
                { text: 'Football', callback_data: 'wiz:buttons:2:url:https://t.me/Sportmsterbot?start=football' },
                { text: 'Live', callback_data: 'wiz:buttons:2:url:https://t.me/Sportmsterbot?start=live' }
              ], [{ text: 'Promo', callback_data: 'wiz:buttons:2:url:https://t.me/Sportmsterbot?start=promo' }],
              [{ text: '✍️ Type URL', callback_data: 'wiz:buttons:2:url:custom' }]] }
            });
          }
          if (action.startsWith('wiz:buttons:2:url:')) {
            const url = action.replace('wiz:buttons:2:url:', '');
            if (url === 'custom') {
              st.awaiting = 'b1_url'; await setState(chatId, st);
              return await botInstance.bot.sendMessage(chatId, '✍️ Type URL for Button 1');
            }
            st.data = st.data || {}; st.data.b1 = st.data.b1 || {}; st.data.b1.url = url;
            st.step = 99; await setState(chatId, st);
            return await botInstance.bot.sendMessage(chatId, '📦 Save scope?', {
              reply_markup: { inline_keyboard: [[
                { text: '✅ Persist', callback_data: 'wiz:buttons:scope:persist' },
                { text: '🕘 Once', callback_data: 'wiz:buttons:scope:once' }
              ]] }
            });
          }
          // Back navigation
          if (action.startsWith('wiz:back:')) {
            const parts = action.split(':'); // wiz:back:<type>:<step>
            const typ = parts[2];
            const step = parts[3];
            if (typ === 'buttons') {
              if (step === '1') {
                st.awaiting = 'b1_text'; await setState(chatId, st);
                return await botInstance.bot.sendMessage(chatId, '🧩 Step 1/4: Choose text for Button 1', {
                  reply_markup: { inline_keyboard: [[
                    { text: '⚽ Football', callback_data: 'wiz:text:⚽ Football' },
                    { text: '🔴 Live', callback_data: 'wiz:text:🔴 Live' }
                  ], [{ text: '🎁 Coupon', callback_data: 'wiz:text:🎁 Coupon' }],
                  [{ text: '✍️ Type Text', callback_data: 'wiz:text:custom' }]] }
                });
              }
              if (step === '2') {
                st.awaiting = 'b1_url'; await setState(chatId, st);
                return await botInstance.bot.sendMessage(chatId, '🧩 Choose URL for Button 1', {
                  reply_markup: { inline_keyboard: [[
                    { text: 'Football', callback_data: 'wiz:buttons:2:url:https://t.me/Sportmsterbot?start=football' },
                    { text: 'Live', callback_data: 'wiz:buttons:2:url:https://t.me/Sportmsterbot?start=live' }
                  ], [{ text: 'Promo', callback_data: 'wiz:buttons:2:url:https://t.me/Sportmsterbot?start=promo' }],
                  [{ text: '✍️ Type URL', callback_data: 'wiz:buttons:2:url:custom' }]] }
                });
              }
            }
            if (typ === 'coupon') {
              if (step === '1') {
                st.awaiting = 'coupon_code'; await setState(chatId, st);
                return await botInstance.bot.sendMessage(chatId, '🎟️ Step 1/3: Choose coupon code', {
                  reply_markup: { inline_keyboard: [[
                  { text: 'SM100', callback_data: 'wiz:coupon:1:code:SM100' },
                    { text: 'gize200', callback_data: 'wiz:coupon:1:code:gize200' }
                  ], [{ text: '✍️ Type code', callback_data: 'wiz:coupon:1:code:custom' }]] }
                });
              }
              if (step === '2') {
                st.awaiting = 'coupon_offer'; await setState(chatId, st);
                return await botInstance.bot.sendMessage(chatId, '🎟️ Choose offer', {
                  reply_markup: { inline_keyboard: [[
                    { text: '100 ETB Bonus', callback_data: 'wiz:coupon:2:offer:100 ETB Bonus' },
                    { text: 'Free Bet', callback_data: 'wiz:coupon:2:offer:Free Bet' }
                  ], [{ text: 'Boost 10%', callback_data: 'wiz:coupon:2:offer:Boost 10%' }],
                  [{ text: '✍️ Type offer', callback_data: 'wiz:coupon:2:offer:custom' }]] }
                });
              }
            }
          }
          if (action.startsWith('wiz:coupon:1:code:')) {
            const code = action.replace('wiz:coupon:1:code:', '');
            if (code === 'custom') {
              st.awaiting = 'coupon_code'; await setState(chatId, st);
              return await botInstance.bot.sendMessage(chatId, '✍️ Type coupon code');
            }
            st.data = st.data || {}; st.data.code = code; st.step = 2; await setState(chatId, st);
            return await botInstance.bot.sendMessage(chatId, '🎟️ Choose offer', {
              reply_markup: { inline_keyboard: [[
                { text: '100 ETB Bonus', callback_data: 'wiz:coupon:2:offer:100 ETB Bonus' },
                { text: 'Free Bet', callback_data: 'wiz:coupon:2:offer:Free Bet' }
              ], [{ text: 'Boost 10%', callback_data: 'wiz:coupon:2:offer:Boost 10%' }],
              [{ text: '✍️ Type offer', callback_data: 'wiz:coupon:2:offer:custom' }]] }
            });
          }
          if (action.startsWith('wiz:buttons:scope:')) {
            const scope = action.endsWith(':once') ? 'once' : 'persist';
            const { setButtons } = require('../../../lib/settings-store');
            const buttons = [];
            if (st?.data?.b1?.text && st?.data?.b1?.url) buttons.push(st.data.b1);
            if (st?.data?.b2?.text && st?.data?.b2?.url) buttons.push(st.data.b2);
            if (st?.data?.b3?.text && st?.data?.b3?.url) buttons.push(st.data.b3);
            await setButtons(buttons, scope);
            await clearState(chatId);
            return await botInstance.bot.sendMessage(chatId, `✅ Buttons updated (${scope}).`);
          }
          if (action.startsWith('wiz:coupon:2:offer:')) {
            const offer = action.replace('wiz:coupon:2:offer:', '');
            if (offer === 'custom') {
              st.awaiting = 'coupon_offer'; await setState(chatId, st);
              return await botInstance.bot.sendMessage(chatId, '✍️ Type offer text');
            }
            st.data = st.data || {}; st.data.offer = offer; st.step = 3; await setState(chatId, st);
            return await botInstance.bot.sendMessage(chatId, '📦 Save scope?', {
              reply_markup: { inline_keyboard: [[
                { text: '✅ Persist', callback_data: 'wiz:coupon:3:scope:persist' },
                { text: '🕘 Once', callback_data: 'wiz:coupon:3:scope:once' }
              ]] }
            });
          }
          if (action.startsWith('wiz:coupon:3:scope:')) {
            const scope = action.endsWith(':once') ? 'once' : 'persist';
            const { setCoupon } = require('../../../lib/settings-store');
            await setCoupon({ code: st?.data?.code, offer: st?.data?.offer }, scope);
            await clearState(chatId);
            return await botInstance.bot.sendMessage(chatId, `✅ Coupon updated (${scope}).`);
          }
        }

        switch (action) {
          case 'cmd_menu':
            await safeEditMessageText(botInstance.bot, chatId, messageId, '🔄 <i>Refreshing menu...</i>', { parse_mode: 'HTML' });
            await botInstance.showMainMenu(chatId);
            break;

          case 'cmd_predictions':
            console.log('🔍 DEBUG: Processing cmd_predictions callback');
            await safeEditMessageText(botInstance.bot, chatId, messageId, '⚽ <i>Sending predictions...</i>', { parse_mode: 'HTML' });
            await botInstance.executePredictions(chatId);
            break;

          case 'cmd_promo':
            await safeEditMessageText(botInstance.bot, chatId, messageId, '🎁 <i>Sending promo...</i>', { parse_mode: 'HTML' });
            await botInstance.executePromo(chatId);
            break;

          case 'cmd_results':
            await safeEditMessageText(botInstance.bot, chatId, messageId, '📊 <i>Sending results...</i>', { parse_mode: 'HTML' });
            await botInstance.executeResults(chatId);
            break;

          case 'cmd_summary':
            await safeEditMessageText(botInstance.bot, chatId, messageId, '📋 <i>Sending summary...</i>', { parse_mode: 'HTML' });
            await botInstance.executeSummary(chatId);
            break;

          case 'cmd_live':
            await safeEditMessageText(botInstance.bot, chatId, messageId, '🔴 <i>Fetching live matches...</i>', { parse_mode: 'HTML' });
            await botInstance.showLiveMatches(chatId);
            break;

          case 'cmd_today':
            await safeEditMessageText(botInstance.bot, chatId, messageId, '📅 <i>Loading today\'s games...</i>', { parse_mode: 'HTML' });
            await botInstance.showTodayGames(chatId);
            break;

          case 'cmd_today_hype':
            await safeEditMessageText(botInstance.bot, chatId, messageId, '⚡ <i>Creating today hype (may take up to 60s with image)...</i>', { parse_mode: 'HTML' });
            await botInstance.executeTodayHype(chatId);
            break;

          case 'cmd_status':
            await safeEditMessageText(botInstance.bot, chatId, messageId, '📈 <i>Checking system status...</i>', { parse_mode: 'HTML' });
            await botInstance.showSystemStatus(chatId);
            break;

          case 'cmd_news':
            await safeEditMessageText(botInstance.bot, chatId, messageId, '📰 <i>Generating news content...</i>', { parse_mode: 'HTML' });
            await botInstance.executeNews(chatId);
            break;
          case 'cmd_buttons':
            await botInstance.startButtonsWizard(chatId, messageId);
            break;
          case 'cmd_coupon':
            await botInstance.startCouponWizard(chatId, messageId);
            break;

          case 'cmd_analytics':
            await safeEditMessageText(botInstance.bot, chatId, messageId, '📊 <i>Loading analytics data...</i>', { parse_mode: 'HTML' });
            await botInstance.showAnalyticsReport(chatId);
            break;
          case 'cmd_personal_button':
            await safeEditMessageText(botInstance.bot, chatId, messageId, '👤 <i>Posting personal coupons button...</i>', { parse_mode: 'HTML' });
            await botInstance.executePersonalButton(chatId);
            break;
          case 'cmd_personal_users':
            await safeEditMessageText(botInstance.bot, chatId, messageId, '👥 <i>Fetching Personal Subscribers...</i>', { parse_mode: 'HTML' });
            await botInstance.showPersonalSubscribers(chatId);
            break;
          case 'cmd_send_targeted':
            await botInstance.bot.editMessageText(
              '🎯 <i>Send coupons to strong users? (Top 50)</i>',
              { chat_id: chatId, message_id: messageId, parse_mode: 'HTML' }
            );
            await botInstance.bot.sendMessage(chatId, 'Confirm sending targeted coupons:', {
              reply_markup: { inline_keyboard: [[
                { text: '✅ Send Now', callback_data: 'cmd_send_targeted_confirm' },
                { text: '❌ Cancel', callback_data: 'cmd_menu' }
              ]] }
            });
            break;
          case 'cmd_send_targeted_confirm':
            try {
              const { supabase } = require('../../../lib/supabase');
              if (!supabase) throw new Error('Supabase not configured');
              const { data, error } = await supabase
                .from('user_metrics')
                .select('user_id, score, users!inner(first_name, last_name, username)')
                .order('score', { ascending: false })
                .limit(50);
              if (error) throw error;
              const users = data || [];
              let sent = 0;
              for (const u of users) {
                try {
                  // Personal coupon tracking link via redirect with encoded user id
                  const TelegramManager = require('../../../lib/telegram');
                  const t = new TelegramManager();
                  const dest = 'https://t.me/Sportmsterbot?start=promo';
                  const trackId = `pc_${u.user_id}_SM100`;
                  const url = t.createTrackingUrl(dest, trackId, { appendUserId: true, userId: u.user_id });
                  const name = (u.users?.first_name || '') + (u.users?.last_name ? ' ' + u.users.last_name : '') || (u.users?.username ? '@'+u.users.username : 'Friend');
                  await botInstance.bot.sendMessage(u.user_id,
                    `🎟️ Hey ${name}!\n\nYour personal bonus is ready.\nUse code: <b>SM100</b>\n${url}`,
                    { parse_mode: 'HTML' }
                  );
                  sent++;
                } catch (_) {}
              }
              await botInstance.bot.sendMessage(chatId, `✅ Sent to ${sent} users.`);
            } catch (err) {
              await botInstance.bot.sendMessage(chatId, `❌ Failed: ${err.message}`);
            }
            break;

          case 'cmd_emergency_stop':
            await botInstance.bot.editMessageText(
              '🆘 <i>EMERGENCY STOP ACTIVATED!</i>',
              { chat_id: chatId, message_id: messageId, parse_mode: 'HTML' }
            );
            await botInstance.emergencyStop(chatId);
            break;

          // Promo send path
          case 'promo:send:with_buttons':
          case 'promo:send:text_only':
            try {
              const pending = botInstance._pendingPromo?.get(chatId);
              const baseUrl = pending?.baseUrl || (process.env.NODE_ENV === 'development' ? 'http://localhost:3000' : (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://sportmasterbot-ccv2r9g0q-idosegev23s-projects.vercel.app'));
              const resp = await axios.post(`${baseUrl}/api/manual/promo`, { withButtons: action.endsWith('with_buttons') }, { headers: { 'Content-Type': 'application/json', 'x-bot-internal': 'true' }, timeout: 60000 });
              botInstance._pendingPromo?.delete(chatId);
              if (resp.data.success) {
                await botInstance.bot.sendMessage(chatId, '✅ Promo sent successfully!', { parse_mode: 'HTML' });
              } else {
                await botInstance.bot.sendMessage(chatId, '❌ Failed to send promo: ' + (resp.data.message || 'Unknown error'));
              }
            } catch (e) {
              await botInstance.bot.sendMessage(chatId, '❌ Failed to send promo: ' + e.message);
            }
            break;

          default:
            // Forward to SimpleBotCommands callback handlers
            console.log('🔄 Forwarding callback to SimpleBotCommands:', action);
            try {
              // Call the callback handler directly
              if (botInstance.handleCallback) {
                await botInstance.handleCallback(callbackQuery);
              } else {
                // Extract callback logic and call directly
                await botInstance.bot.answerCallbackQuery(callbackQuery.id);
                
                // Handle cmd_news specifically
                if (action === 'cmd_news') {
                  await botInstance.bot.editMessageText(
                    '📰 <i>Generating news content...</i>',
                    { chat_id: chatId, message_id: messageId, parse_mode: 'HTML' }
                  );
                  await botInstance.executeNews(chatId);
                } else {
                  await botInstance.bot.sendMessage(chatId, '❓ Unknown action: ' + action);
                }
              }
            } catch (error) {
              console.error('❌ Callback forwarding error:', error);
              await botInstance.bot.sendMessage(chatId, '❌ Error: ' + error.message);
            }
        }
      } catch (error) {
        console.error('❌ Callback error:', error);
        await botInstance.bot.sendMessage(chatId, '❌ Error: ' + error.message);
      }
    }

    res.status(200).json({ 
      success: true, 
      message: 'Webhook processed successfully',
      timestamp: new Date().toISOString(),
      updateType: update.message ? 'message' : update.callback_query ? 'callback_query' : 'other'
    });

  } catch (error) {
    console.error('❌ Webhook error:', error);
    res.status(500).json({ 
      error: 'Webhook processing failed',
      message: error.message 
    });
  }
}