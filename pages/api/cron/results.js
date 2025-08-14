// Vercel Cron endpoint for daily results
// Scheduled to run daily at 11 PM (Ethiopia time)

export default async function handler(req, res) {
  // Only allow GET requests from Vercel Cron
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Verify this is a legitimate cron request
  const authHeader = req.headers.authorization;
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    console.log('🕚 Cron: Executing daily results...');
    
    // Initialize scheduler for this execution
const GizeBetsScheduler = require('../../../lib/scheduler');
const scheduler = new GizeBetsScheduler();

    const ethiopianTime = new Date().toLocaleString("en-US", {timeZone: "Africa/Addis_Ababa"});
    
    // Execute manual results
    const result = await scheduler.executeManualResults();
    
    res.status(200).json({
      success: true,
      message: 'Daily results sent successfully',
      result: result,
      ethiopianTime: ethiopianTime,
      executedAt: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Cron results error:', error);
    
    res.status(500).json({
      success: false,
      message: 'Failed to execute daily results',
      error: error.message,
      ethiopianTime: new Date().toLocaleString("en-US", {timeZone: "Africa/Addis_Ababa"}),
      executedAt: new Date().toISOString()
    });
  }
}