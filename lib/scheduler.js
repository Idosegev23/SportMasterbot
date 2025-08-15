// Scheduler for SportMaster Dynamic Automated Posts
// Handles automatic content generation and posting with dynamic timing

const cron = require('node-cron');
const FootballAPI = require('./football-api');
const ContentGenerator = require('./content-generator');
const TelegramManager = require('./telegram');

class GizeBetsScheduler {
  constructor() {
    this.footballAPI = new FootballAPI();
    this.contentGenerator = new ContentGenerator();
    this.telegram = new TelegramManager();
    this.isRunning = false;
    this.settings = null; // Will be loaded from settings API
    this.todayMatches = [];
    this.dailyStats = {
      predictionsPosted: 0,
      resultsPosted: 0,
      promosPosted: 0,
      errors: 0
    };
    this.scheduledTasks = [];
  }

  // Load settings from settings API
  async loadSettings() {
    try {
      const { systemSettings } = await import('../pages/api/settings.js');
      this.settings = systemSettings;
      
      // Update content generator with new website URL
      this.contentGenerator = new ContentGenerator(this.settings.websiteUrl);
      
      console.log('⚙️ Settings loaded:', {
        websiteUrl: this.settings.websiteUrl,
        dynamicTiming: this.settings.autoPosting.dynamicTiming
      });
    } catch (error) {
      console.error('❌ Error loading settings:', error);
      // Fallback settings
      this.settings = {
        websiteUrl: '',
        promoCodes: { default: 'SM100' },
        bonusOffers: { default: '100% Bonus' },
        autoPosting: { enabled: true, dynamicTiming: true, hoursBeforeMatch: 2 }
      };
    }
  }

  // Start all scheduled tasks
  async start() {
    if (this.isRunning) {
      console.log('⚠️ Scheduler already running');
      return;
    }

    console.log('🚀 Starting SportMaster Dynamic Scheduler...');
    this.isRunning = true;

    // Load settings first
    await this.loadSettings();

    // Test connection
    await this.telegram.testConnection();

    if (this.settings.autoPosting.dynamicTiming) {
      // Dynamic scheduling based on actual matches
      await this.initializeDynamicScheduling();
    } else {
      // Traditional fixed scheduling
      this.initializeFixedScheduling();
    }

    console.log('✅ All scheduled tasks activated');
    console.log('📊 Check /api/status for scheduler status');
  }

  // Initialize dynamic scheduling based on match times
  async initializeDynamicScheduling() {
    console.log('🎯 Initializing Dynamic Match-Based Scheduling...');
    
    // Load today's matches once at startup
    await this.loadTodayMatches();
    
    // Schedule daily match loading (every morning at 6 AM)
    cron.schedule('0 6 * * *', async () => {
      if (!this.isRunning) return;
      await this.loadTodayMatches();
    }, { timezone: 'Africa/Addis_Ababa' });
    
    // Check every 30 minutes if we should post predictions
    cron.schedule('*/30 * * * *', async () => {
      if (!this.isRunning) return;
      await this.checkAndPostPredictions();
    }, { timezone: 'Africa/Addis_Ababa' });
    
    // Check every hour for results posting
    cron.schedule('0 * * * *', async () => {
      if (!this.isRunning) return;
      await this.checkAndPostResults();
    }, { timezone: 'Africa/Addis_Ababa' });
    
    // Schedule promotional messages (still time-based)
    this.scheduleDailyPromos();
    
    console.log('✅ Dynamic scheduling initialized');
  }

  // Load and analyze upcoming matches (next 2-3 hours)
  async loadTodayMatches() {
    try {
      console.log('📅 Loading upcoming matches for predictions...');
      
      // Get matches starting in next 2-3 hours
      this.todayMatches = await this.footballAPI.getUpcomingMatches();
      
      if (this.todayMatches.length === 0) {
        console.log('⚠️ No upcoming matches found for next 3 hours');
        return;
      }
      
      const timings = this.footballAPI.getMatchTimings(this.todayMatches);
      
      console.log(`✅ Loaded ${this.todayMatches.length} upcoming matches`);
      if (timings?.nextMatch) {
        console.log('⏰ Next match:', timings.nextMatch.teams, 
                    `in ${Math.round(timings.nextMatch.timeUntilKickoff || 0)} minutes`);
      }
      
      // Create dynamic schedule for the day
      this.createDaySchedule(timings);
      
      console.log(`📊 Upcoming matches loaded for prediction timing`);
      
    } catch (error) {
      console.error('❌ Error loading upcoming matches:', error);
      this.dailyStats.errors++;
    }
  }

