// Legacy scraper endpoint (unused for SportMaster)
// Previously scraped from gizebets.et; kept for reference

const axios = require('axios');

export default async function handler(req, res) {
  try {
console.log('🕷️ Starting SportMaster website scraping...');

  const { url = 'https://t.me/Sportmsterbot?start=football' } = req.query;

    // Set proper headers to avoid being blocked
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.5',
      'Accept-Encoding': 'gzip, deflate, br',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1',
    };

    try {
      // Fetch the website content
      console.log(`📥 Fetching content from: ${url}`);
      const response = await axios.get(url, {
        headers,
        timeout: 15000,
        maxRedirects: 5,
        validateStatus: function (status) {
          return status >= 200 && status < 400; // Accept redirects
        }
      });

      console.log(`✅ Successfully fetched content. Status: ${response.status}`);
      console.log(`📄 Content length: ${response.data.length} characters`);

      // Parse the HTML content
      const htmlContent = response.data;
      
      // Basic content analysis
      const contentAnalysis = analyzeContent(htmlContent);
      
      // Try to extract leagues and matches information
      const scrapedData = extractData(htmlContent);

      return res.status(200).json({
        success: true,
        message: 'Website scraped successfully',
        url: url,
        timestamp: new Date().toISOString(),
        analysis: contentAnalysis,
        data: scrapedData,
        rawContentPreview: htmlContent.substring(0, 500) + '...' // First 500 chars for preview
      });

    } catch (fetchError) {
      console.error('❌ Error fetching website:', fetchError.message);
      
      return res.status(200).json({
        success: false,
        error: 'Fetch failed',
    message: 'Could not fetch legacy content',
        details: fetchError.message,
        url: url,
        timestamp: new Date().toISOString(),
        fallback: {
          message: 'Website may be down or blocking requests',
          suggestions: [
            'Check if website is accessible',
            'Try different URL paths',
            'Contact website administrator'
          ]
        }
      });
    }

  } catch (error) {
    console.error('❌ Error in scrape-gizebets endpoint:', error);
    
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: 'Failed to process scraping request',
      details: error.message,
      timestamp: new Date().toISOString()
    });
  }
}

// Analyze HTML content for useful information
function analyzeContent(htmlContent) {
  const analysis = {
    totalLength: htmlContent.length,
    hasJavaScript: htmlContent.includes('<script'),
    hasCSS: htmlContent.includes('<style') || htmlContent.includes('.css'),
    hasImages: htmlContent.includes('<img'),
    hasLinks: htmlContent.includes('<a href'),
    hasForms: htmlContent.includes('<form'),
    hasTable: htmlContent.includes('<table'),
    title: extractTitle(htmlContent),
    meta: extractMeta(htmlContent)
  };

  // Count common football/betting related terms
  const footballTerms = ['match', 'league', 'team', 'bet', 'odds', 'prediction', 'result', 'football', 'soccer'];
  analysis.footballTermsFound = footballTerms.filter(term => 
    htmlContent.toLowerCase().includes(term)
  );

  return analysis;
}

// Extract title from HTML
function extractTitle(htmlContent) {
  const titleMatch = htmlContent.match(/<title[^>]*>(.*?)<\/title>/i);
  return titleMatch ? titleMatch[1].trim() : 'No title found';
}

// Extract meta information
function extractMeta(htmlContent) {
  const meta = {};
  
  // Extract description
  const descMatch = htmlContent.match(/<meta[^>]*name=["\']description["\'][^>]*content=["\']([^"\']*)["\'][^>]*>/i);
  if (descMatch) meta.description = descMatch[1];
  
  // Extract keywords
  const keywordsMatch = htmlContent.match(/<meta[^>]*name=["\']keywords["\'][^>]*content=["\']([^"\']*)["\'][^>]*>/i);
  if (keywordsMatch) meta.keywords = keywordsMatch[1];
  
  return meta;
}

// Extract useful data from HTML content
function extractData(htmlContent) {
  const data = {
    leagues: extractLeagues(htmlContent),
    matches: extractMatches(htmlContent),
    odds: extractOdds(htmlContent),
    tables: extractTables(htmlContent)
  };

  return data;
}

// Extract league information
function extractLeagues(htmlContent) {
  const leagues = [];
  
  // Look for common league patterns
  const leaguePatterns = [
    /Premier League/gi,
    /La Liga/gi,
    /Serie A/gi,
    /Bundesliga/gi,
    /Ligue 1/gi,
    /Champions League/gi,
    /Europa League/gi
  ];

  leaguePatterns.forEach(pattern => {
    const matches = htmlContent.match(pattern);
    if (matches) {
      matches.forEach(match => {
        if (!leagues.includes(match)) {
          leagues.push(match);
        }
      });
    }
  });

  return leagues;
}

// Extract match information
function extractMatches(htmlContent) {
  const matches = [];
  
  // Look for team vs team patterns
  const vsPatterns = [
    /([A-Za-z\s]+)\s+vs\s+([A-Za-z\s]+)/gi,
    /([A-Za-z\s]+)\s+-\s+([A-Za-z\s]+)/gi
  ];

  vsPatterns.forEach(pattern => {
    let match;
    while ((match = pattern.exec(htmlContent)) !== null) {
      matches.push({
        homeTeam: match[1].trim(),
        awayTeam: match[2].trim(),
        matchString: match[0]
      });
      
      // Limit to prevent infinite loops
      if (matches.length > 50) break;
    }
  });

  return matches.slice(0, 20); // Return first 20 matches
}

// Extract odds information
function extractOdds(htmlContent) {
  const odds = [];
  
  // Look for decimal odds patterns
  const oddsPattern = /\b\d+\.\d{2}\b/g;
  const oddsMatches = htmlContent.match(oddsPattern);
  
  if (oddsMatches) {
    odds.push(...oddsMatches.slice(0, 10)); // First 10 odds
  }

  return odds;
}

// Extract table data
function extractTables(htmlContent) {
  const tables = [];
  
  // Simple table extraction
  const tablePattern = /<table[^>]*>(.*?)<\/table>/gi;
  let match;
  
  while ((match = tablePattern.exec(htmlContent)) !== null) {
    tables.push({
      content: match[1].substring(0, 200) + '...', // First 200 chars
      fullLength: match[1].length
    });
    
    if (tables.length > 5) break; // Limit to 5 tables
  }

  return tables;
}