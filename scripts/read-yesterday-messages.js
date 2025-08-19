#!/usr/bin/env node

// Script to read all messages sent yesterday in the Telegram channel
const TelegramBot = require('node-telegram-bot-api');

// Configuration
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '8432459386:AAFBBIUzFV9hl-zxJZjxif7Rj2GCKJPbJUI';
const CHANNEL_ID = process.env.CHANNEL_ID || '@africansportdata';

async function readYesterdayMessages() {
  try {
    console.log('📡 מתחיל לקרוא הודעות מאתמול...');
    console.log(`🔍 ערוץ: ${CHANNEL_ID}`);
    
    const bot = new TelegramBot(BOT_TOKEN, { polling: false });
    
    // Calculate yesterday's date range
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);
    
    const yesterdayEnd = new Date(yesterday);
    yesterdayEnd.setHours(23, 59, 59, 999);
    
    console.log(`📅 מחפש הודעות מ: ${yesterday.toLocaleString('he-IL')}`);
    console.log(`📅 עד: ${yesterdayEnd.toLocaleString('he-IL')}`);
    
    // Get channel info first
    let channelInfo;
    try {
      channelInfo = await bot.getChat(CHANNEL_ID);
      console.log(`✅ מידע על הערוץ: ${channelInfo.title || channelInfo.username}`);
    } catch (error) {
      console.error('❌ שגיאה בקבלת מידע על הערוץ:', error.message);
      return;
    }
    
    // Read messages directly from Telegram channel
    console.log('\n📱 קורא הודעות ישירות מהטלגרם...');
    
    try {
      // Get chat info
      const chat = await bot.getChat(CHANNEL_ID);
      console.log(`📊 מידע על הערוץ: ${chat.title || chat.username}`);
      console.log(`👥 מספר חברים: ${chat.member_count || 'לא ידוע'}`);
      
      // Find messages from yesterday by scanning backwards from recent messages
      // We'll start with a high message ID and work backwards
      let foundMessages = [];
      let currentOffset = 0;
      let scanLimit = 100; // Scan last 100 messages
      
      console.log('🔍 סורק הודעות אחרונות...');
      
      // Get recent message updates (this might work if bot has access)
      try {
        const updates = await bot.getUpdates({ 
          limit: 100,
          allowed_updates: ['message', 'channel_post'] 
        });
        
        console.log(`📨 נמצאו ${updates.length} עדכונים אחרונים`);
        
        // Filter for channel posts from yesterday
        const yesterdayMessages = updates.filter(update => {
          if (!update.channel_post) return false;
          
          const messageDate = new Date(update.channel_post.date * 1000);
          return messageDate >= yesterday && messageDate <= yesterdayEnd;
        });
        
        foundMessages = yesterdayMessages.map(update => update.channel_post);
        
      } catch (updatesError) {
        console.log('⚠️ לא יכול לקבל עדכונים:', updatesError.message);
        
        // Alternative approach - try to get channel history using MTProto if available
        console.log('🔄 מנסה גישה חלופית...');
        
        // Since we're channel admin, try to use Telegram's client API
        if (process.env.TELEGRAM_API_ID && process.env.TELEGRAM_API_HASH) {
          try {
            const TelegramStats = require('../lib/telegram-stats');
            const stats = new TelegramStats();
            
            console.log('📡 מגיש להיסטוריית הערוץ דרך MTProto...');
            
            // Get channel history for yesterday
            const channelHistory = await stats.getChannelHistory(
              process.env.CHANNEL_USERNAME || 'africansportdata',
              yesterday,
              yesterdayEnd,
              50
            );
            
            if (channelHistory.length > 0) {
              foundMessages = channelHistory.map(msg => ({
                message_id: msg.id,
                date: msg.date,
                text: msg.message,
                photo: msg.media === 'has_media' ? true : false,
                views: msg.views,
                forwards: msg.forwards
              }));
              
              console.log(`✅ נמצאו ${foundMessages.length} הודעות דרך MTProto`);
            }
            
          } catch (mtError) {
            console.log('❌ שגיאה ב-MTProto:', mtError.message);
          }
        }
      }
      
      // Display found messages
      if (foundMessages.length > 0) {
        console.log(`\n✅ נמצאו ${foundMessages.length} הודעות מאתמול:\n`);
        
        foundMessages
          .sort((a, b) => a.date - b.date) // Sort by time
          .forEach((msg, index) => {
            const time = new Date(msg.date * 1000).toLocaleTimeString('he-IL');
            const date = new Date(msg.date * 1000).toLocaleDateString('he-IL');
            
            console.log(`${index + 1}. 🕐 [${date} ${time}] ID: ${msg.message_id}`);
            
            if (msg.text) {
              const preview = msg.text.length > 150 ? 
                msg.text.substring(0, 150) + '...' : 
                msg.text;
              console.log(`   📝 ${preview}`);
            }
            
            if (msg.photo) {
              console.log(`   🖼️ הודעה עם תמונה`);
            }
            
            if (msg.caption) {
              const captionPreview = msg.caption.length > 100 ? 
                msg.caption.substring(0, 100) + '...' : 
                msg.caption;
              console.log(`   📄 כתובית: ${captionPreview}`);
            }
            
            console.log('');
          });
      } else {
        console.log('❌ לא נמצאו הודעות מאתמול');
        console.log('💡 ייתכן שהבוט לא יכול לגשת להיסטוריה ישנה');
      }
      
    } catch (error) {
      console.error('❌ שגיאה בקריאת הודעות:', error.message);
    }
    
    // Alternative: Try to get recent messages using Bot API (limited)
    console.log('\n🔍 מנסה לקבל הודעות אחרונות מה-API...');
    
    try {
      // Get bot info to see what we can access
      const botInfo = await bot.getMe();
      console.log(`🤖 Bot: ${botInfo.first_name} (@${botInfo.username})`);
      
      // Try to get channel administrators to verify access
      const admins = await bot.getChatAdministrators(CHANNEL_ID);
      const isBotAdmin = admins.some(admin => admin.user.id === botInfo.id);
      
      console.log(`🔐 הבוט ${isBotAdmin ? 'הוא' : 'אינו'} מנהל בערוץ`);
      
      if (!isBotAdmin) {
        console.log('⚠️ הבוט צריך להיות מנהל כדי לקרוא הודעות מהערוץ');
        console.log('💡 אפשר לבדוק רק הודעות שנרשמו בבסיס הנתונים');
      }
      
    } catch (error) {
      console.error('❌ שגיאה בבדיקת הרשאות:', error.message);
    }
    
    console.log('\n✅ סיום קריאת הודעות מאתמול');
    
  } catch (error) {
    console.error('❌ שגיאה כללית:', error);
  }
}

// Run the script
if (require.main === module) {
  readYesterdayMessages().then(() => {
    console.log('📊 הסקריפט הסתיים');
    process.exit(0);
  }).catch(error => {
    console.error('❌ שגיאה בהרצת הסקריפט:', error);
    process.exit(1);
  });
}

module.exports = { readYesterdayMessages };