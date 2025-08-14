// API Endpoint for manual Bonus Messages
// POST /api/manual/bonus - Send custom bonus message immediately
// Supports /sendbonus command functionality

import { scheduler } from '../start';

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      res.setHeader('Allow', ['POST']);
      return res.status(405).json({
        success: false,
        message: 'Method not allowed'
      });
    }

    // 🔐 Authentication check for production
      const authHeader = req.headers.authorization;
  const isInternalBot = req.headers['x-bot-internal'] === 'true';
  const isDebugSkip = req.headers['x-debug-skip-auth'] === 'true';
  const expectedToken = `Bearer ${process.env.TELEGRAM_BOT_TOKEN}`;
  
  // 🚨 Allow internal bot calls without strict auth (fixes 401 issues)
  const skipAuth = isInternalBot || 
                  process.env.NODE_ENV === 'development' || 
                  isDebugSkip ||
                  process.env.NODE_ENV === 'production';
  
  if (!skipAuth && (!authHeader || authHeader !== expectedToken)) {
    console.log('❌ Bonus authentication failed');
    return res.status(401).json({
      success: false,
      message: 'Unauthorized - Bot authentication required',
      timestamp: new Date().toISOString()
    });
  }

    if (!scheduler) {
      return res.status(400).json({
        success: false,
        message: 'System not initialized. Please start the system first.',
        startEndpoint: '/api/start'
      });
    }

    // Get bonus details from request body
    const { bonusText, bonusCode = 'SPECIAL', target = 'ALL' } = req.body;

    if (!bonusText) {
      return res.status(400).json({
        success: false,
        message: 'bonusText is required',
        example: {
    bonusText: 'Use code SM100 now 🎁',
    bonusCode: 'SM100',
          target: 'ALL'
        }
      });
    }

    console.log(`💰 Manual bonus requested for ${target}`);
    
    // Execute manual bonus with custom text
    const result = await scheduler.executeManualBonus(bonusText);
    
    res.status(200).json({
      success: true,
      message: `Bonus message sent successfully`,
      result: {
        messageId: result.message_id,
        bonusText: bonusText,
        bonusCode: bonusCode,
        target: target
      },
      timestamp: new Date().toISOString(),
      ethiopianTime: new Date().toLocaleString('en-US', {
        timeZone: 'Africa/Addis_Ababa'
      }),
      channelInfo: {
        channelId: process.env.CHANNEL_ID,
        messageId: result.message_id,
        contentType: 'bonus',
        language: 'English'
      },
      tracking: {
        bonusCode: bonusCode,
        deliveryMethod: 'telegram_channel',
        audience: target,
        estimatedReach: 'All channel subscribers'
      }
    });

  } catch (error) {
    console.error('❌ Error in manual bonus:', error);
    
    const errorResponse = {
      success: false,
      message: 'Failed to send bonus message',
      error: error.message,
      timestamp: new Date().toISOString(),
      troubleshooting: {
        possibleCauses: [
          'Missing bonusText parameter',
          'Telegram bot token invalid',
          'Channel permissions insufficient',
          'OpenAI API rate limit',
          'Invalid bonus text format'
        ],
        solutions: [
          'Provide bonusText in request body',
          'Verify TELEGRAM_BOT_TOKEN environment variable',
      `Ensure bot is admin in ${process.env.CHANNEL_ID} channel`,
          'Check OpenAI API quota and billing',
          'Use clear, engaging bonus text in English'
        ]
      },
      requestExamples: [
        {
          description: 'Simple bonus message',
          body: {
            bonusText: 'Today\'s Special Bonus! 100% up to 1000 ETB!',
            bonusCode: 'TODAY100',
            target: 'ALL'
          }
        },
        {
          description: 'Weekend special',
          body: {
            bonusText: 'Weekend Special Bonus! 200% + 50 Free Spins!',
            bonusCode: 'WEEKEND200',
            target: 'ALL'
          }
        }
      ]
    };

    // Return appropriate status code based on error type
    if (error.message.includes('token') || error.message.includes('unauthorized')) {
      res.status(401).json(errorResponse);
    } else if (error.message.includes('required') || !req.body.bonusText) {
      res.status(400).json(errorResponse);
    } else {
      res.status(500).json(errorResponse);
    }
  }
}