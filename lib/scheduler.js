// Scheduler for SportMaster — Multi-Channel SaaS
// Handles automatic content generation and posting with dynamic timing

const cron = require('node-cron');
const FootballAPI = require('./football-api');
const ContentGenerator = require('./content-generator');
const TelegramManager = require('./telegram');
const { getActiveChannels } = require('./channel-config');

class SportMasterScheduler {
  constructor() {
    this.footballAPI = new FootballAPI();
    this.telegram = new TelegramManager();
    this.isRunning = false;
    this.settings = null;
    this.todayMatches = [];
    this.dailyStats = {
      predictionsPosted: 0,
      resultsPosted: 0,
      promosPosted: 0,
      errors: 0
    };
    this.scheduledTasks = [];
  }

  // ─── SETTINGS ───

  async loadSettings() {
    try {
      const { systemSettings } = await import('../pages/api/settings.js');
      this.settings = systemSettings;
      console.log('⚙️ Settings loaded:', {
        websiteUrl: this.settings.websiteUrl,
        dynamicTiming: this.settings.autoPosting.dynamicTiming
      });
    } catch (error) {
      console.error('❌ Error loading settings:', error);
      this.settings = {
        websiteUrl: '',
        promoCodes: { default: 'SM100' },
        bonusOffers: { default: '100% Bonus' },
        autoPosting: { enabled: true, dynamicTiming: true, hoursBeforeMatch: 2 }
      };
    }
  }

  /** Create a ContentGenerator for a specific channel */
  createContentGenerator(channelConfig = null) {
    return new ContentGenerator({
      language: channelConfig?.language || 'en',
      timezone: channelConfig?.timezone || 'Africa/Addis_Ababa',
      websiteUrl: this.settings?.websiteUrl || 't.me/Sportmsterbot',
    });
  }

  // ─── START ───

  async start() {
    if (this.isRunning) {
      console.log('⚠️ Scheduler already running');
      return;
    }

    console.log('🚀 Starting SportMaster Dynamic Scheduler...');
    this.isRunning = true;
    await this.loadSettings();
    await this.telegram.testConnection();

    if (this.settings.autoPosting.dynamicTiming) {
      await this.initializeDynamicScheduling();
    } else {
      this.initializeFixedScheduling();
    }

    console.log('✅ All scheduled tasks activated');
  }

  // ─── DYNAMIC SCHEDULING ───

  async initializeDynamicScheduling() {
    console.log('🎯 Initializing Dynamic Match-Based Scheduling...');
    await this.loadTodayMatches();

    cron.schedule('0 6 * * *', async () => {
      if (!this.isRunning) return;
      await this.loadTodayMatches();
    }, { timezone: 'Africa/Addis_Ababa' });

    cron.schedule('*/30 * * * *', async () => {
      if (!this.isRunning) return;
      await this.checkAndPostPredictions();
    }, { timezone: 'Africa/Addis_Ababa' });

    cron.schedule('0 * * * *', async () => {
      if (!this.isRunning) return;
      await this.checkAndPostResults();
    }, { timezone: 'Africa/Addis_Ababa' });

    this.scheduleDailyPromos();
    console.log('✅ Dynamic scheduling initialized');
  }

  async loadTodayMatches() {
    try {
      console.log('📅 Loading upcoming matches for predictions...');
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
      this.createDaySchedule(timings);
    } catch (error) {
      console.error('❌ Error loading upcoming matches:', error);
      this.dailyStats.errors++;
    }
  }

  createDaySchedule(timings) {
    if (!timings || !timings.allMatches.length) return;
    console.log('📋 Creating dynamic schedule for today:');
    timings.allMatches.forEach((match, index) => {
      const hoursBeforeMatch = this.settings.autoPosting.hoursBeforeMatch || 2;
      const kickoffTime = match.kickoffTime instanceof Date ? match.kickoffTime : new Date(match.kickoffTime);
      const predictionTime = new Date(kickoffTime.getTime() - (hoursBeforeMatch * 60 * 60 * 1000));
      console.log(`${index + 1}. ${match.teams} - Predictions at ${predictionTime.toLocaleTimeString()} (${hoursBeforeMatch}h before)`);
    });
  }

  // ─── AUTO-POST: PREDICTIONS (all channels) ───

