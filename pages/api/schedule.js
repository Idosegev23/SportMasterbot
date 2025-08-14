// Schedule Management API Endpoint
// Complete schedule management with match-based dynamic scheduling

const fs = require('fs');
const path = require('path');
const FootballAPI = require('../../lib/football-api.js');

// Use memory cache for schedule in serverless
let scheduleCache = null;

// Default schedule structure
const DEFAULT_SCHEDULE = {
  daily: {
    predictions: {
      enabled: true,
      fixedTimes: [8, 10, 12, 14, 16, 18, 20], // Fixed hours
      dynamicTiming: true, // Adapt to matches
      hoursBeforeMatch: 2
    },
    results: {
      enabled: true,
      time: 23, // 11 PM
      includeYesterday: true
    },
    promos: {
      enabled: true,
      times: [10, 14, 18] // 10 AM, 2 PM, 6 PM
    },
    analytics: {
      enabled: true,
      time: 0 // Midnight
    }
  },
  
  matchBased: {
    enabled: true,
    predictions: [],
    results: [],
    live: []
  },
  
  manual: {
    queuedPredictions: [],
    queuedResults: [],
    queuedPromos: []
  },
  
  metadata: {
    lastGenerated: null,
    nextUpdate: null,
    totalScheduledItems: 0
  }
};

// Load current schedule from cache
function loadSchedule() {
  if (scheduleCache === null) {
    // Initialize with defaults
    scheduleCache = {
      ...DEFAULT_SCHEDULE,
      metadata: {
        ...DEFAULT_SCHEDULE.metadata,
        lastUpdated: new Date().toISOString()
      }
    };
  }
  return { ...scheduleCache };
}

// Save schedule to cache
function saveSchedule(schedule) {
  try {
    schedule.metadata.lastUpdated = new Date().toISOString();
    scheduleCache = { ...schedule };
    return true;
  } catch (error) {
    console.error('Error saving schedule to cache:', error);
    return false;
  }
}

// Generate dynamic schedule based on today's matches
async function generateDynamicSchedule(schedule) {
  try {
    console.log('📅 Generating dynamic schedule based on matches...');
    
    const footballAPI = new FootballAPI();
    const todayMatches = await footballAPI.getTodayMatches();
    const upcomingMatches = await footballAPI.getUpcomingMatches();
    
    const now = new Date();
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);
    
    // Clear existing match-based schedule
    schedule.matchBased.predictions = [];
    schedule.matchBased.results = [];
    schedule.matchBased.live = [];

    // Generate prediction schedule for each match
    todayMatches.forEach(match => {
      const kickoffTime = new Date(match.kickoffTime);
      const predictionTime = new Date(kickoffTime.getTime() - (schedule.daily.predictions.hoursBeforeMatch * 60 * 60 * 1000));
      
      // Only schedule if prediction time is in the future
      if (predictionTime > now) {
        schedule.matchBased.predictions.push({
          id: `pred_${match.fixtureId}`,
          matchId: match.fixtureId,
          homeTeam: match.homeTeam,
          awayTeam: match.awayTeam,
          competition: match.competition,
          kickoffTime: kickoffTime.toISOString(),
          scheduledTime: predictionTime.toISOString(),
          scheduledTimeLocal: predictionTime.toLocaleString('en-US', { timeZone: 'Africa/Addis_Ababa' }),
          status: 'scheduled',
          type: 'prediction'
        });
      }
    });

    // Generate results schedule for matches that ended
    todayMatches.forEach(match => {
      const kickoffTime = new Date(match.kickoffTime);
      const matchEndTime = new Date(kickoffTime.getTime() + (2 * 60 * 60 * 1000)); // Assume 2 hours match duration
      
      // Schedule results for matches that should have ended
      if (matchEndTime < now) {
        const resultTime = new Date();
        resultTime.setHours(schedule.daily.results.time, 0, 0, 0);
        
        schedule.matchBased.results.push({
          id: `result_${match.fixtureId}`,
          matchId: match.fixtureId,
          homeTeam: match.homeTeam,
          awayTeam: match.awayTeam,
          competition: match.competition,
          kickoffTime: kickoffTime.toISOString(),
          scheduledTime: resultTime.toISOString(),
          scheduledTimeLocal: resultTime.toLocaleString('en-US', { timeZone: 'Africa/Addis_Ababa' }),
          status: 'ready',
          type: 'result'
        });
      }
    });

    // Check for live matches
    const liveMatches = await footballAPI.getLiveMatches();
    liveMatches.forEach(match => {
      schedule.matchBased.live.push({
        id: `live_${match.fixtureId}`,
        matchId: match.fixtureId,
        homeTeam: match.homeTeam,
        awayTeam: match.awayTeam,
        competition: match.competition,
        status: 'live',
        minute: match.minute,
        type: 'live'
      });
    });

    // Update metadata
    schedule.metadata.lastGenerated = new Date().toISOString();
    schedule.metadata.nextUpdate = new Date(now.getTime() + (60 * 60 * 1000)).toISOString(); // Next hour
    schedule.metadata.totalScheduledItems = 
      schedule.matchBased.predictions.length + 
      schedule.matchBased.results.length + 
      schedule.matchBased.live.length;

    console.log(`✅ Generated schedule: ${schedule.matchBased.predictions.length} predictions, ${schedule.matchBased.results.length} results, ${schedule.matchBased.live.length} live`);
    
    return schedule;
    
  } catch (error) {
    console.error('❌ Error generating dynamic schedule:', error);
    return schedule; // Return original schedule on error
  }
}

