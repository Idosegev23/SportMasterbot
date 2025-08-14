// Fix webhook rate limit issue
const fetch = require('node-fetch');

async function fixWebhook() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const baseUrl = `https://api.telegram.org/bot${token}`;
  
  try {
    console.log('🔄 Clearing existing webhook...');
    
    // First clear the webhook
    const clearResponse = await fetch(`${baseUrl}/deleteWebhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    
    const clearData = await clearResponse.json();
    console.log('Clear result:', clearData);
    
    // Wait 2 seconds
    console.log('⏳ Waiting 2 seconds...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Set new webhook
    const webhookUrl = process.env.VERCEL_URL ? `${process.env.VERCEL_URL}/api/webhook/telegram` : 'https://sportmaster-bot.vercel.app/api/webhook/telegram';
    console.log('🌐 Setting webhook to:', webhookUrl);
    
    const setResponse = await fetch(`${baseUrl}/setWebhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: webhookUrl })
    });
    
    const setData = await setResponse.json();
    console.log('Set result:', setData);
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

fixWebhook();