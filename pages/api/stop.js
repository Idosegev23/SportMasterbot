// API Endpoint to stop the SportMaster automated system
// POST /api/stop - Stop the scheduler

import { scheduler } from './start';

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      res.setHeader('Allow', ['POST']);
      return res.status(405).json({
        success: false,
        message: 'Method not allowed'
      });
    }

    if (!scheduler) {
      return res.status(400).json({
        success: false,
        message: 'System is not running or not initialized',
        currentStatus: 'stopped'
      });
    }

    const currentStatus = scheduler.getStatus();
    
    if (!currentStatus.isRunning) {
      return res.status(200).json({
        success: true,
        message: 'System is already stopped',
        status: currentStatus
      });
    }

    // Stop the scheduler
    scheduler.stop();
    
    res.status(200).json({
      success: true,
    message: 'SportMaster automated system stopped successfully',
      previousStatus: currentStatus,
      currentStatus: 'stopped',
      stoppedAt: new Date().toISOString(),
      ethiopianTime: new Date().toLocaleString('en-US', {
        timeZone: 'Africa/Addis_Ababa'
      }),
      note: 'All scheduled tasks have been cancelled. Manual API endpoints still work.'
    });

  } catch (error) {
  console.error('❌ Error stopping SportMaster system:', error);
    
    res.status(500).json({
      success: false,
    message: 'Failed to stop SportMaster system',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
}