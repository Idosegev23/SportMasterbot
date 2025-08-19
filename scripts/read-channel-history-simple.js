#!/usr/bin/env node

// Simple script to read channel history by temporarily disabling webhook
const TelegramBot = require('node-telegram-bot-api');

// Configuration
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '8432459386:AAFBBIUzFV9hl-zxJZjxif7Rj2GCKJPbJUI';
const CHANNEL_ID = process.env.CHANNEL_ID || '@africansportdata';

async function readChannelHistory() {
  try {
    console.log('📡 מתחיל לקרוא היסטוריית הערוץ...');
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
    
    // Get current webhook info using direct API call
    try {
      const webhookInfo = await bot._request('getWebhookInfo');
      console.log(`🔗 Webhook נוכחי: ${webhookInfo.url || 'לא מוגדר'}`);
      
      if (webhookInfo.url) {
        console.log('⚠️ מכבה Webhook זמנית כדי לקרוא הודעות...');
        await bot._request('deleteWebhook');
        console.log('✅ Webhook נמחק זמנית');
      }
    } catch (webhookError) {
      console.log('⚠️ לא יכול לבדוק Webhook, ממשיך בכל זאת...');
    }
    
    // Small delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    try {
      // Now try to get updates using direct API call
      console.log('📨 מקבל עדכונים אחרונים...');
      const updates = await bot._request('getUpdates', { 
        limit: 100,
        allowed_updates: ['channel_post'] 
      });
      
      console.log(`📊 נמצאו ${updates.length} עדכונים`);
      
      // Filter for channel posts from yesterday
      const yesterdayMessages = updates.filter(update => {
        if (!update.channel_post) return false;
        
        const messageDate = new Date(update.channel_post.date * 1000);
        return messageDate >= yesterday && messageDate <= yesterdayEnd;
      });
      
      if (yesterdayMessages.length > 0) {
        console.log(`\n✅ נמצאו ${yesterdayMessages.length} הודעות מאתמול:\n`);
        
        yesterdayMessages
          .sort((a, b) => a.channel_post.date - b.channel_post.date)
          .forEach((update, index) => {
            const msg = update.channel_post;
            const time = new Date(msg.date * 1000).toLocaleTimeString('he-IL');
            const date = new Date(msg.date * 1000).toLocaleDateString('he-IL');
            
            console.log(`${index + 1}. 🕐 [${date} ${time}] ID: ${msg.message_id}`);
            
            if (msg.text) {
              const preview = msg.text.length > 200 ? 
                msg.text.substring(0, 200) + '...' : 
                msg.text;
              console.log(`   📝 ${preview}`);
            }
            
            if (msg.photo && msg.photo.length > 0) {
              console.log(`   🖼️ הודעה עם תמונה (${msg.photo[msg.photo.length - 1].width}x${msg.photo[msg.photo.length - 1].height})`);
            }
            
            if (msg.caption) {
              const captionPreview = msg.caption.length > 150 ? 
                msg.caption.substring(0, 150) + '...' : 
                msg.caption;
              console.log(`   📄 כתובית: ${captionPreview}`);
            }
            
            if (msg.reply_markup && msg.reply_markup.inline_keyboard) {
              console.log(`   ⌨️ כפתורים: ${msg.reply_markup.inline_keyboard.length} שורות`);
            }
            
            console.log('');
          });
      } else {
        console.log('❌ לא נמצאו הודעות מאתמול ב-updates');
        
        // Try alternative approach - get some recent updates and show them
        console.log('\n📋 הודעות אחרונות שנמצאו (לא מאתמול):');
        const recentChannelPosts = updates
          .filter(u => u.channel_post)
          .slice(-10); // Last 10 channel posts
          
        if (recentChannelPosts.length > 0) {
          recentChannelPosts.forEach((update, index) => {
            const msg = update.channel_post;
            const time = new Date(msg.date * 1000).toLocaleString('he-IL');
            console.log(`${index + 1}. [${time}] ID: ${msg.message_id}`);
            if (msg.text) {
              console.log(`   📝 ${msg.text.substring(0, 100)}${msg.text.length > 100 ? '...' : ''}`);
            }
            if (msg.caption) {
              console.log(`   📄 ${msg.caption.substring(0, 100)}${msg.caption.length > 100 ? '...' : ''}`);
            }
          });
        } else {
          console.log('❌ לא נמצאו הודעות כלל ב-updates');
        }
      }
      
    } catch (updatesError) {
      console.error('❌ שגיאה בקבלת עדכונים:', updatesError.message);
    }
    
    // Note: We'll restore webhook manually later
    console.log('\n⚠️ Webhook נותק - יש להפעיל מחדש דרך ה-API או הממשק');
    
  } catch (error) {
    console.error('❌ שגיאה כללית:', error);
  }
}

// Run the script
if (require.main === module) {
  readChannelHistory().then(() => {
    console.log('\n📊 הסקריפט הסתיים');
    process.exit(0);
  }).catch(error => {
    console.error('❌ שגיאה בהרצת הסקריפט:', error);
    process.exit(1);
  });
}

module.exports = { readChannelHistory };