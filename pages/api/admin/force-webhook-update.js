// 🔄 Force Webhook Update - Manual endpoint to update webhook URL
export default async function handler(req, res) {
  try {
    console.log('🔄 Manual webhook update requested...');
    
    const SimpleBotCommands = require('../../../lib/simple-bot-commands');
    const bot = new SimpleBotCommands();
    
    // Force webhook setup
    const success = await bot.setupWebhook();
    
    if (success) {
      console.log('✅ Webhook updated successfully');
      res.status(200).json({ 
        success: true, 
        message: 'Webhook updated successfully',
        timestamp: new Date().toISOString()
      });
    } else {
      console.log('❌ Failed to update webhook');
      res.status(500).json({ 
        success: false, 
        message: 'Failed to update webhook',
        timestamp: new Date().toISOString()
      });
    }
    
  } catch (error) {
    console.error('❌ Force webhook update error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error updating webhook',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
}