// Get schedule summary
function getScheduleSummary(schedule) {
  const now = new Date();
  
  // Count upcoming items
  const upcomingPredictions = schedule.matchBased.predictions.filter(p => new Date(p.scheduledTime) > now);
  const upcomingResults = schedule.matchBased.results.filter(r => new Date(r.scheduledTime) > now);
  const liveMatches = schedule.matchBased.live;

  // Get next scheduled item
  const allUpcoming = [
    ...upcomingPredictions.map(p => ({ ...p, category: 'prediction' })),
    ...upcomingResults.map(r => ({ ...r, category: 'result' }))
  ].sort((a, b) => new Date(a.scheduledTime) - new Date(b.scheduledTime));

  return {
    overview: {
      dailyScheduleEnabled: schedule.daily.predictions.enabled,
      matchBasedEnabled: schedule.matchBased.enabled,
      totalScheduledItems: schedule.metadata.totalScheduledItems,
      lastGenerated: schedule.metadata.lastGenerated
    },
    
    current: {
      liveMatches: liveMatches.length,
      upcomingPredictions: upcomingPredictions.length,
      upcomingResults: upcomingResults.length,
      queuedManual: schedule.manual.queuedPredictions.length + schedule.manual.queuedResults.length + schedule.manual.queuedPromos.length
    },
    
    next: {
      item: allUpcoming[0] || null,
      timeUntilNext: allUpcoming[0] ? Math.round((new Date(allUpcoming[0].scheduledTime) - now) / (1000 * 60)) : null
    },
    
    daily: {
      predictions: schedule.daily.predictions,
      results: schedule.daily.results,
      promos: schedule.daily.promos,
      analytics: schedule.daily.analytics
    }
  };
}

export default async function handler(req, res) {
  try {
    console.log(`📅 Schedule API - ${req.method} request...`);

    switch (req.method) {
      
      // GET - Get current schedule
      case 'GET': {
        const { regenerate, summary } = req.query;
        
        let schedule = loadSchedule();
        
        // Regenerate dynamic schedule if requested
        if (regenerate === 'true') {
          schedule = await generateDynamicSchedule(schedule);
          saveSchedule(schedule);
        }
        
        // Return summary only if requested
        if (summary === 'true') {
          const scheduleSummary = getScheduleSummary(schedule);
          
          return res.status(200).json({
            success: true,
            summary: scheduleSummary,
            timestamp: new Date().toISOString()
          });
        }
        
        // Return full schedule
        const scheduleSummary = getScheduleSummary(schedule);
        
        return res.status(200).json({
          success: true,
          schedule: schedule,
          summary: scheduleSummary,
          timestamp: new Date().toISOString()
        });
      }

      // POST - Update schedule settings or add manual items
      case 'POST': {
        const { action, settings, manualItem } = req.body;
        
        let schedule = loadSchedule();
        
        if (action === 'regenerate') {
          schedule = await generateDynamicSchedule(schedule);
          
        } else if (action === 'update_settings') {
          if (settings) {
            // Update daily settings
            if (settings.daily) {
              schedule.daily = { ...schedule.daily, ...settings.daily };
            }
            
            // Update match-based settings
            if (settings.matchBased) {
              schedule.matchBased = { ...schedule.matchBased, ...settings.matchBased };
            }
          }
          
        } else if (action === 'add_manual') {
          if (manualItem && manualItem.type) {
            const item = {
              id: `manual_${Date.now()}`,
              ...manualItem,
              addedAt: new Date().toISOString(),
              status: 'queued'
            };
            
            switch (manualItem.type) {
              case 'prediction':
                schedule.manual.queuedPredictions.push(item);
                break;
              case 'result':
                schedule.manual.queuedResults.push(item);
                break;
              case 'promo':
                schedule.manual.queuedPromos.push(item);
                break;
            }
          }
          
        } else if (action === 'remove_manual') {
          const { itemId } = req.body;
          
          schedule.manual.queuedPredictions = schedule.manual.queuedPredictions.filter(item => item.id !== itemId);
          schedule.manual.queuedResults = schedule.manual.queuedResults.filter(item => item.id !== itemId);
          schedule.manual.queuedPromos = schedule.manual.queuedPromos.filter(item => item.id !== itemId);
        }
        
        if (saveSchedule(schedule)) {
          const scheduleSummary = getScheduleSummary(schedule);
          
          return res.status(200).json({
            success: true,
            message: 'Schedule updated successfully',
            action: action,
            schedule: schedule,
            summary: scheduleSummary,
            timestamp: new Date().toISOString()
          });
        } else {
          return res.status(500).json({
            success: false,
            error: 'Save failed',
            message: 'Failed to save schedule updates'
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
    console.error('❌ Error in schedule endpoint:', error);
    
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: 'Failed to process schedule request',
      details: error.message,
      timestamp: new Date().toISOString()
    });
  }
}