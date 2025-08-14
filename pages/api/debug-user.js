// 🔍 Debug User ID API
// Shows who is trying to access the bot for debugging

const TelegramBot = require('node-telegram-bot-api');

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  try {
    console.log('🔍 Debug User ID request...');

    if (!process.env.TELEGRAM_BOT_TOKEN) {
      return res.status(500).json({
        success: false,
        message: 'TELEGRAM_BOT_TOKEN not configured'
      });
    }

    const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: false });

    // Get current admin users from environment
    const adminUsers = [];
    if (process.env.ADMIN_USER_IDS) {
      const envIds = process.env.ADMIN_USER_IDS.split(',')
        .map(id => parseInt(id.trim()))
        .filter(id => !isNaN(id));
      adminUsers.push(...envIds);
    }
    
    // Add default test admin if no IDs found
    if (adminUsers.length === 0) {
      adminUsers.push(2024477887); // Test admin
    }

    // Get recent updates to see who's trying to use the bot
    const updates = await bot.getUpdates({ limit: 10 });
    
    const recentUsers = updates.map(update => {
      if (update.message) {
        return {
          userId: update.message.from.id,
          username: update.message.from.username,
          firstName: update.message.from.first_name,
          text: update.message.text,
          isAdmin: adminUsers.includes(update.message.from.id),
          date: new Date(update.message.date * 1000).toISOString()
        };
      }
      return null;
    }).filter(Boolean);

    res.json({
      success: true,
      message: 'Debug info retrieved successfully',
      data: {
        configuredAdmins: adminUsers,
        recentUsers: recentUsers,
        botInfo: await bot.getMe(),
        totalUpdates: updates.length,
        environmentCheck: {
          hasToken: !!process.env.TELEGRAM_BOT_TOKEN,
          hasAdminIds: !!process.env.ADMIN_USER_IDS,
          nodeEnv: process.env.NODE_ENV
        }
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Failed to debug user:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to debug user: ' + error.message,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
}