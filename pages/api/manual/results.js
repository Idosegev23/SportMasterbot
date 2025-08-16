// Manual Results API - Simple version

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ 
      success: false, 
      message: 'Method not allowed. Use POST.' 
    });
  }

  try {
    const FootballAPI = require('../../../lib/football-api.js');
    const ContentGenerator = require('../../../lib/content-generator.js');
    const TelegramManager = require('../../../lib/telegram.js');

    // Support dry-run mode to avoid sending to Telegram
    // Accept from query (?dryRun=1) or JSON body { dryRun: true }
    const dryRun = Boolean(
      (req.query && (req.query.dryRun === '1' || req.query.dryRun === 'true')) ||
      (req.body && (req.body.dryRun === true || req.body.dryRun === 'true' || req.body.dryRun === 1))
    );

    const footballAPI = new FootballAPI();
    const contentGenerator = new ContentGenerator();
    const telegram = new TelegramManager();

    // Get yesterday's results with optional fallback
    const results = await footballAPI.getYesterdayResults();
    
    if (results.length === 0) {
      return res.json({
        success: false,
        message: 'No results found',
        resultCount: 0
      });
    }

    // Generate results (using generateDailyResults for better formatting)
    const resultsContent = await contentGenerator.generateDailyResults(results);

    // If dry-run, do NOT send to Telegram – just return the generated content
    if (dryRun) {
      return res.json({
        success: true,
        dryRun: true,
        message: `Results generated for ${results.length} matches (not sent)`,
        preview: {
          text: typeof resultsContent === 'string' ? resultsContent.slice(0, 2000) : String(resultsContent).slice(0, 2000),
          totalChars: typeof resultsContent === 'string' ? resultsContent.length : String(resultsContent).length
        },
        resultCount: results.length,
        timestamp: new Date().toISOString(),
        ethiopianTime: new Date().toLocaleString('en-US', { timeZone: 'Africa/Addis_Ababa' })
      });
    }

    // Otherwise send to Telegram
    const result = await telegram.sendResults(resultsContent, results);
    try { await telegram.logPostToSupabase('results', resultsContent, result?.message_id); } catch (_) {}

    res.json({
      success: true,
      message: `Results sent successfully for ${results.length} matches`,
      result: {
        messageId: result?.message_id || null,
        resultCount: results.length
      },
      timestamp: new Date().toISOString(),
      ethiopianTime: new Date().toLocaleString('en-US', { timeZone: 'Africa/Addis_Ababa' }),
      channelInfo: { channelId: process.env.CHANNEL_ID, contentType: 'results', language: 'English' }
    });

  } catch (error) {
    console.error('❌ Results error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send results',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
}