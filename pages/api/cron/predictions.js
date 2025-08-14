// Manual predictions endpoint - for testing and manual triggers
// The automated scheduling is now handled by daily-setup.js + check-timing.js

const FootballAPI = require('../../../lib/football-api');
const ContentGenerator = require('../../../lib/content-generator');
const TelegramManager = require('../../../lib/telegram');

export default async function handler(req, res) {
  // Allow both GET and POST for manual testing
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // For manual testing, allow requests without auth header
  const isManualTest = req.method === 'POST' || !req.headers.authorization;
  
  if (!isManualTest) {
    // Verify this is a legitimate cron request
    const authHeader = req.headers.authorization;
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }

  try {
    console.log('🎯 Manual predictions trigger...');
    
    // Load settings for website URL and promo codes
    let settings;
    try {
      const { systemSettings } = await import('../settings');
      settings = systemSettings;
    } catch (error) {
      console.log('⚠️ Using default settings');
      settings = {
        websiteUrl: '',
        promoCodes: ['SM100'],
        autoPosting: { dynamicTiming: true }
      };
    }

    // Initialize components
    const footballAPI = new FootballAPI();
    const contentGenerator = new ContentGenerator(settings.websiteUrl);
    const telegram = new TelegramManager();

    // Get today's matches
    let matches;
    try {
      matches = await footballAPI.getEnhancedTop5Matches();
      console.log('✅ Enhanced match data loaded');
    } catch (error) {
      console.log('⚠️ Enhanced data failed, using basic matches');
      matches = await footballAPI.getTodayMatches();
    }

    if (matches.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'No matches found for predictions',
        matchCount: 0,
        ethiopianTime: new Date().toLocaleString("en-US", {timeZone: "Africa/Addis_Ababa"})
      });
    }

    // Generate and send predictions with AI images
    const randomPromoCode = settings.promoCodes[Math.floor(Math.random() * settings.promoCodes.length)];
    const content = await contentGenerator.generateTop5Predictions(matches, randomPromoCode);
    const message = await telegram.sendPredictions(content, matches);

    console.log('✅ Manual predictions sent successfully');
    
    res.status(200).json({
      success: true,
      message: 'Manual predictions sent successfully',
      matchCount: matches.length,
      hasEnhancedData: matches.length > 0 && matches[0].homeTeamData,
      messageId: message.message_id,
      promoCode: randomPromoCode,
      ethiopianTime: new Date().toLocaleString("en-US", {timeZone: "Africa/Addis_Ababa"}),
      executedAt: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Manual predictions error:', error);
    
    res.status(500).json({
      success: false,
      message: 'Failed to execute manual predictions',
      error: error.message,
      ethiopianTime: new Date().toLocaleString("en-US", {timeZone: "Africa/Addis_Ababa"}),
      executedAt: new Date().toISOString()
    });
  }
}