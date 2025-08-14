// Today's Matches with Content Schedule API Endpoint
// Shows today's matches and when content will be sent for each

const FootballAPI = require('../../lib/football-api.js');

export default async function handler(req, res) {
  try {
    console.log('📅 API request for today\'s matches and content schedule...');

    const footballAPI = new FootballAPI();
    
    // Get today's matches
    const todayMatches = await footballAPI.getTodayMatches();
    const upcomingMatches = await footballAPI.getUpcomingMatches();
    const liveMatches = await footballAPI.getLiveMatches();

    // Current time in Ethiopian timezone
    const now = new Date();
    const ethiopianTime = now.toLocaleString('en-US', { timeZone: 'Africa/Addis_Ababa' });

    // Settings for content timing
    const settings = {
      hoursBeforeMatch: 2,         // Send predictions 2 hours before
      resultsHour: 23,            // Send results at 11 PM
      promoTimes: [10, 14, 18],   // Send promos at 10 AM, 2 PM, 6 PM
      timezone: 'Africa/Addis_Ababa'
    };

    // Process today's matches and calculate content schedule
    const matchesWithSchedule = todayMatches.map(match => {
      const kickoffTime = new Date(match.kickoffTime);
      const predictionTime = new Date(kickoffTime.getTime() - (settings.hoursBeforeMatch * 60 * 60 * 1000));
      
      // Determine content type and timing
      let contentType = 'prediction';
      let sendTime = predictionTime;
      let status = 'scheduled';

      // Check if match is live
      const isLive = liveMatches.some(live => live.fixtureId === match.fixtureId);
      if (isLive) {
        contentType = 'live';
        sendTime = now;
        status = 'ready_to_send';
      }

      // Check if match already happened
      else if (kickoffTime < now) {
        contentType = 'result';
        const resultTime = new Date();
        resultTime.setHours(settings.resultsHour, 0, 0, 0);
        if (kickoffTime.getDate() < now.getDate()) {
          resultTime.setDate(resultTime.getDate() - 1); // Yesterday's results
        }
        sendTime = resultTime;
        status = kickoffTime < new Date(now.getTime() - 2 * 60 * 60 * 1000) ? 'ready_to_send' : 'waiting';
      }

      // Check if prediction time passed but match not started
      else if (predictionTime < now && kickoffTime > now) {
        status = 'overdue';
      }

      return {
        ...match,
        contentSchedule: {
          contentType: contentType,
          sendTime: sendTime.toISOString(),
          sendTimeLocal: sendTime.toLocaleString('en-US', { timeZone: settings.timezone }),
          status: status,
          hoursUntilSend: Math.max(0, Math.round((sendTime - now) / (1000 * 60 * 60))),
          kickoffLocal: kickoffTime.toLocaleString('en-US', { timeZone: settings.timezone })
        }
      };
    });

    // Group by content type
    const groupedContent = {
      readyToSend: matchesWithSchedule.filter(m => m.contentSchedule.status === 'ready_to_send'),
      scheduled: matchesWithSchedule.filter(m => m.contentSchedule.status === 'scheduled'),
      overdue: matchesWithSchedule.filter(m => m.contentSchedule.status === 'overdue'),
      waiting: matchesWithSchedule.filter(m => m.contentSchedule.status === 'waiting')
    };

    // Calculate today's promo schedule
    const promoSchedule = settings.promoTimes.map(hour => {
      const promoTime = new Date();
      promoTime.setHours(hour, 0, 0, 0);
      
      let promoStatus = 'scheduled';
      if (promoTime < now) {
        promoStatus = 'sent';
      } else if (promoTime - now < 30 * 60 * 1000) { // Within 30 minutes
        promoStatus = 'ready_to_send';
      }

      return {
        time: promoTime.toISOString(),
        timeLocal: promoTime.toLocaleString('en-US', { timeZone: settings.timezone }),
        status: promoStatus,
        hoursUntil: Math.max(0, Math.round((promoTime - now) / (1000 * 60 * 60)))
      };
    });

    // Summary stats
    const summary = {
      totalMatches: todayMatches.length,
      liveMatches: liveMatches.length,
      upcomingMatches: upcomingMatches.length,
      readyToSend: groupedContent.readyToSend.length,
      scheduled: groupedContent.scheduled.length,
      overdue: groupedContent.overdue.length
    };

    return res.status(200).json({
      success: true,
      timestamp: new Date().toISOString(),
      ethiopianTime: ethiopianTime,
      
      summary: summary,
      
      settings: settings,
      
      todayMatches: matchesWithSchedule,
      
      contentGroups: groupedContent,
      
      promoSchedule: promoSchedule,
      
      nextActions: {
        readyToSendNow: groupedContent.readyToSend.map(m => ({
          match: `${m.homeTeam} vs ${m.awayTeam}`,
          type: m.contentSchedule.contentType,
          action: `Send ${m.contentSchedule.contentType} content`
        })),
        
        nextScheduled: groupedContent.scheduled
          .sort((a, b) => new Date(a.contentSchedule.sendTime) - new Date(b.contentSchedule.sendTime))
          .slice(0, 3)
          .map(m => ({
            match: `${m.homeTeam} vs ${m.awayTeam}`,
            type: m.contentSchedule.contentType,
            sendTime: m.contentSchedule.sendTimeLocal,
            hoursUntil: m.contentSchedule.hoursUntilSend
          }))
      }
    });

  } catch (error) {
    console.error('❌ Error in today-matches endpoint:', error);
    
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: 'Failed to get today\'s matches and schedule',
      details: error.message,
      timestamp: new Date().toISOString()
    });
  }
}