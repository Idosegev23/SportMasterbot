// Vercel Cron endpoint for daily promotional messages
// Scheduled to run at 10 AM, 2 PM, and 6 PM (Ethiopia time)

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
    console.log('🎁 Cron: Executing scheduled promo...');
    
    // Initialize scheduler for this execution
const GizeBetsScheduler = require('../../../lib/scheduler');
const scheduler = new GizeBetsScheduler();

    const ethiopianTime = new Date().toLocaleString("en-US", {timeZone: "Africa/Addis_Ababa"});
    const currentHour = new Date(ethiopianTime).getHours();
    
    // Determine promo type based on time
    let promoType = 'special';
    if (currentHour >= 9 && currentHour < 12) {
      promoType = 'morning';
    } else if (currentHour >= 13 && currentHour < 17) {
      promoType = 'afternoon';
    } else if (currentHour >= 17 && currentHour < 21) {
      promoType = 'evening';
    }

    // Execute manual promo
    const result = await scheduler.executeManualPromo(promoType);
    
    res.status(200).json({
      success: true,
      message: `${promoType} promo sent successfully`,
      result: {
        messageId: result.message_id,
        promoType: promoType
      },
      ethiopianTime: ethiopianTime,
      executedAt: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Cron promo error:', error);
    
    res.status(500).json({
      success: false,
      message: 'Failed to execute scheduled promo',
      error: error.message,
      ethiopianTime: new Date().toLocaleString("en-US", {timeZone: "Africa/Addis_Ababa"}),
      executedAt: new Date().toISOString()
    });
  }
}