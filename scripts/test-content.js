#!/usr/bin/env node
// Test script to preview generated content and formatting
// Usage: node scripts/test-content.js

const FootballAPI = require('../lib/football-api');
const ContentGenerator = require('../lib/content-generator');

async function testContentGeneration() {
console.log('🧪 Testing SportMaster Content Generation...\n');

  try {
    const footballAPI = new FootballAPI();
const contentGenerator = new ContentGenerator('t.me/Sportmsterbot');

    console.log('📊 Step 1: Getting enhanced match data...');
    
    // Try to get enhanced match data
    let matches;
    try {
      matches = await footballAPI.getEnhancedTop5Matches();
      console.log('✅ Enhanced match data retrieved');
    } catch (error) {
      console.log('⚠️ Enhanced data failed, using basic matches');
      matches = await footballAPI.getTodayMatches();
    }

    if (matches.length === 0) {
      console.log('❌ No matches found - using mock data for demonstration');
      matches = [
        {
          homeTeam: { name: 'Manchester United' },
          awayTeam: { name: 'Arsenal' },
          competition: { name: 'Premier League' },
          kickoffTime: new Date(Date.now() + 2 * 60 * 60 * 1000),
          homeTeamData: {
            form: 'WWLDW',
            stats: {
              winPercentage: 65,
              averageGoalsFor: 2.1,
              averageGoalsAgainst: 1.2
            }
          },
          awayTeamData: {
            form: 'WDLWW',
            stats: {
              winPercentage: 58,
              averageGoalsFor: 1.8,
              averageGoalsAgainst: 1.5
            }
          },
          predictionFactors: {
            homeFormStrength: 'Strong',
            awayFormStrength: 'Average',
            h2hTrend: 'Home dominance',
            goalExpectancy: '2.8',
            riskLevel: 'Medium'
          },
          headToHead: {
            totalMatches: 5
          }
        }
      ];
    }

    console.log(`\n📝 Step 2: Generating content for ${matches.length} matches...`);
    
    // Generate predictions content
    const predictionsContent = await contentGenerator.generateTop5Predictions(matches, 'WIN10');
    
    console.log('\n🎯 GENERATED PREDICTIONS CONTENT:');
    console.log('═'.repeat(80));
    console.log(predictionsContent);
    console.log('═'.repeat(80));

    // Test Telegram formatting
    console.log('\n📱 TELEGRAM FORMATTING PREVIEW:');
    console.log('═'.repeat(80));
    
    // HTML formatting example
    const formattedContent = formatForTelegram(predictionsContent);
    console.log(formattedContent);
    console.log('═'.repeat(80));

    // Show buttons that will be attached
    console.log('\n🔘 INLINE BUTTONS:');
    console.log('┌─────────────────┬─────────────────┐');
    console.log('│  🎯 Live Scores  │  📊 More Tips   │');
    console.log('├─────────────────────────────────────┤');
    console.log('│           💰 Win Today!           │');
    console.log('└─────────────────────────────────────┘');

    console.log('\n✅ Content generation test completed!');
    console.log('🔗 All links will include UTM tracking');
    console.log('📊 Click tracking will be enabled');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

function formatForTelegram(content) {
  // Add Telegram HTML formatting
  return content
    .replace(/\*\*(.*?)\*\*/g, '<b>$1</b>') // Bold
    .replace(/\*(.*?)\*/g, '<i>$1</i>') // Italic
    .replace(/`(.*?)`/g, '<code>$1</code>') // Code
    .replace(/⚽/g, '⚽') // Ensure emojis are preserved
    .replace(/🎯/g, '🎯')
    .replace(/💰/g, '💰')
    .replace(/🔥/g, '🔥')
    .replace(/📊/g, '📊');
}

// Run test if called directly
if (require.main === module) {
  testContentGeneration();
}

module.exports = { testContentGeneration };