  // Create schedule based on match timings
  createDaySchedule(timings) {
    if (!timings || !timings.allMatches.length) return;
    
    console.log('📋 Creating dynamic schedule for today:');
    
    timings.allMatches.forEach((match, index) => {
      const hoursBeforeMatch = this.settings.autoPosting.hoursBeforeMatch || 2;
      
      // Ensure kickoffTime is a Date object
      const kickoffTime = match.kickoffTime instanceof Date ? match.kickoffTime : new Date(match.kickoffTime);
      const predictionTime = new Date(kickoffTime.getTime() - (hoursBeforeMatch * 60 * 60 * 1000));
      
      console.log(`${index + 1}. ${match.teams} - Predictions at ${predictionTime.toLocaleTimeString()} (${hoursBeforeMatch}h before)`);
    });
  }

  // Check if we should post predictions now
  async checkAndPostPredictions() {
    if (!this.todayMatches.length) return;
    
    const timings = this.footballAPI.getMatchTimings(this.todayMatches);
    if (!timings.shouldPostPredictions) return;
    
    // Check if we haven't posted recently
    const minGap = this.settings.autoPosting.minGapBetweenPosts || 30; // minutes
    if (this.lastPredictionPost && 
        (new Date() - this.lastPredictionPost) < (minGap * 60 * 1000)) {
      return;
    }
    
    try {
      console.log('🎯 Auto-posting predictions based on match timing...');
      
      const promoCode = this.settings.promoCodes.default;
      const content = await this.contentGenerator.generateTop5Predictions(this.todayMatches, promoCode);
      await this.telegram.sendPredictions(content, this.todayMatches);
      
      this.dailyStats.predictionsPosted++;
      this.lastPredictionPost = new Date();
      
      console.log('✅ Dynamic predictions posted successfully');
      
    } catch (error) {
      console.error('❌ Error in dynamic predictions:', error);
      this.dailyStats.errors++;
    }
  }

  // Check if we should post results now
  async checkAndPostResults() {
    try {
      const results = await this.footballAPI.getYesterdayResults();
      
      if (results.length === 0) return;
      
      // Only post results once per day
      if (this.resultsPostedToday) return;
      
      // Post results in the evening (after 8 PM)
      const currentHour = new Date().getHours();
      if (currentHour < 20) return;
      
      console.log('📊 Auto-posting daily results...');
      
      const content = await this.contentGenerator.generateDailyResults(results);
      await this.telegram.sendResults(content);
      
      this.dailyStats.resultsPosted++;
      this.resultsPostedToday = true;
      
      console.log('✅ Dynamic results posted successfully');
      
    } catch (error) {
      console.error('❌ Error in dynamic results:', error);
      this.dailyStats.errors++;
    }
  }

  // Stop all scheduled tasks
  stop() {
    this.isRunning = false;
    console.log('🛑 SportMaster Scheduler stopped');
  }

  // Schedule Top 5 Match Predictions
  scheduleTop5Predictions() {
    // Every 2 hours from 8 AM to 8 PM (Ethiopia time)
    cron.schedule('0 8,10,12,14,16,18,20 * * *', async () => {
      if (!this.isRunning) return;
      
      try {
        console.log('⚽ Generating Top 5 Predictions...');
        
        const matches = await this.footballAPI.getTodayMatches();
        
        if (matches.length === 0) {
          console.log('⚠️ No matches found for today');
          return;
        }

        // Check if matches are starting within next 2-4 hours
        const now = new Date();
        const upcomingMatches = matches.filter(match => {
          const timeDiff = match.kickoffTime - now;
          const hoursUntil = timeDiff / (1000 * 60 * 60);
          return hoursUntil >= 1 && hoursUntil <= 4; // 1-4 hours before
        });

        if (upcomingMatches.length > 0) {
          const content = await this.contentGenerator.generateTop5Predictions(upcomingMatches);
          await this.telegram.sendPredictions(content, upcomingMatches);
          
          this.dailyStats.predictionsPosted++;
          console.log('✅ Top 5 Predictions sent successfully');
        } else {
          console.log('⏭️ No upcoming matches in 2-4 hour window');
        }

      } catch (error) {
        console.error('❌ Error in predictions schedule:', error);
        this.dailyStats.errors++;
      }
    }, {
      timezone: 'Africa/Addis_Ababa'
    });

    console.log('📅 Top 5 Predictions scheduled (every 2 hours, 8 AM - 8 PM)');
  }

