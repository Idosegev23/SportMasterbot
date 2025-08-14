// API Endpoint for SportMaster Analytics
// GET /api/analytics - Get click tracking and performance data

import { scheduler } from './start';
import { getSummary as getClickSummary } from '../../lib/click-store';
import { supabase } from '../../lib/supabase';

export default async function handler(req, res) {
  try {
    if (req.method !== 'GET') {
      res.setHeader('Allow', ['GET']);
      return res.status(405).json({
        success: false,
        message: 'Method not allowed'
      });
    }

    if (!scheduler) {
      // Fallback: build analytics from Supabase + redirect logs even if scheduler not started
      const clickSummary = await getClickSummary();
      const now = new Date();

      // Compute Addis Ababa day range in UTC
      const addisNow = new Date(new Date().toLocaleString('en-US', { timeZone: 'Africa/Addis_Ababa' }));
      const y = addisNow.getFullYear();
      const m = addisNow.getMonth();
      const d = addisNow.getDate();
      const addisStart = new Date(Date.UTC(y, m, d, 0, 0, 0));
      const addisEnd = new Date(Date.UTC(y, m, d + 1, 0, 0, 0));

      let totalMessagesPosted = 0;
      let predictionsPosted = 0;
      let resultsPosted = 0;
      let promosPosted = 0;
      let dau = 0, wau = 0, leaders = [];

      if (supabase) {
        try {
          const { count: totalCount } = await supabase
            .from('posts')
            .select('*', { count: 'exact', head: true });
          totalMessagesPosted = totalCount || 0;

          const startISO = addisStart.toISOString();
          const endISO = addisEnd.toISOString();

          const [{ count: predC }, { count: resC }, { count: proC }] = await Promise.all([
            supabase.from('posts').select('*', { count: 'exact', head: true })
              .eq('content_type', 'predictions').gte('created_at', startISO).lt('created_at', endISO),
            supabase.from('posts').select('*', { count: 'exact', head: true })
              .eq('content_type', 'results').gte('created_at', startISO).lt('created_at', endISO),
            supabase.from('posts').select('*', { count: 'exact', head: true })
              .eq('content_type', 'promo').gte('created_at', startISO).lt('created_at', endISO),
          ]);
          predictionsPosted = predC || 0;
          resultsPosted = resC || 0;
          promosPosted = proC || 0;

          // User metrics (DAU/WAU + leaders)
          const since24h = new Date(addisNow.getTime() - 24*60*60*1000).toISOString();
          const since7d = new Date(addisNow.getTime() - 7*24*60*60*1000).toISOString();
          const { data: lastDay } = await supabase.from('interactions').select('user_id').gte('ts', since24h);
          dau = lastDay ? new Set(lastDay.map(r => r.user_id)).size : 0;
          const { data: lastWeek } = await supabase.from('interactions').select('user_id').gte('ts', since7d);
          wau = lastWeek ? new Set(lastWeek.map(r => r.user_id)).size : 0;
          const { data: topUsers } = await supabase
            .from('user_metrics')
            .select('user_id, score, interactions_count')
            .order('score', { ascending: false })
            .limit(10);
          leaders = topUsers || [];
        } catch (_) {}
      }

      const totalClicks = clickSummary.totalClicks || 0;
      const averageCTR = totalMessagesPosted > 0
        ? `${((totalClicks / totalMessagesPosted) * 100).toFixed(2)}%`
        : '0%';

      return res.status(200).json({
        success: true,
        timestamp: now.toISOString(),
        ethiopianTime: now.toLocaleString('en-US', { timeZone: 'Africa/Addis_Ababa' }),
        overview: {
          systemStatus: 'Inactive',
          totalMessagesPosted,
          totalClicks,
          averageCTR,
          topPerformingContent: [],
          dau,
          wau
        },
        dailyStats: {
          today: { totalPosts: predictionsPosted + resultsPosted + promosPosted, predictions: predictionsPosted, results: resultsPosted, promos: promosPosted, errors: 0 },
          predictions: { posted: predictionsPosted, clicks: 0, ctr: calculateCTR(predictionsPosted, 0) },
          results: { posted: resultsPosted, clicks: 0, ctr: calculateCTR(resultsPosted, 0) },
          promos: { posted: promosPosted, clicks: 0, ctr: calculateCTR(promosPosted, 0) }
        },
        clickTracking: {
          byContent: {},
          topButtons: [],
          recentActivity: [],
          redirect: clickSummary,
          leaders
        },
        performance: {
          systemUptime: 'Inactive',
          errors: 0,
          successRate: '100%',
          averageEngagement: totalMessagesPosted > 0 ? (totalClicks / totalMessagesPosted).toFixed(2) : '0.00'
        },
        recommendations: []
      });
    }

    // Get click statistics (in-memory)
    const clickStats = scheduler.telegram.getClickStats();
    const systemStatus = scheduler.getStatus();

    // Fetch recent posts count from Supabase if available
    let totalPosted = getTotalMessages(systemStatus);
    try {
      if (supabase) {
        const { count, error } = await supabase.from('posts').select('*', { count: 'exact', head: true });
        if (!error && typeof count === 'number') {
          totalPosted = Math.max(totalPosted, count);
        }
      }
    } catch (_) {}
    
    // Calculate performance metrics
    const performanceMetrics = calculatePerformanceMetrics(clickStats, systemStatus);
    
    // Get today's activity summary
    const todayActivity = getTodayActivity(systemStatus);
    
    // Merge redirect logs
    const clickSummary = await getClickSummary();

    // Pull user interactions & leaders if Supabase available
    let leaders = [];
    let dau = 0, wau = 0;
    if (supabase) {
      try {
        const since24h = new Date(Date.now() - 24*60*60*1000).toISOString();
        const since7d = new Date(Date.now() - 7*24*60*60*1000).toISOString();
        const { data: lastDay, error: e1 } = await supabase
          .from('interactions')
          .select('user_id')
          .gte('ts', since24h);
        if (!e1 && lastDay) {
          dau = new Set(lastDay.map(r => r.user_id)).size;
        }
        const { data: lastWeek, error: e2 } = await supabase
          .from('interactions')
          .select('user_id')
          .gte('ts', since7d);
        if (!e2 && lastWeek) {
          wau = new Set(lastWeek.map(r => r.user_id)).size;
        }
        const { data: topUsers } = await supabase
          .from('user_metrics')
          .select('user_id, score, interactions_count')
          .order('score', { ascending: false })
          .limit(10);
        leaders = topUsers || [];
      } catch (_) {}
    }
    const analyticsReport = {
      success: true,
      timestamp: new Date().toISOString(),
      ethiopianTime: new Date().toLocaleString('en-US', {
        timeZone: 'Africa/Addis_Ababa'
      }),
      overview: {
        systemStatus: systemStatus.isRunning ? 'Active' : 'Inactive',
        totalMessagesPosted: totalPosted,
        totalClicks: performanceMetrics.totalClicks,
        averageCTR: performanceMetrics.averageCTR,
        topPerformingContent: performanceMetrics.topContent,
        dau,
        wau
      },
      dailyStats: {
        today: todayActivity,
        predictions: {
          posted: systemStatus.dailyStats.predictionsPosted,
          clicks: getContentClicks(clickStats, 'predictions'),
          ctr: calculateCTR(systemStatus.dailyStats.predictionsPosted, getContentClicks(clickStats, 'predictions'))
        },
        results: {
          posted: systemStatus.dailyStats.resultsPosted,
          clicks: getContentClicks(clickStats, 'results'),
          ctr: calculateCTR(systemStatus.dailyStats.resultsPosted, getContentClicks(clickStats, 'results'))
        },
        promos: {
          posted: systemStatus.dailyStats.promosPosted,
          clicks: getContentClicks(clickStats, 'promo'),
          ctr: calculateCTR(systemStatus.dailyStats.promosPosted, getContentClicks(clickStats, 'promo'))
        }
      },
      clickTracking: {
        byContent: clickStats,
        topButtons: getTopButtons(clickStats),
        recentActivity: getRecentActivity(clickStats),
        redirect: clickSummary,
        leaders
      },
      performance: {
        systemUptime: systemStatus.isRunning ? 'Active' : 'Inactive',
        errors: systemStatus.dailyStats.errors,
        successRate: calculateSuccessRate(systemStatus),
        averageEngagement: performanceMetrics.averageEngagement
      },
      recommendations: generateRecommendations(performanceMetrics, systemStatus)
    };

    res.status(200).json(analyticsReport);

  } catch (error) {
    console.error('❌ Error generating analytics:', error);
    
    res.status(500).json({
      success: false,
      message: 'Failed to generate analytics report',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
}

function calculatePerformanceMetrics(clickStats, systemStatus) {
  const totalClicks = Object.values(clickStats).reduce((sum, stat) => sum + stat.totalClicks, 0);
  const totalMessages = Object.values(clickStats).reduce((sum, stat) => sum + stat.totalMessages, 0);
  
  const averageCTR = totalMessages > 0 ? (totalClicks / totalMessages * 100).toFixed(2) : 0;
  
  // Find top performing content
  const topContent = Object.entries(clickStats)
    .sort((a, b) => b[1].totalClicks - a[1].totalClicks)
    .slice(0, 3)
    .map(([type, data]) => ({
      type,
      clicks: data.totalClicks,
      messages: data.totalMessages,
      ctr: data.totalMessages > 0 ? (data.totalClicks / data.totalMessages * 100).toFixed(2) : 0
    }));

  const averageEngagement = totalMessages > 0 ? (totalClicks / totalMessages).toFixed(2) : 0;

  return {
    totalClicks,
    totalMessages,
    averageCTR: `${averageCTR}%`,
    topContent,
    averageEngagement
  };
}

function getTodayActivity(systemStatus) {
  const total = systemStatus.dailyStats.predictionsPosted + 
                systemStatus.dailyStats.resultsPosted + 
                systemStatus.dailyStats.promosPosted;
  
  return {
    totalPosts: total,
    predictions: systemStatus.dailyStats.predictionsPosted,
    results: systemStatus.dailyStats.resultsPosted,
    promos: systemStatus.dailyStats.promosPosted,
    errors: systemStatus.dailyStats.errors
  };
}

function getTotalMessages(systemStatus) {
  return systemStatus.dailyStats.predictionsPosted + 
         systemStatus.dailyStats.resultsPosted + 
         systemStatus.dailyStats.promosPosted;
}

function getContentClicks(clickStats, contentType) {
  return clickStats[contentType] ? clickStats[contentType].totalClicks : 0;
}

function calculateCTR(messages, clicks) {
  if (messages === 0) return '0%';
  return `${(clicks / messages * 100).toFixed(2)}%`;
}

function calculateSuccessRate(systemStatus) {
  const total = getTotalMessages(systemStatus) + systemStatus.dailyStats.errors;
  if (total === 0) return '100%';
  
  const successRate = ((total - systemStatus.dailyStats.errors) / total * 100).toFixed(2);
  return `${successRate}%`;
}

function getTopButtons(clickStats) {
  const allButtons = [];
  
  Object.values(clickStats).forEach(stat => {
    if (stat.messages) {
      stat.messages.forEach(message => {
        // This would need to be enhanced with actual button tracking data
        allButtons.push({
          messageId: message.messageId,
          clicks: message.clicks,
          timestamp: message.timestamp
        });
      });
    }
  });
  
  return allButtons
    .sort((a, b) => b.clicks - a.clicks)
    .slice(0, 5);
}

function getRecentActivity(clickStats) {
  const recentMessages = [];
  
  Object.entries(clickStats).forEach(([type, stat]) => {
    if (stat.messages) {
      stat.messages.forEach(message => {
        recentMessages.push({
          type,
          messageId: message.messageId,
          clicks: message.clicks,
          timestamp: message.timestamp
        });
      });
    }
  });
  
  return recentMessages
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
    .slice(0, 10);
}

function generateRecommendations(metrics, systemStatus) {
  const recommendations = [];
  
  // Performance recommendations
  if (parseFloat(metrics.averageCTR) < 5) {
    recommendations.push({
      type: 'engagement',
      priority: 'high',
      message: 'Click-through rate is below 5%. Consider improving button text and offers.',
      action: 'Enhance promotional messages and call-to-action buttons'
    });
  }
  
  if (systemStatus.dailyStats.errors > 0) {
    recommendations.push({
      type: 'reliability',
      priority: 'high',
      message: `System had ${systemStatus.dailyStats.errors} errors today. Check logs and API connections.`,
      action: 'Review error logs and verify API credentials'
    });
  }
  
  if (systemStatus.dailyStats.promosPosted < 2) {
    recommendations.push({
      type: 'revenue',
      priority: 'medium',
      message: 'Increase promotional frequency to boost revenue opportunities.',
      action: 'Schedule more promotional messages during peak hours'
    });
  }
  
  // Content recommendations
  if (metrics.topContent.length > 0) {
    const topType = metrics.topContent[0].type;
    recommendations.push({
      type: 'content',
      priority: 'low',
      message: `${topType} content performs best. Consider creating more similar content.`,
      action: `Focus on ${topType} content optimization`
    });
  }
  
  return recommendations;
}