  async checkAndPostPredictions() {
    if (!this.todayMatches.length) return;

    const timings = this.footballAPI.getMatchTimings(this.todayMatches);
    if (!timings.shouldPostPredictions) return;

    const minGap = this.settings.autoPosting.minGapBetweenPosts || 30;
    if (this.lastPredictionPost && (new Date() - this.lastPredictionPost) < (minGap * 60 * 1000)) return;

    try {
      console.log('🎯 Auto-posting predictions to all channels...');
      const channels = await getActiveChannels();

      for (const ch of channels) {
        try {
          const cg = this.createContentGenerator(ch);
          const leagues = ch.leagues || [];
          const matches = leagues.length > 0
            ? await this.footballAPI.getTodayMatches(leagues)
            : this.todayMatches;

          if (matches.length === 0) continue;

          const promoCode = ch.coupon_code || 'SM100';
          const content = await cg.generateTop5Predictions(matches, promoCode);
          await this.telegram.sendPredictions(content, matches, ch);
          console.log(`✅ Predictions sent to ${ch.channel_id}`);
        } catch (err) {
          console.error(`❌ Predictions failed for ${ch.channel_id}:`, err.message);
        }
      }

      this.dailyStats.predictionsPosted++;
      this.lastPredictionPost = new Date();
    } catch (error) {
      console.error('❌ Error in dynamic predictions:', error);
      this.dailyStats.errors++;
    }
  }

  // ─── AUTO-POST: RESULTS (all channels) ───

  async checkAndPostResults() {
    try {
      if (this.resultsPostedToday) return;
      const currentHour = new Date().getHours();
      if (currentHour < 20) return;

      console.log('📊 Auto-posting daily results to all channels...');
      const channels = await getActiveChannels();

      for (const ch of channels) {
        try {
          const cg = this.createContentGenerator(ch);
          const leagues = ch.leagues || [];
          const results = await this.footballAPI.getYesterdayResults(leagues);
          if (results.length === 0) continue;

          const content = await cg.generateDailyResults(results);
          await this.telegram.sendResults(content, results, ch);
          console.log(`✅ Results sent to ${ch.channel_id}`);
        } catch (err) {
          console.error(`❌ Results failed for ${ch.channel_id}:`, err.message);
        }
      }

      this.dailyStats.resultsPosted++;
      this.resultsPostedToday = true;
    } catch (error) {
      console.error('❌ Error in dynamic results:', error);
      this.dailyStats.errors++;
    }
  }

  // ─── FIXED SCHEDULING ───

  initializeFixedScheduling() {
    this.scheduleTop5Predictions();
    this.scheduleDailyResults();
    this.scheduleDailyPromos();
    this.scheduleAnalytics();
  }

  scheduleTop5Predictions() {
    cron.schedule('0 8,10,12,14,16,18,20 * * *', async () => {
      if (!this.isRunning) return;
      try {
        console.log('⚽ Generating Top 5 Predictions...');
        const channels = await getActiveChannels();

        for (const ch of channels) {
          const cg = this.createContentGenerator(ch);
          const matches = await this.footballAPI.getTodayMatches(ch.leagues || []);
          if (matches.length === 0) continue;

          const now = new Date();
          const upcoming = matches.filter(m => {
            const hours = (m.kickoffTime - now) / 3600000;
            return hours >= 1 && hours <= 4;
          });
          if (upcoming.length === 0) continue;

          const content = await cg.generateTop5Predictions(upcoming, ch.coupon_code || 'SM100');
          await this.telegram.sendPredictions(content, upcoming, ch);
        }

        this.dailyStats.predictionsPosted++;
      } catch (error) {
        console.error('❌ Error in predictions schedule:', error);
        this.dailyStats.errors++;
      }
    }, { timezone: 'Africa/Addis_Ababa' });
  }

  scheduleDailyResults() {
    cron.schedule('0 23 * * *', async () => {
      if (!this.isRunning) return;
      try {
        console.log('📊 Generating Daily Results...');
        const channels = await getActiveChannels();

        for (const ch of channels) {
          const cg = this.createContentGenerator(ch);
          const results = await this.footballAPI.getYesterdayResults(ch.leagues || []);
          if (results.length === 0) continue;

          const content = await cg.generateDailyResults(results);
          await this.telegram.sendResults(content, results, ch);
        }

        this.dailyStats.resultsPosted++;
      } catch (error) {
        console.error('❌ Error in results schedule:', error);
        this.dailyStats.errors++;
      }
    }, { timezone: 'Africa/Addis_Ababa' });
  }

