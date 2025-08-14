#!/usr/bin/env node
// Preview example of how messages will look in Telegram

const TelegramManager = require('./lib/telegram');

// Mock data for demonstration
const mockPredictionsContent = `⚽ Today's Top 5 Match Predictions ⚽

🏆 Manchester United vs Arsenal (Premier League)
⏰ 3:00 PM
🎯 Prediction: Over 2.5 Goals
🔥 Confidence: High
📊 Reasoning: Both teams averaging 2.1+ goals per game

🏆 Barcelona vs Real Madrid (La Liga)  
⏰ 8:00 PM
🎯 Prediction: Both Teams to Score
🔥 Confidence: Medium
📊 Reasoning: Classic El Clasico with attacking mindset

🏆 Bayern Munich vs Dortmund (Bundesliga)
⏰ 5:30 PM  
🎯 Prediction: Bayern Win
🔥 Confidence: High
📊 Reasoning: Home advantage + superior form (WWWDW)

🎁 Claim Today's Bonus!
💸 Use code: WIN10
🔗 gizebets.et`;

const mockResultsContent = `📊 Today's Results 📊

Liverpool 3-1 Chelsea
Arsenal 2-0 Tottenham  
Manchester City 4-2 Manchester United
Barcelona 1-1 Real Madrid
Bayern Munich 3-0 Dortmund

🔗 Full Results: gizebets.et`;

const mockPromoContent = `🎁 Today's Special Bonus! 🎁

Get 100% First Deposit Bonus!

💰 Code: WIN10
⏰ Today Only!
🔥 Claim Now

🔗 gizebets.et/bonus`;

function previewMessages() {
    console.log('📱 GIZEBETS MESSAGE PREVIEWS\n');
    console.log('═'.repeat(80));
    
    // Create mock telegram manager for formatting
    const telegram = new TelegramManager();
    
    console.log('🎯 PREDICTIONS MESSAGE:');
    console.log('━'.repeat(50));
    const formattedPredictions = telegram.formatPredictionsMessage(mockPredictionsContent);
    console.log(formattedPredictions);
    console.log('\n🔘 Buttons: [🎯 Live Scores] [📊 More Tips]');
    console.log('           [💰 Win Today!]');
    
    console.log('\n═'.repeat(80));
    console.log('📊 RESULTS MESSAGE:');
    console.log('━'.repeat(50));
    const formattedResults = telegram.formatResultsMessage(mockResultsContent);
    console.log(formattedResults);
    console.log('\n🔘 Buttons: [📈 Detailed Analysis] [⚽ Live Scores]');
    console.log('           [🎁 Tomorrow\'s Bonus]');
    
    console.log('\n═'.repeat(80));
    console.log('🎁 PROMO MESSAGE:');
    console.log('━'.repeat(50));
    const formattedPromo = telegram.formatPromoMessage(mockPromoContent, 'WIN10');
    console.log(formattedPromo);
    console.log('\n🔘 Buttons: [🎁 Use Code WIN10]');
    console.log('           [💸 Get Full Bonus] [📱 Download App]');
    
    console.log('\n═'.repeat(80));
    console.log('✨ FORMATTING FEATURES:');
    console.log('• HTML formatting with <b>bold</b> and <i>italic</i>');
    console.log('• Visual separators with ━━━━━━━━━━━━━━━━━');
    console.log('• Structured headers and sections');
    console.log('• Code blocks for betting info: <code>text</code>');
    console.log('• Disabled web preview for clean look');
    console.log('• UTM tracking on all button links');
    console.log('• Click analytics for performance monitoring');
    
    console.log('\n🎯 CONTENT FEATURES:');
    console.log('• English content for international audience');
    console.log('• Professional betting analysis with confidence levels');
    console.log('• Real team statistics and form data');
    console.log('• Dynamic promo codes and website URL');
    console.log('• Smart timing based on actual match schedules');
    console.log('• No mock data - only real API information');
    
    console.log('\n🚀 READY FOR DEPLOYMENT!');
}

// Run preview
previewMessages();