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
You are a passionate sports journalist for SportMaster, writing a news article with a lively, engaging tone. Based on the provided headline, craft a short sports news article in English that feels like a fresh report from the field, with a touch of personality and commentary on the content.
HEADLINE: "${newsItem.title}"

SOURCE: ${newsItem.source}

DATE: ${newsItem.pubDate || 'Recent'}
Write a SHORT and CONCISE sports news article with:
📰 HEADLINE (bold)

Use the provided headline verbatim.

🔍 KEY FACTS (2-3 sentences max)

Cover WHO, WHAT, WHEN, WHERE.
Highlight the most critical details in a clear, energetic tone.
Include a brief comment on the content (e.g., "Bold picks!" or "Surprising choice!").

💬 FAN TALK (1-2 sentences)

Add a personal, conversational take: What does this news mean for fans or the season?
Keep it relatable, like chatting with a fellow fan (e.g., "Can Arsenal finally do it?").

⚽ WRAP-UP (1 sentence)

Point to what’s next (e.g., upcoming matches, key moments to watch).

CRITICAL REQUIREMENTS:

Maximum 300 characters total (including spaces).
4-5 sentences maximum.
Use bold for headlines only, italics for emphasis or quotes.
Write in a lively, personal tone with a touch of flair, like a passionate sports reporter.
Focus on ONE main point from the headline.
Avoid overly analytical language; make it feel like a news report with a fan’s perspective.

OUTPUT FORMAT (Telegram Markdown):

Use emojis for sections (📰, 🔍, 💬, ⚽).
Bold for headline, italics for emphasis/quotes.
Clear paragraph breaks.

Example Output (for reference):

📰 Premier League Kicks Off with a Bang!

🔍 The 2025-26 season starts this weekend, with Man City tipped to dominate. Bold picks!

💬 City’s reign feels unstoppable, but can Arsenal sneak in? Fans are buzzing!

⚽ Watch the opening clashes this Saturday.
`;

      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "You are a passionate sports journalist. Write engaging, lively SHORT news articles in English. Maximum 4-5 sentences with personality and fan perspective. Be energetic and conversational."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        max_tokens: 200, // Short content only
        temperature: 0.6
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