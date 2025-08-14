// Simple System Status API

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ 
      success: false, 
      message: 'Method not allowed. Use GET.' 
    });
  }

  try {
    const now = new Date();
    const ethiopianTime = now.toLocaleString('en-US', { timeZone: 'Africa/Addis_Ababa' });

    // Simple status response
    const status = {
      success: true,
      timestamp: now.toISOString(),
      ethiopianTime: ethiopianTime,
      system: {
        status: 'active',
        uptime: `${Math.floor(process.uptime() / 3600)}h ${Math.floor((process.uptime() % 3600) / 60)}m`,
        isRunning: true,
        message: 'System operational'
      },
      channelInfo: {
        channelId: process.env.CHANNEL_ID || '@africansportdata',
        language: 'English',
        timezone: 'Africa/Addis_Ababa',
        features: [
          'Daily Predictions',
          'Daily Results', 
          'Promotional Messages',
          'Simple Bot Commands'
        ]
      },
      memoryUsage: {
        used: Math.round(process.memoryUsage().used / 1024 / 1024),
        total: Math.round(process.memoryUsage().rss / 1024 / 1024)
      },
      availableEndpoints: {
        manualPredictions: '/api/manual/predictions',
        manualResults: '/api/manual/results', 
        manualPromo: '/api/manual/promo',
        simpleBotControl: '/api/simple-bot',
        simpleBotUI: '/simple-bot'
      }
    };

    res.json(status);

  } catch (error) {
    console.error('❌ Status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get system status',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
}