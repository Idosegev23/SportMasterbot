// API Endpoint for SportMaster Settings Management
// GET /api/settings - Get current settings
// POST /api/settings - Update settings

let systemSettings = {
  websiteUrl: '',
  promoCodes: {
    default: 'SM100',
    morning: 'SM100',
    afternoon: 'SM100',
    evening: 'SM100',
    weekend: 'SM100',
    special: 'SM100'
  },
  bonusOffers: {
    default: '100% Bonus',
    morning: '100% Morning Bonus',
    afternoon: '200% Power Bonus',
    evening: '250% Night Bonus',
    weekend: '500% Weekend Special',
    special: 'Special Bonus Up to $1000'
  },
  autoPosting: {
    enabled: true,
    dynamicTiming: true,
    hoursBeforeMatch: 2,
    minGapBetweenPosts: 30
  }
};

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      // Get current settings
      res.status(200).json({
        success: true,
        settings: systemSettings,
        lastUpdated: new Date().toISOString()
      });

    } else if (req.method === 'POST') {
      // Update settings
      const { websiteUrl, promoCodes, bonusOffers, autoPosting } = req.body;

      // Optional website URL (can be empty for this bot)
      if (typeof websiteUrl === 'string') {
        systemSettings.websiteUrl = websiteUrl.trim();
      }

      // Update promo codes
      if (promoCodes) {
        systemSettings.promoCodes = { ...systemSettings.promoCodes, ...promoCodes };
      }

      // Update bonus offers
      if (bonusOffers) {
        systemSettings.bonusOffers = { ...systemSettings.bonusOffers, ...bonusOffers };
      }

      // Update auto posting settings
      if (autoPosting) {
        systemSettings.autoPosting = { ...systemSettings.autoPosting, ...autoPosting };
      }

      console.log('⚙️ Settings updated:', {
        websiteUrl: systemSettings.websiteUrl,
        promoCodes: Object.keys(systemSettings.promoCodes).length,
        bonusOffers: Object.keys(systemSettings.bonusOffers).length,
        autoPosting: systemSettings.autoPosting.enabled
      });

      res.status(200).json({
        success: true,
        message: 'Settings updated successfully',
        settings: systemSettings,
        updatedAt: new Date().toISOString()
      });

    } else {
      res.setHeader('Allow', ['GET', 'POST']);
      res.status(405).json({
        success: false,
        message: 'Method not allowed'
      });
    }

  } catch (error) {
    console.error('❌ Error managing settings:', error);
    
    res.status(500).json({
      success: false,
      message: 'Failed to manage settings',
      error: error.message
    });
  }
}

// Export settings for other modules
export { systemSettings };