  // Schedule Daily Results  
  scheduleDailyResults() {
    // Every day at 11 PM (Ethiopia time)
    cron.schedule('0 23 * * *', async () => {
      if (!this.isRunning) return;
      
      try {
        console.log('📊 Generating Daily Results...');
        
        const results = await this.footballAPI.getYesterdayResults();
        
        if (results.length === 0) {
          console.log('⚠️ No results found for yesterday');
          return;
        }

        const content = await this.contentGenerator.generateDailyResults(results);
        await this.telegram.sendResults(content);
        
        this.dailyStats.resultsPosted++;
        console.log('✅ Daily Results sent successfully');

      } catch (error) {
        console.error('❌ Error in results schedule:', error);
        this.dailyStats.errors++;
      }
    }, {
      timezone: 'Africa/Addis_Ababa'
    });

    console.log('📅 Daily Results scheduled (11 PM daily)');
  }

  // Schedule Daily Promos
  scheduleDailyPromos() {
    // Morning promo at 10 AM
    cron.schedule('0 10 * * *', async () => {
      if (!this.isRunning) return;
      await this.sendScheduledPromo('morning');
    }, {
      timezone: 'Africa/Addis_Ababa'
    });

    // Afternoon promo at 2 PM  
    cron.schedule('0 14 * * *', async () => {
      if (!this.isRunning) return;
      await this.sendScheduledPromo('afternoon');
    }, {
      timezone: 'Africa/Addis_Ababa'
    });

    // Evening promo at 6 PM
    cron.schedule('0 18 * * *', async () => {
      if (!this.isRunning) return;
      await this.sendScheduledPromo('evening');
    }, {
      timezone: 'Africa/Addis_Ababa'
    });

    console.log('📅 Daily Promos scheduled (10 AM, 2 PM, 6 PM)');
  }

  // Send scheduled promotional content
  async sendScheduledPromo(timeSlot) {
    try {
      console.log(`🎁 Generating ${timeSlot} promo...`);
      
      const promoCodes = {
        morning: { code: 'gize251', offer: '100 ETB Bonus' },
        afternoon: { code: 'gize251', offer: '100 ETB Bonus' },
        evening: { code: 'gize251', offer: '100 ETB Bonus' }
      };
      
      const promo = promoCodes[timeSlot];
      const content = await this.contentGenerator.generatePromoMessage(promo.code, promo.offer);
      await this.telegram.sendPromo(content, promo.code);
      
      this.dailyStats.promosPosted++;
      console.log(`✅ ${timeSlot} promo sent successfully`);

    } catch (error) {
      console.error(`❌ Error in ${timeSlot} promo:`, error);
      this.dailyStats.errors++;
    }
  }

  // Schedule Analytics Report
  scheduleAnalytics() {
    // Daily analytics at midnight
    cron.schedule('0 0 * * *', async () => {
      if (!this.isRunning) return;
      
      try {
        console.log('📈 Generating daily analytics...');
        
        const stats = this.telegram.getClickStats();
        const report = this.generateAnalyticsReport(stats);
        
        console.log('📊 Daily Analytics Report:', report);
        
        // Reset daily stats
        this.dailyStats = {
          predictionsPosted: 0,
          resultsPosted: 0, 
          promosPosted: 0,
          errors: 0
        };

      } catch (error) {
        console.error('❌ Error in analytics schedule:', error);
      }
    }, {
      timezone: 'Africa/Addis_Ababa'
    });

    console.log('📅 Analytics scheduled (midnight daily)');
  }

  // Generate analytics report
  generateAnalyticsReport(clickStats) {
    const today = new Date().toLocaleDateString('am-ET');
    
    return {
      date: today,
      posts: {
        predictions: this.dailyStats.predictionsPosted,
        results: this.dailyStats.resultsPosted,
        promos: this.dailyStats.promosPosted
      },
      engagement: clickStats,
      errors: this.dailyStats.errors,
      uptime: this.isRunning ? 'Active' : 'Inactive'
    };
  }