  // ─── PROMOS (all channels) ───

  scheduleDailyPromos() {
    cron.schedule('0 10 * * *', async () => {
      if (!this.isRunning) return;
      await this.sendScheduledPromo('morning');
    }, { timezone: 'Africa/Addis_Ababa' });

    cron.schedule('0 14 * * *', async () => {
      if (!this.isRunning) return;
      await this.sendScheduledPromo('afternoon');
    }, { timezone: 'Africa/Addis_Ababa' });

    cron.schedule('0 18 * * *', async () => {
      if (!this.isRunning) return;
      await this.sendScheduledPromo('evening');
    }, { timezone: 'Africa/Addis_Ababa' });

    console.log('📅 Daily Promos scheduled (10 AM, 2 PM, 6 PM)');
  }

  async sendScheduledPromo(timeSlot) {
    try {
      console.log(`🎁 Generating ${timeSlot} promo for all channels...`);
      const channels = await getActiveChannels();

      for (const ch of channels) {
        try {
          const cg = this.createContentGenerator(ch);
          const code = ch.coupon_code || 'SM100';
          const offer = ch.bonus_offer || '100% Bonus';
          const content = await cg.generatePromoMessage(code, offer);
          await this.telegram.sendPromo(content, code, ch);
          console.log(`✅ ${timeSlot} promo sent to ${ch.channel_id}`);
        } catch (err) {
          console.error(`❌ Promo failed for ${ch.channel_id}:`, err.message);
        }
      }

      this.dailyStats.promosPosted++;
    } catch (error) {
      console.error(`❌ Error in ${timeSlot} promo:`, error);
      this.dailyStats.errors++;
    }
  }

  // ─── ANALYTICS ───

  scheduleAnalytics() {
    cron.schedule('0 0 * * *', async () => {
      if (!this.isRunning) return;
      try {
        const stats = this.telegram.getClickStats();
        const report = this.generateAnalyticsReport(stats);
        console.log('📊 Daily Analytics Report:', report);
        this.dailyStats = { predictionsPosted: 0, resultsPosted: 0, promosPosted: 0, errors: 0 };
      } catch (error) {
        console.error('❌ Error in analytics schedule:', error);
      }
    }, { timezone: 'Africa/Addis_Ababa' });
  }

