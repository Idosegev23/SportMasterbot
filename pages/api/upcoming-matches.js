// Upcoming Matches API - Get matches starting in next 2-3 hours
// These are matches that haven't started yet but are coming up soon

const FootballAPI = require('../../lib/football-api.js');

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed. Use GET.' });
  }

  console.log('⏰ Fetching upcoming matches...');

  try {
    const footballAPI = new FootballAPI();
    
    // Get upcoming matches from API-Football
    const upcomingMatches = await footballAPI.getUpcomingMatches();
    
    console.log(`✅ Found ${upcomingMatches.length} upcoming matches`);
    
    res.status(200).json({
      success: true,
      matches: upcomingMatches,
      count: upcomingMatches.length,
      timeframe: 'Next 2-3 hours',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Error fetching upcoming matches:', error);
    
    // Return fallback data if API fails
    const fallbackMatches = [
      {
        homeTeam: 'Manchester United',
        awayTeam: 'Arsenal',
        competition: 'Premier League',
        kickoffTime: new Date(Date.now() + 2 * 60 * 60 * 1000), // In 2 hours - Keep as Date object
        fixtureId: 'fallback_1'
      }
    ];

    res.status(200).json({
      success: true,
      matches: fallbackMatches,
      count: fallbackMatches.length,
      fallback: true,
      error: error.message,
      timeframe: 'Next 2-3 hours',
      timestamp: new Date().toISOString()
    });
  }
}