  // Manual execution methods for API endpoints
  async executeManualPredictions() {
    try {
      console.log('🎯 Manual predictions execution...');
      
      // Get upcoming matches (starting in next 2-3 hours) instead of all today's matches
      const matches = await this.footballAPI.getUpcomingMatches();
      if (matches.length === 0) {
        throw new Error('No upcoming matches found for next 3 hours');
      }
      
      console.log(`📊 Found ${matches.length} upcoming matches for predictions`);
      
      const content = await this.contentGenerator.generateTop5Predictions(matches);
      const result = await this.telegram.sendPredictions(content, matches);
      
      this.dailyStats.predictionsPosted++;
      return { success: true, messageId: result.message_id };

    } catch (error) {
      this.dailyStats.errors++;
      throw error;
    }
  }

  async executeManualResults() {
    try {
      console.log('📊 Manual results execution...');
      
      const results = await this.footballAPI.getYesterdayResults();
      if (results.length === 0) {
        throw new Error('No results available for yesterday');
      }
      
      const content = await this.contentGenerator.generateDailyResults(results);
      const result = await this.telegram.sendResults(content, results);
      
      this.dailyStats.resultsPosted++;
      return { success: true, messageId: result.message_id };

    } catch (error) {
      this.dailyStats.errors++;
      throw error;
    }
  }

  async executeManualPromo(promoType = 'special') {
    try {
      console.log('🎁 Manual promo execution...');
      
      return await this.telegram.executePromoCommand(promoType);

    } catch (error) {
      this.dailyStats.errors++;
      throw error;
    }
  }

  async executeManualHype() {
    try {
      console.log('⚡ Manual today hype execution...');
      const executionStart = Date.now();

      // Ensure settings are loaded for correct CG configuration
      if (!this.settings) {
        await this.loadSettings();
      }

      // Get today's matches (fallback to ranked if empty)
      let matches = await this.footballAPI.getTodayMatches();
      if (!matches || matches.length === 0) {
        matches = await this.footballAPI.getAllTodayMatchesRanked();
      }
      if (!matches || matches.length === 0) {
        throw new Error('No games found for today');
      }

      // Build hype content
      const content = await this.contentGenerator.generateTodayHype(matches);
      const keyboard = await this.telegram.createPredictionsKeyboard();

      // Try to add AI image (non-fatal)
      let imageBuffer = null;
      try {
        console.log('🖼️ Starting hype image generation...');
        const ImageGenerator = require('./image-generator');
        const imageGen = new ImageGenerator();
        imageBuffer = await imageGen.generateTodayHypeImage(matches);
        
        if (imageBuffer) {
          console.log('✅ Hype image generated successfully, will send with photo');
        } else {
          console.log('⚠️ Image generation returned null, sending text only');
        }
      } catch (e) {
        console.log('❌ Hype image generation failed, sending text only:', e?.message || e);
        console.log('📝 Full error details:', e);
      }

      // Send to channel
      let msg;
      if (imageBuffer) {
        msg = await this.telegram.bot.sendPhoto(this.telegram.channelId, imageBuffer, {
          caption: content,
          parse_mode: 'HTML',
          reply_markup: { inline_keyboard: keyboard }
        });
      } else {
        msg = await this.telegram.bot.sendMessage(this.telegram.channelId, content, {
          parse_mode: 'HTML',
          disable_web_page_preview: true,
          reply_markup: { inline_keyboard: keyboard }
        });
      }

      await this.telegram.logPostToSupabase('today_hype', content, msg.message_id);

      const totalExecutionTime = ((Date.now() - executionStart) / 1000).toFixed(1);
      console.log(`⏱️ Total hype execution completed in ${totalExecutionTime}s`);

      return { success: true, messageId: msg.message_id };
    } catch (error) {
      this.dailyStats.errors++;
      throw error;
    }
  }

  async executeManualBonus(bonusText) {
    try {
      console.log('💰 Manual bonus execution...');
      
      return await this.telegram.executeBonusCommand(bonusText);

    } catch (error) {
      this.dailyStats.errors++;
      throw error;
    }
  }

  // Get current status
  getStatus() {
    return {
      isRunning: this.isRunning,
      dailyStats: this.dailyStats,
      nextScheduled: {
        predictions: 'Every 2 hours (8 AM - 8 PM)',
        results: 'Daily at 11 PM',
        promos: '10 AM, 2 PM, 6 PM',
        analytics: 'Midnight'
      },
      timezone: 'Africa/Addis_Ababa'
    };
  }
}

module.exports = GizeBetsScheduler;