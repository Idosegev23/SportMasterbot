// Simple System Start API - Starts the SportMaster automation

const GizeBetsScheduler = require('../../lib/scheduler');

// Global scheduler instance
let scheduler = null;

export default async function handler(req, res) {
  try {
    console.log('🚀 Starting SportMaster system...');

    if (scheduler && scheduler.isRunning) {
      return res.json({
        success: true,
        message: 'SportMaster system is already running',
        status: {
          isRunning: true,
          message: 'System active'
        },
        timestamp: new Date().toISOString(),
        ethiopianTime: new Date().toLocaleString('en-US', { timeZone: 'Africa/Addis_Ababa' })
      });
    }

    // Create and start scheduler
    scheduler = new GizeBetsScheduler();
    await scheduler.loadSettings();
    await scheduler.start();

    console.log('✅ SportMaster system started successfully');

    res.json({
      success: true,
      message: 'SportMaster system started successfully',
      status: {
        isRunning: true,
        dailyStats: scheduler.dailyStats || { predictionsPosted: 0, resultsPosted: 0, promosPosted: 0, errors: 0 },
        nextScheduled: {
          predictions: 'Every 2 hours (8 AM - 8 PM)',
          results: 'Daily at 11 PM',
          promos: '10 AM, 2 PM, 6 PM',
          analytics: 'Midnight'
        },
        timezone: 'Africa/Addis_Ababa'
      },
      appliedConfig: 'default',
      timestamp: new Date().toISOString(),
      ethiopianTime: new Date().toLocaleString('en-US', { timeZone: 'Africa/Addis_Ababa' })
    });

  } catch (error) {
    console.error('❌ Failed to start system:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to start SportMaster system',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
}

// Export scheduler for other modules
export { scheduler };