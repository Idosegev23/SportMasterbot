// Data Comparison API Endpoint
// Compares data from API-Football with SportMaster content

const axios = require('axios');
const FootballAPI = require('../../lib/football-api.js');

export default async function handler(req, res) {
  try {
    console.log('📊 Starting data comparison between API and website...');

    // Get data from both sources
    const [apiData, websiteData] = await Promise.all([
      getApiData(),
      getWebsiteData(req)
    ]);

    // Compare the data
    const comparison = compareData(apiData, websiteData);

    return res.status(200).json({
      success: true,
      message: 'Data comparison completed',
      timestamp: new Date().toISOString(),
      sources: {
        api: {
          name: 'API-Football',
          status: apiData.success ? 'success' : 'failed',
          matchesCount: apiData.matches?.length || 0
        },
        website: {
    name: 'SportMaster Bot',
          status: websiteData.success ? 'success' : 'failed',
          url: websiteData.url || 'N/A'
        }
      },
      comparison: comparison,
      rawData: {
        api: apiData,
        website: websiteData
      }
    });

  } catch (error) {
    console.error('❌ Error in compare-data endpoint:', error);
    
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: 'Failed to compare data sources',
      details: error.message,
      timestamp: new Date().toISOString()
    });
  }
}

// Get data from API-Football
async function getApiData() {
  try {
    console.log('📡 Fetching data from API-Football...');
    
    const footballAPI = new FootballAPI();
    const [todayMatches, upcomingMatches, liveMatches] = await Promise.all([
      footballAPI.getTodayMatches(),
      footballAPI.getUpcomingMatches(), 
      footballAPI.getLiveMatches()
    ]);

    return {
      success: true,
      source: 'API-Football',
      matches: todayMatches,
      upcoming: upcomingMatches,
      live: liveMatches,
      totalMatches: todayMatches.length + upcomingMatches.length + liveMatches.length,
      timestamp: new Date().toISOString()
    };

  } catch (error) {
    console.error('❌ Error fetching API data:', error);
    return {
      success: false,
      error: error.message,
      matches: [],
      upcoming: [],
      live: [],
      totalMatches: 0
    };
  }
}

// Get data from website scraping
async function getWebsiteData(req) {
  try {
    console.log('🕷️ Fetching data from website scraping...');
    
    // Get the base URL from the request
    const baseUrl = req.headers.host 
      ? `${req.headers['x-forwarded-proto'] || 'https'}://${req.headers.host}`
      : 'http://localhost:3000';

  const scrapeResponse = await axios.get(`${baseUrl}/api/scrape-gizebets`, {
      timeout: 10000
    });

    return {
      success: scrapeResponse.data.success,
    source: 'SportMaster Bot',
      url: scrapeResponse.data.url,
      analysis: scrapeResponse.data.analysis,
      data: scrapeResponse.data.data,
      timestamp: new Date().toISOString()
    };

  } catch (error) {
    console.error('❌ Error fetching website data:', error);
    return {
      success: false,
      error: error.message,
      analysis: {},
      data: { leagues: [], matches: [], odds: [] }
    };
  }
}

// Compare data from both sources
function compareData(apiData, websiteData) {
  const comparison = {
    overview: {
      apiAvailable: apiData.success,
      websiteAvailable: websiteData.success,
      bothAvailable: apiData.success && websiteData.success
    },
    matches: {
      apiCount: apiData.totalMatches || 0,
      websiteCount: websiteData.data?.matches?.length || 0,
      difference: Math.abs((apiData.totalMatches || 0) - (websiteData.data?.matches?.length || 0))
    },
    leagues: {
      apiLeagues: extractApiLeagues(apiData.matches || []),
      websiteLeagues: websiteData.data?.leagues || [],
      commonLeagues: []
    },
    recommendations: []
  };

  // Find common leagues
  if (comparison.leagues.apiLeagues.length > 0 && comparison.leagues.websiteLeagues.length > 0) {
    comparison.leagues.commonLeagues = comparison.leagues.apiLeagues.filter(apiLeague =>
      comparison.leagues.websiteLeagues.some(webLeague => 
        webLeague.toLowerCase().includes(apiLeague.toLowerCase()) ||
        apiLeague.toLowerCase().includes(webLeague.toLowerCase())
      )
    );
  }

  // Generate recommendations
  if (!apiData.success && !websiteData.success) {
    comparison.recommendations.push('Both data sources failed - check network connectivity');
  } else if (!apiData.success) {
    comparison.recommendations.push('API-Football unavailable - rely on website scraping');
  } else if (!websiteData.success) {
    comparison.recommendations.push('Website scraping failed - rely on API-Football data');
  } else if (comparison.matches.apiCount === 0 && comparison.matches.websiteCount === 0) {
    comparison.recommendations.push('No matches found in either source - check data availability');
  } else if (comparison.matches.apiCount > comparison.matches.websiteCount) {
    comparison.recommendations.push('API-Football has more matches - prefer API data');
  } else if (comparison.matches.websiteCount > comparison.matches.apiCount) {
    comparison.recommendations.push('Website has more matches - consider hybrid approach');
  } else {
    comparison.recommendations.push('Both sources have similar data - use API-Football as primary');
  }

  // Data quality assessment
  comparison.quality = {
    apiQuality: assessApiQuality(apiData),
    websiteQuality: assessWebsiteQuality(websiteData),
    recommendation: 'API-Football' // Default recommendation
  };

  if (comparison.quality.websiteQuality > comparison.quality.apiQuality) {
    comparison.quality.recommendation = 'Website Scraping';
  } else if (comparison.quality.apiQuality === comparison.quality.websiteQuality) {
    comparison.quality.recommendation = 'Hybrid Approach';
  }

  return comparison;
}

// Extract leagues from API data
function extractApiLeagues(matches) {
  const leagues = new Set();
  matches.forEach(match => {
    if (match.competition && match.competition.name) {
      leagues.add(match.competition.name);
    }
  });
  return Array.from(leagues);
}

// Assess API data quality (0-100)
function assessApiQuality(apiData) {
  if (!apiData.success) return 0;
  
  let score = 30; // Base score for successful connection
  
  // Add points for data availability
  if (apiData.totalMatches > 0) score += 30;
  if (apiData.totalMatches > 5) score += 20;
  if (apiData.totalMatches > 10) score += 10;
  
  // Add points for data variety
  if (apiData.live && apiData.live.length > 0) score += 5;
  if (apiData.upcoming && apiData.upcoming.length > 0) score += 5;
  
  return Math.min(score, 100);
}

// Assess website data quality (0-100)
function assessWebsiteQuality(websiteData) {
  if (!websiteData.success) return 0;
  
  let score = 20; // Base score for successful scraping
  
  // Add points for content detection
  if (websiteData.analysis?.footballTermsFound?.length > 0) score += 20;
  if (websiteData.analysis?.hasJavaScript) score += 10;
  if (websiteData.analysis?.hasTable) score += 15;
  
  // Add points for extracted data
  if (websiteData.data?.leagues?.length > 0) score += 15;
  if (websiteData.data?.matches?.length > 0) score += 15;
  if (websiteData.data?.odds?.length > 0) score += 5;
  
  return Math.min(score, 100);
}