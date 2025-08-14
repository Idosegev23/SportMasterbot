// Live Matches API - Get currently active/live matches
// Fetches matches that are currently being played

const FootballAPI = require('../../lib/football-api.js');

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed. Use GET.' });
  }

  console.log('🔴 Fetching live matches...');

  try {
    const footballAPI = new FootballAPI();
    
    // Get live matches from API-Football
    const liveMatches = await footballAPI.getLiveMatches();
    
    console.log(`✅ Found ${liveMatches.length} live matches`);
    
    res.status(200).json({
      success: true,
      matches: liveMatches,
      count: liveMatches.length,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Error fetching live matches:', error);
    
    // Return fallback data if API fails
    const fallbackMatches = [
      {
        homeTeam: 'Manchester United',
        awayTeam: 'Liverpool',
        homeScore: 1,
        awayScore: 1,
        status: 'LIVE',
        minute: 67,
        competition: 'Premier League'
      },
      {
        homeTeam: 'Real Madrid',
        awayTeam: 'Barcelona',
        homeScore: 0,
        awayScore: 2,
        status: 'LIVE',
        minute: 43,
        competition: 'La Liga'
      }
    ];

    res.status(200).json({
      success: true,
      matches: fallbackMatches,
      count: fallbackMatches.length,
      fallback: true,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
}