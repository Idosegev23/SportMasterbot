// Automation Control API Endpoint
// Manage automated posting, scheduling, and system automation

const fs = require('fs');
const path = require('path');

// Use memory cache for automation state in serverless
let automationCache = null;

// Default automation settings
const DEFAULT_AUTOMATION = {
  isEnabled: true,
  
  predictions: {
    enabled: true,
    schedule: [8, 10, 12, 14, 16, 18, 20], // Every 2 hours from 8 AM to 8 PM
    lastRun: null,
    nextRun: null,
    totalRuns: 0
  },
  
  results: {
    enabled: true,
    schedule: [23], // 11 PM daily
    lastRun: null,
    nextRun: null,
    totalRuns: 0
  },
  
  promos: {
    enabled: true,
    schedule: [10, 14, 18], // 10 AM, 2 PM, 6 PM
    lastRun: null,
    nextRun: null,
    totalRuns: 0
  },
  
  analytics: {
    enabled: true,
    schedule: [0], // Midnight daily
    lastRun: null,
    nextRun: null,
    totalRuns: 0
  },
  
  dynamicScheduling: {
    enabled: true,
    adaptToMatches: true,
    hoursBeforeMatch: 2,
    skipIfNoMatches: true
  },
  
  failsafe: {
    maxConsecutiveFailures: 3,
    pauseOnFailure: true,
    notifyAdmins: true,
    currentFailures: 0
  }
};

// Load automation state from cache
function loadAutomation() {
  if (automationCache === null) {
    // Initialize with defaults
    automationCache = {
      ...DEFAULT_AUTOMATION,
      lastUpdated: new Date().toISOString()
    };
  }
  return { ...automationCache };
}

// Save automation state to cache
function saveAutomation(automation) {
  try {
    automation.lastUpdated = new Date().toISOString();
    automationCache = { ...automation };
    return true;
  } catch (error) {
    console.error('Error saving automation state to cache:', error);
    return false;
  }
}

// Calculate next run times
function calculateNextRuns(automation) {
  const now = new Date();
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  // Calculate next run for each automation type
  Object.keys(automation).forEach(type => {
    if (automation[type] && automation[type].schedule && Array.isArray(automation[type].schedule)) {
      const schedule = automation[type].schedule;
      let nextRun = null;

      // Find next scheduled time today
      for (const hour of schedule.sort((a, b) => a - b)) {
        const scheduledTime = new Date(today);
        scheduledTime.setHours(hour, 0, 0, 0);
        
        if (scheduledTime > now) {
          nextRun = scheduledTime;
          break;
        }
      }

      // If no time today, use first time tomorrow
      if (!nextRun && schedule.length > 0) {
        const firstHour = Math.min(...schedule);
        nextRun = new Date(tomorrow);
        nextRun.setHours(firstHour, 0, 0, 0);
      }

      automation[type].nextRun = nextRun ? nextRun.toISOString() : null;
    }
  });

  return automation;
}

// Get automation status summary
function getAutomationSummary(automation) {
  const now = new Date();
  
  return {
    isEnabled: automation.isEnabled,
    
    activeAutomations: {
      predictions: automation.predictions.enabled,
      results: automation.results.enabled,
      promos: automation.promos.enabled,
      analytics: automation.analytics.enabled
    },
    
    nextScheduled: {
      predictions: automation.predictions.nextRun,
      results: automation.results.nextRun,
      promos: automation.promos.nextRun,
      analytics: automation.analytics.nextRun
    },
    
    statistics: {
      totalPredictionRuns: automation.predictions.totalRuns,
      totalResultRuns: automation.results.totalRuns,
      totalPromoRuns: automation.promos.totalRuns,
      totalAnalyticsRuns: automation.analytics.totalRuns
    },
    
    health: {
      consecutiveFailures: automation.failsafe.currentFailures,
      maxFailures: automation.failsafe.maxConsecutiveFailures,
      status: automation.failsafe.currentFailures >= automation.failsafe.maxConsecutiveFailures ? 'paused' : 'healthy'
    },
    
    dynamicScheduling: automation.dynamicScheduling
  };
}

export default async function handler(req, res) {
  try {
    console.log(`🤖 Automation API - ${req.method} request...`);

    const automation = loadAutomation();

    switch (req.method) {
      
      // GET - Get automation status
      case 'GET': {
        const automationWithNext = calculateNextRuns(automation);
        const summary = getAutomationSummary(automationWithNext);
        
        return res.status(200).json({
          success: true,
          automation: automationWithNext,
          summary: summary,
          timestamp: new Date().toISOString()
        });
      }

      // POST - Update automation settings
      case 'POST': {
        const { action, type, settings } = req.body;

        // Handle specific actions
        if (action) {
          switch (action) {
            
            case 'enable':
              automation.isEnabled = true;
              if (type && automation[type]) {
                automation[type].enabled = true;
              }
              break;
              
            case 'disable':
              automation.isEnabled = false;
              if (type && automation[type]) {
                automation[type].enabled = false;
              }
              break;
              
            case 'pause':
              if (type && automation[type]) {
                automation[type].enabled = false;
              } else {
                automation.isEnabled = false;
              }
              break;
              
            case 'resume':
              if (type && automation[type]) {
                automation[type].enabled = true;
              } else {
                automation.isEnabled = true;
              }
              break;
              
            case 'reset_failures':
              automation.failsafe.currentFailures = 0;
              break;
              
            case 'record_success':
              if (type && automation[type]) {
                automation[type].lastRun = new Date().toISOString();
                automation[type].totalRuns++;
                automation.failsafe.currentFailures = 0;
              }
              break;
              
            case 'record_failure':
              automation.failsafe.currentFailures++;
              if (automation.failsafe.currentFailures >= automation.failsafe.maxConsecutiveFailures) {
                if (automation.failsafe.pauseOnFailure) {
                  automation.isEnabled = false;
                }
              }
              break;
              
            default:
              return res.status(400).json({
                success: false,
                error: 'Invalid action',
                message: 'Supported actions: enable, disable, pause, resume, reset_failures, record_success, record_failure'
              });
          }
        }

        // Handle settings updates
        if (settings) {
          Object.keys(settings).forEach(key => {
            if (automation[key] && typeof automation[key] === 'object') {
              automation[key] = { ...automation[key], ...settings[key] };
            } else {
              automation[key] = settings[key];
            }
          });
        }

        // Recalculate next runs
        const updatedAutomation = calculateNextRuns(automation);
        
        if (saveAutomation(updatedAutomation)) {
          const summary = getAutomationSummary(updatedAutomation);
          
          return res.status(200).json({
            success: true,
            message: 'Automation updated successfully',
            action: action,
            type: type,
            automation: updatedAutomation,
            summary: summary,
            timestamp: new Date().toISOString()
          });
        } else {
          return res.status(500).json({
            success: false,
            error: 'Save failed',
            message: 'Failed to save automation settings'
          });
        }
      }

      default:
        return res.status(405).json({
          success: false,
          error: 'Method not allowed',
          message: 'Supported methods: GET, POST'
        });
    }

  } catch (error) {
    console.error('❌ Error in automation endpoint:', error);
    
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: 'Failed to process automation request',
      details: error.message,
      timestamp: new Date().toISOString()
    });
  }
}