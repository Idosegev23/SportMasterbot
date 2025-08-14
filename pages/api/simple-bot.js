// 🤖 Simple Bot Management API
// Start/Stop/Status for the new simple bot commands

let simpleBotInstance = null;

export default async function handler(req, res) {
  const { action = 'status' } = req.body;

  try {
    console.log(`🤖 Simple bot API: ${action}`);

    switch (action) {
      case 'start':
        if (simpleBotInstance) {
          return res.json({
            success: true,
            message: 'Simple bot is already running',
            status: 'running'
          });
        }

        // Import and start the simple bot
        const SimpleBotCommands = require('../../lib/simple-bot-commands');
        simpleBotInstance = new SimpleBotCommands();
        
        const started = await simpleBotInstance.start();
        
        if (started) {
          res.json({
            success: true,
            message: 'Simple bot started successfully',
            status: 'running',
            timestamp: new Date().toISOString(),
            ethiopianTime: new Date().toLocaleString('en-US', { timeZone: 'Africa/Addis_Ababa' })
          });
        } else {
          res.status(500).json({
            success: false,
            message: 'Failed to start simple bot',
            status: 'error'
          });
        }
        break;

      case 'stop':
        if (!simpleBotInstance) {
          return res.json({
            success: true,
            message: 'Simple bot is not running',
            status: 'stopped'
          });
        }

        const stopped = await simpleBotInstance.stop();
        simpleBotInstance = null;
        
        res.json({
          success: stopped,
          message: stopped ? 'Simple bot stopped successfully' : 'Failed to stop simple bot',
          status: 'stopped',
          timestamp: new Date().toISOString()
        });
        break;

      case 'restart':
        // Stop if running
        if (simpleBotInstance) {
          await simpleBotInstance.stop();
          simpleBotInstance = null;
        }

        // Start fresh
        const SimpleBotCommands2 = require('../../lib/simple-bot-commands');
        simpleBotInstance = new SimpleBotCommands2();
        
        const restarted = await simpleBotInstance.start();
        
        res.json({
          success: restarted,
          message: restarted ? 'Simple bot restarted successfully' : 'Failed to restart simple bot',
          status: restarted ? 'running' : 'error',
          timestamp: new Date().toISOString(),
          ethiopianTime: new Date().toLocaleString('en-US', { timeZone: 'Africa/Addis_Ababa' })
        });
        break;

      case 'status':
      default:
        const isRunning = simpleBotInstance !== null;
        
        res.json({
          success: true,
          status: isRunning ? 'running' : 'stopped',
          message: `Simple bot is ${isRunning ? 'running' : 'stopped'}`,
          instance: !!simpleBotInstance,
          timestamp: new Date().toISOString(),
          ethiopianTime: new Date().toLocaleString('en-US', { timeZone: 'Africa/Addis_Ababa' }),
          memoryUsage: process.memoryUsage(),
          uptime: process.uptime(),
          availableActions: ['start', 'stop', 'restart', 'status']
        });
        break;
    }

  } catch (error) {
    console.error('❌ Simple bot API error:', error);
    res.status(500).json({
      success: false,
      message: 'Simple bot API error: ' + error.message,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
}