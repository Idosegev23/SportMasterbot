#!/usr/bin/env node

// Script to check recent channel messages by trying different message IDs
const TelegramBot = require('node-telegram-bot-api');

// Configuration
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '8432459386:AAFBBIUzFV9hl-zxJZjxif7Rj2GCKJPbJUI';
const CHANNEL_ID = process.env.CHANNEL_ID || '@africansportdata';

async function checkChannelMessages() {
  try {
    console.log('📡 בודק הודעות אחרונות בערוץ...');
    console.log(`🔍 ערוץ: ${CHANNEL_ID}`);
    
    const bot = new TelegramBot(BOT_TOKEN, { polling: false });
    
    // Calculate yesterday's date range
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    console.log(`📅 מחפש הודעות מ: ${yesterday.toLocaleDateString('he-IL')}`);
    
    // Get bot info first
    const botInfo = await bot._request('getMe');
    console.log(`🤖 Bot: ${botInfo.first_name} (@${botInfo.username})`);
    
    // Get channel info
    const chat = await bot._request('getChat', { chat_id: CHANNEL_ID });
    console.log(`📊 ערוץ: ${chat.title} (${chat.username})`);
    console.log(`👥 חברים: ${chat.member_count || 'לא ידוע'}`);
    
    // Try to find recent messages by trying different message IDs
    console.log('\n🔍 מחפש הודעות לפי Message ID...');
    
    let foundMessages = [];
    
    // Try a range of recent message IDs (this is somewhat of a hack but might work)
    // We'll try the last 50 message IDs
    for (let i = 0; i < 50; i++) {
      try {
        // Start from a reasonably high number and work backwards
        const testMessageId = Date.now() - (i * 100000); // Rough estimation
        
        // Try to get message info (this might fail for non-existent messages)
        const result = await bot._request('forwardMessage', {
          chat_id: botInfo.id, // Forward to bot itself (private chat)
          from_chat_id: CHANNEL_ID,
          message_id: testMessageId,
          disable_notification: true
        });
        
        // If we successfully forwarded, the message exists
        if (result) {
          console.log(`✅ מצא הודעה: ID ${testMessageId}`);
          foundMessages.push(testMessageId);
        }
        
      } catch (error) {
        // Message doesn't exist or can't be forwarded, skip
        if (error.message.includes('MESSAGE_ID_INVALID') || 
            error.message.includes('message not found')) {
          continue;
        } else {
          console.log(`⚠️ שגיאה ב-ID ${testMessageId - (i * 100000)}: ${error.message}`);
        }
      }
      
      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    console.log(`📊 נמצאו ${foundMessages.length} הודעות אפשריות`);
    
    if (foundMessages.length === 0) {
      console.log('\n❌ לא הצלחתי למצוא הודעות דרך Forward');
      console.log('💡 בואו ננסה גישה אחרת...');
      
      // Alternative: Use the channel's recent post statistics
      try {
        console.log('\n🔍 מנסה לקרוא סטטיסטיקות ערוץ...');
        
        // Check if we have any logged posts in our analytics
        const analyticsPath = '../pages/api/analytics.js';
        
        console.log('📊 בדיקת נתוני Analytics...');
        console.log('💡 אפשר לבדוק ב: /api/analytics או ב-Supabase');
        
      } catch (analyticsError) {
        console.log('⚠️ לא יכול לגשת לנתוני Analytics:', analyticsError.message);
      }
    }
    
    // Final attempt: Show latest bot activity
    console.log('\n📋 מידע כללי על פעילות הבוט:');
    console.log('🔗 ערוץ:', chat.username);
    console.log('📱 בוט ID:', botInfo.id);
    console.log('⏰ זמן בדיקה:', new Date().toLocaleString('he-IL'));
    
    console.log('\n💡 כדי לראות הודעות מאתמול:');
    console.log('1. בדוק ב-Telegram Desktop/Mobile את הערוץ ישירות');
    console.log('2. בדוק בלוג Analytics: /api/analytics');
    console.log('3. בדוק Supabase posts table');
    console.log('4. הפעל מחדש Bot Polling (במקום Webhook)');
    
  } catch (error) {
    console.error('❌ שגיאה כללית:', error);
  }
}

// Run the script
if (require.main === module) {
  checkChannelMessages().then(() => {
    console.log('\n📊 הסקריפט הסתיים');
    process.exit(0);
  }).catch(error => {
    console.error('❌ שגיאה בהרצת הסקריפט:', error);
    process.exit(1);
  });
}

module.exports = { checkChannelMessages };