// Vercel Cron endpoint for daily hype post at 09:00 (Ethiopia time)

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
    console.log('⚡ Cron: Executing daily hype...');

    const GizeBetsScheduler = require('../../../lib/scheduler');
    const scheduler = new GizeBetsScheduler();

    const result = await scheduler.executeManualHype();

    const ethiopianTime = new Date().toLocaleString('en-US', { timeZone: 'Africa/Addis_Ababa' });
    res.status(200).json({
      success: true,
      message: 'Today hype sent successfully',
      result: { messageId: result.messageId },
      ethiopianTime,
      executedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Cron hype error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to execute daily hype',
      error: error.message,
      ethiopianTime: new Date().toLocaleString('en-US', { timeZone: 'Africa/Addis_Ababa' }),
      executedAt: new Date().toISOString()
    });
  }
}