  generateAnalyticsReport(clickStats) {
    return {
      date: new Date().toLocaleDateString('en-US'),
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

  // ─── MANUAL EXECUTION (multi-channel) ───

  async executeManualPredictions(channelConfig = null) {
    try {
      console.log('🎯 Manual predictions execution...');
      const leagues = channelConfig?.leagues || [];
      const matches = await this.footballAPI.getUpcomingMatches(leagues);
      if (matches.length === 0) throw new Error('No upcoming matches found for next 3 hours');

      const cg = this.createContentGenerator(channelConfig);
      const promoCode = channelConfig?.coupon_code || 'SM100';
      const content = await cg.generateTop5Predictions(matches, promoCode);
      const result = await this.telegram.sendPredictions(content, matches, channelConfig);

      this.dailyStats.predictionsPosted++;
      return { success: true, messageId: result.messageIds?.[0] };
    } catch (error) {
      this.dailyStats.errors++;
      throw error;
    }
  }

  async executeManualResults(channelConfig = null) {
    try {
      console.log('📊 Manual results execution...');
      const leagues = channelConfig?.leagues || [];
      const allResults = await this.footballAPI.getYesterdayResults(leagues);

      let filteredResults = allResults;
      try {
        const { supabase } = require('./supabase');
        if (supabase) {
          const { data: posts, error } = await supabase
            .from('telegram_posts')
            .select('metadata')
            .eq('type', 'predictions')
            .gte('created_at', new Date(Date.now() - 48 * 3600000).toISOString());

          if (!error && posts && posts.length > 0) {
            const predictedPairs = new Set();
            posts.forEach(post => {
              if (post.metadata?.homeTeam && post.metadata?.awayTeam) {
                predictedPairs.add(`${post.metadata.homeTeam.toLowerCase()}__${post.metadata.awayTeam.toLowerCase()}`);
              } else if (post.metadata?.matches) {
                post.metadata.matches.forEach(m => {
                  if (m.homeTeam && m.awayTeam) predictedPairs.add(`${m.homeTeam.toLowerCase()}__${m.awayTeam.toLowerCase()}`);
                });
              }
            });

            if (predictedPairs.size > 0) {
              filteredResults = allResults.filter(r => {
                const h = (r.homeTeam?.name || r.homeTeam || '').toLowerCase();
                const a = (r.awayTeam?.name || r.awayTeam || '').toLowerCase();
                return predictedPairs.has(`${h}__${a}`);
              });
            }
          }
        }
      } catch (e) {
        filteredResults = allResults.slice(0, 5);
      }

      // If no predicted matches found, fall back to top 5 results by league importance
      if (filteredResults.length === 0) {
        console.log('⚠️ No predicted matches matched results, using top 5 results');
        filteredResults = allResults.slice(0, 5);
      }
      if (filteredResults.length === 0) throw new Error('No results available for yesterday');

      const cg = this.createContentGenerator(channelConfig);
      const content = await cg.generateDailyResults(filteredResults);
      const result = await this.telegram.sendResults(content, filteredResults, channelConfig);

      this.dailyStats.resultsPosted++;
      return { success: true, messageId: result.message_id };
    } catch (error) {
      this.dailyStats.errors++;
      throw error;
    }
  }

  async executeManualPromo(promoType = 'special', channelConfig = null) {
    try {
      console.log('🎁 Manual promo execution...');
      return await this.telegram.executePromoCommand(promoType, channelConfig);
    } catch (error) {
      this.dailyStats.errors++;
      throw error;
    }
  }

  async executeManualHype(channelConfig = null) {
    try {
      console.log('⚡ Manual today hype execution...');
      const executionStart = Date.now();
      if (!this.settings) await this.loadSettings();

      const leagues = channelConfig?.leagues || [];
      let matches = await this.footballAPI.getTodayMatches(leagues);
      if (!matches || matches.length === 0) {
        matches = await this.footballAPI.getAllTodayMatchesRanked();
      }
      if (!matches || matches.length === 0) throw new Error('No games found for today');

      const cg = this.createContentGenerator(channelConfig);
      const promoCode = channelConfig?.coupon_code || 'SM100';
      const content = await cg.generateTodayHype(matches, promoCode);
      const keyboard = await this.telegram.buildKeyboard(channelConfig, 'predictions');
      const targetChannel = this.telegram.resolveChannel(channelConfig);

      // Try AI image
      let imageBuffer = null;
      try {
        const ImageGenerator = require('./image-generator');
        const imageGen = new ImageGenerator();
        imageBuffer = await imageGen.generateTodayHypeImage(matches);
      } catch (e) {
        console.log('❌ Hype image generation failed:', e?.message || e);
      }

      let msg;
      if (imageBuffer) {
        msg = await this.telegram.bot.sendPhoto(targetChannel, imageBuffer, {
          caption: content, parse_mode: 'HTML',
          reply_markup: { inline_keyboard: keyboard }
        });
      } else {
        msg = await this.telegram.bot.sendMessage(targetChannel, content, {
          parse_mode: 'HTML', disable_web_page_preview: true,
          reply_markup: { inline_keyboard: keyboard }
        });
      }

      const matchMetadata = {
        matches: matches.slice(0, 5).map(m => ({
          homeTeam: m.homeTeam?.name || m.homeTeam,
          awayTeam: m.awayTeam?.name || m.awayTeam,
          competition: m.competition?.name || m.league?.name,
          matchId: m.fixture?.id || m.id
        }))
      };

      await this.telegram.logPostToSupabase('today_hype', content, msg.message_id, matchMetadata, channelConfig);

      const totalTime = ((Date.now() - executionStart) / 1000).toFixed(1);
      console.log(`⏱️ Total hype execution completed in ${totalTime}s`);
      return { success: true, messageId: msg.message_id };
    } catch (error) {
      this.dailyStats.errors++;
      throw error;
    }
  }

  async executeManualBonus(bonusText, channelConfig = null) {
    try {
      return await this.telegram.executeBonusCommand(bonusText, channelConfig);
    } catch (error) {
      this.dailyStats.errors++;
      throw error;
    }
  }

  // ─── STATUS ───

  stop() {
    this.isRunning = false;
    console.log('🛑 SportMaster Scheduler stopped');
  }

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

// Backward compat alias
const GizeBetsScheduler = SportMasterScheduler;

module.exports = SportMasterScheduler;
module.exports.GizeBetsScheduler = GizeBetsScheduler;
