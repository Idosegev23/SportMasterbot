// Send custom message to specific user

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  try {
    const TelegramManager = require('../../../lib/telegram');
    
    const { userId, message } = req.body || {};
    
    if (!userId || !message) {
      return res.status(400).json({ success: false, message: 'Missing userId or message' });
    }

    const telegram = new TelegramManager();

    // Send direct message to user
    const result = await telegram.bot.sendMessage(userId, message, { 
      parse_mode: 'HTML',
      disable_web_page_preview: true 
    });

    return res.status(200).json({ 
      success: true, 
      message: `✅ Message sent to user ${userId}`,
      messageId: result.message_id 
    });

  } catch (error) {
    console.error('❌ send-message-to-user error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
}