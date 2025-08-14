// 🗑️ Clear Bot Commands API
// Clears all bot commands in Telegram (useful for removing old commands)

const TelegramBot = require('node-telegram-bot-api');

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  try {
    console.log('🗑️ Clearing bot commands...');

    if (!process.env.TELEGRAM_BOT_TOKEN) {
      return res.status(500).json({
        success: false,
        message: 'TELEGRAM_BOT_TOKEN not configured'
      });
    }

    const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: false });

    // Clear all commands
    await bot.setMyCommands([]);
    console.log('✅ All bot commands cleared successfully');

    res.json({
      success: true,
      message: 'All bot commands cleared successfully! Now restart the bot to set new commands.',
      timestamp: new Date().toISOString(),
      ethiopianTime: new Date().toLocaleString('en-US', { timeZone: 'Africa/Addis_Ababa' })
    });

  } catch (error) {
    console.error('❌ Failed to clear commands:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to clear commands: ' + error.message,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
}