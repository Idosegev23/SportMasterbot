// Auto-start bot when application loads (for Vercel)
const SimpleBotCommands = require('../../../lib/simple-bot-commands');

let botInstance = null;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('🚀 Auto-starting Telegram bot...');

    if (botInstance) {
      return res.json({
        success: true,
        message: 'Bot is already running',
        status: 'running'
      });
    }

    // Create and start bot instance
    botInstance = new SimpleBotCommands();
    const started = await botInstance.start();
    
    if (started) {
      console.log('✅ Bot auto-started successfully');
      res.json({
        success: true,
        message: 'Bot started successfully',
        status: 'running',
        timestamp: new Date().toISOString(),
        ethiopianTime: new Date().toLocaleString('en-US', { timeZone: 'Africa/Addis_Ababa' })
      });
    } else {
      console.error('❌ Failed to auto-start bot');
      res.status(500).json({
        success: false,
        message: 'Failed to start bot',
        status: 'error'
      });
    }

  } catch (error) {
    console.error('❌ Auto-start error:', error);
    res.status(500).json({
      success: false,
      message: 'Auto-start failed: ' + error.message,
      error: error.message
    });
  }
}

// Export for webhook handler to use same instance
export { botInstance };