// 📰 News Fetcher - Real RSS feeds for sports news
const Parser = require('rss-parser');

class NewsFetcher {
  constructor() {
    this.parser = new Parser({
      timeout: 10000,
      headers: {
        'User-Agent': 'SportMaster Bot'
      }
    });
    
    // RSS feeds focused on football/soccer news relevant to African audience
    this.feeds = [
      {
        name: 'BBC Sport Football',
        url: 'https://feeds.bbci.co.uk/sport/football/rss.xml',
        weight: 3 // Higher weight = more likely to be selected
      },
      {
        name: 'Goal.com',
        url: 'https://www.goal.com/feeds/en/news',
        weight: 2
      },
      {
        name: 'ESPN Soccer',
        url: 'http://www.espn.com/espn/rss/soccer/news',
        weight: 2
      },
      {
        name: 'Sky Sports Football',
        url: 'https://www.skysports.com/rss/football',
        weight: 2
      },
      {
        name: 'CAF Online',
        url: 'https://www.cafonline.com/rss/',
        weight: 3 // African football focus
      }
    ];
  }

  // Fetch news from a single RSS feed
  async fetchFromFeed(feed) {
    try {
      console.log(`📡 Fetching news from ${feed.name}...`);
      const parsed = await this.parser.parseURL(feed.url);
      
      if (!parsed.items || parsed.items.length === 0) {
        console.log(`⚠️ No items found in ${feed.name}`);
        return [];
      }

      // Get latest 5 items and format them
      const items = parsed.items.slice(0, 5).map(item => ({
        title: this.cleanTitle(item.title),
        url: item.link,
        pubDate: item.pubDate,
        source: feed.name,
        weight: feed.weight
      }));

      console.log(`✅ Found ${items.length} items from ${feed.name}`);
      return items;
    } catch (error) {
      console.error(`❌ Error fetching from ${feed.name}:`, error.message);
      return [];
    }
  }

  // Clean and format news titles
  cleanTitle(title) {
    if (!title) return '';
    
    // Remove common RSS noise
    let cleaned = title
      .replace(/\s*-\s*(BBC Sport|Goal\.com|ESPN|Sky Sports|CAF).*$/i, '') // Remove source suffix
      .replace(/^\[.*?\]\s*/, '') // Remove category prefixes like [Football]
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();
    
    // Truncate if too long
    if (cleaned.length > 80) {
      cleaned = cleaned.substring(0, 77) + '...';
    }
    
    return cleaned;
  }

  // Fetch news headlines from all feeds
  async fetchLatestNews(maxHeadlines = 5) {
    try {
      console.log('📰 Starting news fetch from multiple sources...');
      
      // Fetch from all feeds in parallel
      const feedPromises = this.feeds.map(feed => 
        this.fetchFromFeed(feed).catch(err => {
          console.error(`Feed ${feed.name} failed:`, err.message);
          return [];
        })
      );
      
      const results = await Promise.all(feedPromises);
      
      // Flatten and combine all news items
      const allNews = results.flat();
      
      if (allNews.length === 0) {
        console.log('⚠️ No news found from any source, using fallback');
        return this.getFallbackNews();
      }

      // Sort by weight and recency, then take top headlines
      const sortedNews = allNews
        .filter(item => item.title && item.title.length > 10) // Filter out empty/short titles
        .sort((a, b) => {
          // Primary sort: weight (higher is better)
          if (a.weight !== b.weight) return b.weight - a.weight;
          // Secondary sort: recency (newer is better)
          const dateA = new Date(a.pubDate || 0);
          const dateB = new Date(b.pubDate || 0);
          return dateB - dateA;
        })
        .slice(0, maxHeadlines);

      console.log(`✅ Successfully fetched ${sortedNews.length} news headlines`);
      return sortedNews.map(item => item.title);
      
    } catch (error) {
      console.error('❌ Error in fetchLatestNews:', error);
      return this.getFallbackNews();
    }
  }

  // Fallback news when RSS feeds fail
  getFallbackNews() {
    const fallbackHeadlines = [
      "🏆 Breaking: Latest Champions League results and upcoming fixtures",
      "⚽ Transfer Update: Major signings completed this week", 
      "🏅 International Football: Key matches and standings",
      "📊 Performance Analysis: Top players and team statistics",
      "🔥 Match Preview: Must-watch games coming up today"
    ];
    
    console.log('📰 Using fallback news headlines');
    return fallbackHeadlines;
  }
}

module.exports = NewsFetcher;