#!/usr/bin/env node

// Script to read all messages sent today in the Telegram channel
const TelegramBot = require('node-telegram-bot-api');

// Configuration
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '8432459386:AAFBBIUzFV9hl-zxJZjxif7Rj2GCKJPbJUI';
const CHANNEL_ID = process.env.CHANNEL_ID || '@africansportdata';

async function readTodayMessages() {
  try {
    console.log('📡 מתחיל לקרוא הודעות מהיום...');
    console.log(`🔍 ערוץ: ${CHANNEL_ID}`);
    
    const bot = new TelegramBot(BOT_TOKEN, { polling: false });
    
    // Calculate today's date range
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);
    
    console.log(`📅 מחפש הודעות מ: ${today.toLocaleString('he-IL')}`);
    console.log(`📅 עד: ${todayEnd.toLocaleString('he-IL')}`);
    
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
      
      // Find messages from today by scanning backwards from recent messages
      let foundMessages = [];
      
      console.log('🔍 סורק הודעות אחרונות...');
      
      // Get recent message updates (this might work if bot has access)
      try {
        const updates = await bot.getUpdates({ 
          limit: 100,
          allowed_updates: ['message', 'channel_post'] 
        });
        
        console.log(`📨 נמצאו ${updates.length} עדכונים אחרונים`);
        
        // Filter for channel posts from today
        const todayMessages = updates.filter(update => {
          if (!update.channel_post) return false;
          
          const messageDate = new Date(update.channel_post.date * 1000);
          return messageDate >= today && messageDate <= todayEnd;
        });
        
        foundMessages = todayMessages.map(update => update.channel_post);
        
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
            
            // Get channel history for today
            const channelHistory = await stats.getChannelHistory(
              process.env.CHANNEL_USERNAME || 'africansportdata',
              today,
              todayEnd,
              100
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
      
      // Try to get from Supabase database as alternative
      console.log('\n💾 מנסה לקבל הודעות מבסיס הנתונים...');
      try {
        const { supabase } = require('../lib/supabase');
        
        const { data: posts, error } = await supabase
          .from('telegram_posts')
          .select('*')
          .gte('created_at', today.toISOString())
          .lte('created_at', todayEnd.toISOString())
          .order('created_at', { ascending: true });
        
        if (error) throw error;
        
        console.log(`📊 נמצאו ${posts.length} הודעות בבסיס הנתונים מהיום`);
        
        if (posts.length > 0) {
          console.log('\n📋 הודעות מבסיס הנתונים:');
          posts.forEach((post, index) => {
            const time = new Date(post.created_at).toLocaleTimeString('he-IL');
            console.log(`${index + 1}. 🕐 [${time}] סוג: ${post.type}`);
            
            if (post.content) {
              const preview = post.content.length > 200 ? 
                post.content.substring(0, 200) + '...' : 
                post.content;
              console.log(`   📝 ${preview}`);
            }
            
            if (post.metadata) {
              console.log(`   📊 מטא-דאטה:`, JSON.stringify(post.metadata, null, 2));
            }
            
            console.log('');
          });
        }
        
      } catch (dbError) {
        console.log('❌ שגיאה בקריאה מבסיס הנתונים:', dbError.message);
      }
      
      // Display found messages from Telegram
      if (foundMessages.length > 0) {
        console.log(`\n✅ נמצאו ${foundMessages.length} הודעות מהיום בטלגרם:\n`);
        
        foundMessages
          .sort((a, b) => a.date - b.date) // Sort by time
          .forEach((msg, index) => {
            const time = new Date(msg.date * 1000).toLocaleTimeString('he-IL');
            const date = new Date(msg.date * 1000).toLocaleDateString('he-IL');
            
            console.log(`${index + 1}. 🕐 [${date} ${time}] ID: ${msg.message_id}`);
            
            if (msg.text) {
              const preview = msg.text.length > 300 ? 
                msg.text.substring(0, 300) + '...' : 
                msg.text;
              console.log(`   📝 ${preview}`);
            }
            
            if (msg.photo) {
              console.log(`   🖼️ הודעה עם תמונה`);
            }
            
            if (msg.caption) {
              const captionPreview = msg.caption.length > 200 ? 
                msg.caption.substring(0, 200) + '...' : 
                msg.caption;
              console.log(`   📄 כתובית: ${captionPreview}`);
            }
            
            console.log('');
          });
      } else {
        console.log('❌ לא נמצאו הודעות מהיום בטלגרם');
        console.log('💡 ייתכן שהבוט לא יכול לגשת להיסטוריה או שלא נשלחו הודעות היום');
      }
      
    } catch (error) {
      console.error('❌ שגיאה בקריאת הודעות:', error.message);
    }
    
    // Check bot permissions
    console.log('\n🔍 בודק הרשאות הבוט...');
    
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
    
    console.log('\n✅ סיום קריאת הודעות מהיום');
    
  } catch (error) {
    console.error('❌ שגיאה כללית:', error);
  }
}

// Run the script
if (require.main === module) {
  readTodayMessages().then(() => {
    console.log('📊 הסקריפט הסתיים');
    process.exit(0);
  }).catch(error => {
    console.error('❌ שגיאה בהרצת הסקריפט:', error);
    process.exit(1);
  });
}

module.exports = { readTodayMessages };