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
    
    // Memory system to prevent duplicate news
    this.sentNews = new Set(); // Store sent news titles
    this.lastFetchTime = null;
    this.cacheExpiry = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
    
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

  // Fetch single detailed news article from feeds
  async fetchLatestNews(maxHeadlines = 1) {
    try {
      console.log('📰 Starting news fetch from multiple sources...');
      
      // Clear old cache if expired
      this.clearExpiredCache();
      
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

      // Filter out already sent news
      const newNews = allNews.filter(item => {
        const newsKey = this.generateNewsKey(item.title);
        return !this.sentNews.has(newsKey);
      });

      console.log(`📋 Total news found: ${allNews.length}, New unsent: ${newNews.length}`);

      // If not enough new news, mix with some old ones
      let finalNews = newNews;
      if (newNews.length < maxHeadlines) {
        const needed = maxHeadlines - newNews.length;
        const oldNews = allNews.filter(item => {
          const newsKey = this.generateNewsKey(item.title);
          return this.sentNews.has(newsKey);
        }).slice(0, needed);
        
        finalNews = [...newNews, ...oldNews];
        console.log(`⚠️ Mixed ${newNews.length} new + ${oldNews.length} recent news`);
      }

      // Sort by weight and recency, then take top headlines
      const sortedNews = finalNews
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

      // Mark these news as sent
      sortedNews.forEach(item => {
        const newsKey = this.generateNewsKey(item.title);
        this.sentNews.add(newsKey);
      });

      console.log(`✅ Successfully fetched ${sortedNews.length} news headlines (${this.sentNews.size} total tracked)`);
      
      // For single article, get detailed content
      if (maxHeadlines === 1 && sortedNews.length > 0) {
        return await this.createDetailedArticle(sortedNews[0]);
      }
      
      // Return enhanced headlines with emojis and variety
      return this.enhanceNewsHeadlines(sortedNews);
      
    } catch (error) {
      console.error('❌ Error in fetchLatestNews:', error);
      return this.getFallbackNews();
    }
  }

  // Enhance headlines with emojis and better formatting
  enhanceNewsHeadlines(newsItems) {
    const emojis = ['⚽', '🏆', '🔥', '📈', '⭐', '🎯', '🚀', '💥', '⚡', '🌟'];
    
    return newsItems.map((item, index) => {
      const emoji = emojis[index % emojis.length];
      const title = item.title;
      const source = item.source;
      
      // Add variety to headline format
      if (index === 0) {
        return `${emoji} **BREAKING**: ${title}`;
      } else if (index === 1) {
        return `${emoji} **EXCLUSIVE**: ${title}`;
      } else if (source.includes('CAF') || source.includes('African')) {
        return `${emoji} **AFRICAN FOCUS**: ${title}`;
      } else {
        return `${emoji} ${title}`;
      }
    });
  }

  // Generate unique key for news item (for duplicate detection)
  generateNewsKey(title) {
    // Normalize title: remove emojis, extra spaces, and make lowercase
    return title
      .replace(/[\u{1f300}-\u{1f5ff}\u{1f900}-\u{1f9ff}\u{1f600}-\u{1f64f}\u{1f680}-\u{1f6ff}\u{2600}-\u{26ff}\u{2700}-\u{27bf}]/gu, '')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase()
      .substring(0, 50); // Take first 50 chars for key
  }

  // Clear expired cache entries
  clearExpiredCache() {
    const now = Date.now();
    
    // If it's been more than 24 hours, clear the cache
    if (this.lastFetchTime && (now - this.lastFetchTime) > this.cacheExpiry) {
      console.log('🧹 Clearing expired news cache (24h+)');
      this.sentNews.clear();
    }
    
    // Update last fetch time
    this.lastFetchTime = now;
  }

  // Get cache stats (for debugging)
  getCacheStats() {
    return {
      trackedNews: this.sentNews.size,
      lastFetch: this.lastFetchTime ? new Date(this.lastFetchTime).toISOString() : null,
      cacheExpiry: this.cacheExpiry / (1000 * 60 * 60) + ' hours'
    };
  }

  // Create detailed article from headline using AI
  async createDetailedArticle(newsItem) {
    try {
      const { OpenAI } = require('openai');
      const openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY
      });

      const prompt = `
You are a professional sports journalist for SportMaster. Based on this headline, create a detailed news article:

HEADLINE: "${newsItem.title}"
SOURCE: ${newsItem.source}
DATE: ${newsItem.pubDate || 'Recent'}

Write a comprehensive sports news article in English with:

📰 HEADLINE
- Engaging title with context

🔍 LEAD PARAGRAPH  
- Key facts: WHO, WHAT, WHEN, WHERE
- Most important information first

📊 DETAILED COVERAGE
- Background information
- Player/team analysis
- Financial details (if transfer)
- Impact on league/competition
- Expert quotes or reactions

💡 ANALYSIS & INSIGHTS
- What this means for the sport
- Future implications
- Strategic considerations

⚽ CONCLUSION
- Summary of key points
- What to watch next

Format for Telegram with proper emojis and structure.
Use *bold* for key points and _italics_ for emphasis.
Keep professional but engaging tone.
Maximum 600 words.

OUTPUT FORMAT (Telegram Markdown):
- Use proper emojis for sections
- *Bold* for important facts
- _Italics_ for quotes/emphasis
- Clear paragraph breaks
`;

      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "You are a professional sports journalist. Write detailed, accurate sports news articles in English. Use engaging but professional tone. Include relevant details and analysis."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        max_tokens: 1000,
        temperature: 0.7
      });

      return response.choices[0].message.content.trim();

    } catch (error) {
      console.error('❌ Error creating detailed article:', error);
      // Fallback to enhanced headline
      return `📰 *${newsItem.title}*\n\n_Source: ${newsItem.source}_\n\n🔍 *Breaking News Update*\n\nThis is a developing story in the world of sports. Stay tuned to SportMaster for more detailed coverage and analysis as more information becomes available.\n\n⚽ Follow us for the latest sports news and updates.`;
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