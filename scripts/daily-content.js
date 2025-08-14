#!/usr/bin/env node
// Daily content generation script for SportMaster
// Can be run manually or via cron job
// Usage: node scripts/daily-content.js [predictions|results|promo|all]

const FootballAPI = require('../lib/football-api');
const ContentGenerator = require('../lib/content-generator');
const TelegramManager = require('../lib/telegram');

async function generateDailyContent(contentType = 'all') {
console.log(`🎯 SportMaster Daily Content Generator`);
  console.log(`📅 Date: ${new Date().toLocaleDateString('am-ET')}`);
  console.log(`🕒 Time: ${new Date().toLocaleString('am-ET', { timeZone: 'Africa/Addis_Ababa' })}`);
  console.log(`📝 Content Type: ${contentType}\n`);

  try {
    // Initialize services
    const footballAPI = new FootballAPI();
    const contentGenerator = new ContentGenerator();
    const telegram = new TelegramManager();

    // Test Telegram connection
    const connectionTest = await telegram.testConnection();
    if (!connectionTest) {
      throw new Error('Failed to connect to Telegram');
    }

    let results = {};

    if (contentType === 'predictions' || contentType === 'all') {
      console.log('⚽ Generating Top 5 Predictions...');
      try {
        const matches = await footballAPI.getTodayMatches();
        if (matches.length > 0) {
          const content = await contentGenerator.generateTop5Predictions(matches);
          const result = await telegram.sendPredictions(content, matches);
          results.predictions = {
            success: true,
            messageId: result.message_id,
            matchesFound: matches.length
          };
          console.log(`✅ Predictions sent! Message ID: ${result.message_id}`);
        } else {
          results.predictions = {
            success: false,
            error: 'No matches found for today'
          };
          console.log('⚠️ No matches found for today');
        }
      } catch (error) {
        results.predictions = {
          success: false,
          error: error.message
        };
        console.log(`❌ Predictions failed: ${error.message}`);
      }
      console.log('');
    }

    if (contentType === 'results' || contentType === 'all') {
      console.log('📊 Generating Daily Results...');
      try {
        const yesterdayResults = await footballAPI.getYesterdayResults();
        if (yesterdayResults.length > 0) {
          const content = await contentGenerator.generateDailyResults(yesterdayResults);
          const result = await telegram.sendResults(content);
          results.results = {
            success: true,
            messageId: result.message_id,
            resultsFound: yesterdayResults.length
          };
          console.log(`✅ Results sent! Message ID: ${result.message_id}`);
        } else {
          results.results = {
            success: false,
            error: 'No results found for yesterday'
          };
          console.log('⚠️ No results found for yesterday');
        }
      } catch (error) {
        results.results = {
          success: false,
          error: error.message
        };
        console.log(`❌ Results failed: ${error.message}`);
      }
      console.log('');
    }

    if (contentType === 'promo' || contentType === 'all') {
      console.log('🎁 Generating Daily Promo...');
      try {
        // Determine promo based on time of day
        const hour = new Date().getHours();
        let promoType = 'special';
let promoCode = 'SM100';
        let promoOffer = '100 ETB Bonus';

        if (hour >= 6 && hour < 12) {
          promoType = 'morning';
  promoCode = 'SM100';
          promoOffer = '100 ETB Bonus';
        } else if (hour >= 12 && hour < 18) {
          promoType = 'afternoon';
  promoCode = 'SM100';
          promoOffer = '100 ETB Bonus';
        } else if (hour >= 18) {
          promoType = 'evening';
  promoCode = 'SM100';
          promoOffer = '100 ETB Bonus';
        }

        const content = await contentGenerator.generatePromoMessage(promoCode, promoOffer);
        const result = await telegram.sendPromo(content, promoCode);
        results.promo = {
          success: true,
          messageId: result.message_id,
          promoCode: promoCode,
          promoType: promoType
        };
        console.log(`✅ Promo sent! Message ID: ${result.message_id}, Code: ${promoCode}`);
      } catch (error) {
        results.promo = {
          success: false,
          error: error.message
        };
        console.log(`❌ Promo failed: ${error.message}`);
      }
      console.log('');
    }

    // Summary
    console.log('📋 SUMMARY');
    console.log('═'.repeat(50));
    
    const totalSuccess = Object.values(results).filter(r => r.success).length;
    const totalAttempted = Object.keys(results).length;
    
    Object.entries(results).forEach(([type, result]) => {
      const status = result.success ? '✅' : '❌';
      const info = result.success ? 
        `Message ID: ${result.messageId}` : 
        `Error: ${result.error}`;
      console.log(`${status} ${type.toUpperCase()}: ${info}`);
    });
    
    console.log('═'.repeat(50));
    console.log(`🎯 Success Rate: ${totalSuccess}/${totalAttempted} (${Math.round(totalSuccess/totalAttempted*100)}%)`);
console.log(`📱 Channel: ${process.env.CHANNEL_ID}`);
    console.log(`🌍 Time Zone: Africa/Addis_Ababa`);
    console.log(`🔤 Language: Amharic (አማርኛ)`);

    return results;

  } catch (error) {
    console.error('💥 Fatal error:', error.message);
    process.exit(1);
  }
}

// Command line interface
if (require.main === module) {
  const contentType = process.argv[2] || 'all';
  
  const validTypes = ['predictions', 'results', 'promo', 'all'];
  if (!validTypes.includes(contentType)) {
    console.error(`❌ Invalid content type: ${contentType}`);
    console.error(`✅ Valid types: ${validTypes.join(', ')}`);
    process.exit(1);
  }

  generateDailyContent(contentType)
    .then(() => {
      console.log('\n🏁 Daily content generation completed!');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n💥 Script failed:', error.message);
      process.exit(1);
    });
}

module.exports = { generateDailyContent };