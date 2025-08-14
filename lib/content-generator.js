// Content Generator for SportMaster - ALL CONTENT IN ENGLISH
// Generates dynamic automated posts for the SportMaster Telegram channel

const { OpenAI } = require('openai');

class ContentGenerator {
  constructor(websiteUrl = 't.me/Sportmsterbot') {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
    this.websiteUrl = websiteUrl;
  }

  // Normalize AI output into Telegram HTML (bold/italic/code) and remove markdown leftovers
  toTelegramHTML(text) {
    if (!text) return '';
    let t = String(text);
    // code blocks → inline code (best-effort)
    t = t.replace(/```[\s\S]*?```/g, (m) => m.replace(/```/g, ''));
    // bold and italic markdown → HTML
    t = t.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
    t = t.replace(/\*(.+?)\*/g, '<i>$1</i>');
    t = t.replace(/_(.+?)_/g, '<i>$1</i>'); // underscore italics
    // inline code
    t = t.replace(/`([^`]+)`/g, '<code>$1</code>');
    return t;
  }

    // Clean and validate Telegram HTML tags
  cleanTelegramHTML(text) {
    if (!text) return '';
    let t = String(text);

    // First convert markdown to HTML if needed
    t = this.toTelegramHTML(t);

    // Remove any malformed or broken tags completely
    t = t.replace(/<\/</g, '</'); // Fix "</<" patterns
    t = t.replace(/<\/<\/i>/g, '</i>'); // Fix "</</i>" patterns
    t = t.replace(/<\/<\/b>/g, '</b>'); // Fix "</</b>" patterns
    
    // Remove any tags that are not complete or valid
    t = t.replace(/<[^>]*<[^>]*>/g, ''); // Remove nested incomplete tags
    t = t.replace(/<[^>]*$/, ''); // Remove truncated tags at the end
    t = t.replace(/^[^<]*>/, ''); // Remove orphaned closing tag at start

    // Fix unclosed italic tags
    const openItalic = (t.match(/<i>/g) || []).length;
    const closeItalic = (t.match(/<\/i>/g) || []).length;
    if (openItalic > closeItalic) {
      for (let i = 0; i < (openItalic - closeItalic); i++) {
        t += '</i>';
      }
    }

    // Fix unclosed bold tags
    const openBold = (t.match(/<b>/g) || []).length;
    const closeBold = (t.match(/<\/b>/g) || []).length;
    if (openBold > closeBold) {
      for (let i = 0; i < (openBold - closeBold); i++) {
        t += '</b>';
      }
    }

    // Final cleanup - remove any remaining malformed tags
    t = t.replace(/<(?!\/?[bi]>)[^>]*>/g, ''); // Remove any non-b/i tags
    
    return t;
  }

  // Generate an exciting hype message for today's top matches
  async generateTodayHype(matches, promoCode = 'SM100') {
    try {
      // Sort by ranking score if available (desc), else keep as is
      const scored = (matches || []).map((m) => ({
        match: m,
        score: Number(m.rankScore || m.popularityScore || 0)
      })).sort((a,b)=>b.score-a.score).map(x=>x.match);
      const top = scored.slice(0, 5);

      const list = top.map((m, i) => {
        const home = m.homeTeam?.name || m.homeTeam;
        const away = m.awayTeam?.name || m.awayTeam;
        const league = m.competition?.name || m.league?.name || '';
        const timeEt = m.kickoffTime
          ? new Date(m.kickoffTime).toLocaleTimeString('en-US', { timeZone: 'Africa/Addis_Ababa', hour: '2-digit', minute: '2-digit', hour12: true }) + ' ET'
          : '';
        return `${i + 1}. ${home} vs ${away}${league ? ` (${league})` : ''}${timeEt ? ` — ${timeEt}` : ''}`;
      }).join('\n');

      const prompt = `You are a professional sports editor for SportMaster Telegram channel.
Write an exciting English hype post for today's top matches.
Requirements:
- Bold headline
- 5 bullets, ordered by ranking (already provided order)
- For EACH bullet add a short "Quick take" (5-10 words) about what to expect (form, rivalry, stakes)
- Use provided times
- Energetic, clean, no hashtags

OUTPUT FORMAT (Telegram HTML):
- Use <b> for headline and team lines, and <i> for Quick take
- Use numbered lines (1. 2. 3. ...), no asterisks or markdown
- No Markdown (** or *) at all; only HTML tags supported by Telegram (b, i, u, a, code)

TOP MATCHES:
${list}

Rules:
- English only
- Keep it sharp and energetic
- No extra links (buttons will be attached separately)
- Close with a call-to-action to join the action today`; 

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'You write concise, high-energy sports hype posts in English only.' },
          { role: 'user', content: prompt }
        ],
        max_tokens: 220,
        temperature: 0.7
      });

      let content = response.choices[0].message.content.trim();
      
      // Clean and validate HTML tags
      content = this.cleanTelegramHTML(content);
      
      // Ensure a clean header
      if (!content.toUpperCase().includes("TODAY")) {
        content = `🔥 <b>TODAY'S TOP MATCHES</b>\n\n` + content;
      }
      // Light footer with promo code (text-only; buttons carry links)
      content += `\n\n💎 Promo_Code: ${promoCode}`;
      return content;
    } catch (error) {
      console.error('Error generating today hype:', error);
      // Fallback simple formatter
      const lines = (matches || []).slice(0, 5).map((m, i) => {
        const home = m.homeTeam?.name || m.homeTeam;
        const away = m.awayTeam?.name || m.awayTeam;
        const league = m.competition?.name || m.league?.name || '';
        const timeEt = m.kickoffTime
          ? new Date(m.kickoffTime).toLocaleTimeString('en-US', { timeZone: 'Africa/Addis_Ababa', hour: '2-digit', minute: '2-digit', hour12: true }) + ' ET'
          : '';
        return `${i + 1}. ${home} vs ${away}${league ? ` (${league})` : ''}${timeEt ? ` — ${timeEt}` : ''}`;
      });
      return `🔥 <b>TODAY'S TOP MATCHES</b>\n\n${lines.join('\n')}\n\n💎 Promo_Code: ${promoCode}`;
    }
  }

  // Generate individual match prediction (focused and concise)
  async generateSingleMatchPrediction(match, matchIndex, totalMatches, promoCode = 'SM100') {
    try {
      const hasDetailedData = match.homeTeamData && match.awayTeamData;
      
      let matchAnalysis;
      if (hasDetailedData) {
        matchAnalysis = this.formatEnhancedMatchData(match);
      } else {
        matchAnalysis = `${match.homeTeam?.name || match.homeTeam} vs ${match.awayTeam?.name || match.awayTeam} - ${match.competition?.name || match.competition} - ${this.formatTime(match.kickoffTime)}`;
      }

      const prompt = `
You are a professional sports betting analyst for SportMaster Telegram channel.

MATCH ANALYSIS:
${matchAnalysis}

Create a SHORT English betting prediction with:

🎯 *PRIMARY BET* (1 line with odds and reasoning)

📊 *QUICK ANALYSIS* (2-3 sentences max)
- Team form and key factors only

⚽ *PREDICTION* (1 sentence with score)

CRITICAL REQUIREMENTS:
- Maximum 300 characters total
- 4-5 sentences maximum  
- Focus on ONE main bet only
- Use *bold* for main prediction
- Be concise and direct
`;

      const response = await this.openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system", 
            content: "You are a sports betting analyst. Write VERY SHORT predictions in English. Maximum 4-5 sentences. One main bet only. Be concise and direct."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        max_tokens: 200, // Short content only
        temperature: 0.6
      });

      let content = this.toTelegramHTML(response.choices[0].message.content.trim());
      
      // Add match number and time info - dynamic header based on actual number of matches
      const timeStr = this.formatTime(match.kickoffTime);
      const header = `🎯 MATCH ${matchIndex + 1}/${totalMatches} | ⏰ ${timeStr}`;
      
      // Only add promo on last match to avoid spam
      if (matchIndex === totalMatches - 1) {
        content += `\n\n💎 Use code: ${promoCode}`;
      }
      
      return this.toTelegramHTML(`${header}\n${content}`);

    } catch (error) {
      console.error('Error generating single match prediction:', error);
      return this.getFallbackSinglePrediction(match, matchIndex, totalMatches, promoCode);
    }
  }

  // Generate predictions for available matches - returns array of individual predictions
  async generateTop5Predictions(matches, promoCode = 'SM100') {
    try {
      const predictions = [];
      const totalMatches = Math.min(5, matches.length); // Max 5, but could be less
      
      console.log(`🎯 Generating predictions for ${totalMatches} matches (out of ${matches.length} available)`);
      
      // Generate prediction for each available match individually
      for (let i = 0; i < totalMatches; i++) {
        const prediction = await this.generateSingleMatchPrediction(matches[i], i, totalMatches, promoCode);
        predictions.push(prediction);
        
        // Small delay between AI calls to avoid rate limiting
        if (i < totalMatches - 1) {
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      }
      
      return predictions;

    } catch (error) {
      console.error('Error generating predictions:', error);
      return this.getFallbackPredictions(matches, promoCode);
    }
  }

  // Generate Live Match Predictions - for currently active matches
  async generateLivePredictions(liveMatches, promoCode = 'SM100') {
    try {
      const predictions = [];
      const totalLiveMatches = Math.min(3, liveMatches.length); // Max 3 live predictions
      
      console.log(`🔴 Generating live predictions for ${totalLiveMatches} matches (out of ${liveMatches.length} live)`);
      
      // Generate prediction for each live match individually
      for (let i = 0; i < totalLiveMatches; i++) {
        const match = liveMatches[i];
        const prediction = await this.generateSingleLivePrediction(match, i, totalLiveMatches, promoCode);
        predictions.push(prediction);
        
        // Small delay between AI calls
        if (i < totalLiveMatches - 1) {
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      }
      
      return predictions;

    } catch (error) {
      console.error('Error generating live predictions:', error);
      return this.getFallbackLivePredictions(liveMatches, promoCode);
    }
  }

  // Generate individual live match prediction
  async generateSingleLivePrediction(match, matchIndex, totalLiveMatches, promoCode = 'LIVE10') {
    try {
      const prompt = `
You are a professional live sports betting analyst for SportMaster Telegram channel.

LIVE MATCH ANALYSIS:
${match.homeTeam} ${match.homeScore}-${match.awayScore} ${match.awayTeam}
Status: ${match.status} (${match.minute}' minutes)
Competition: ${match.competition}

Create a LIVE BETTING prediction (max 4 lines) focusing on:
1. In-play betting recommendation based on current score
2. Next goal scorer or final result prediction
3. Brief confidence level and reasoning
4. Quick live analysis

Keep it urgent and exciting for live betting!

OUTPUT FORMAT (Telegram HTML):
- No Markdown (** or *)
- Prefer plain lines; you may use <i> sparingly
- No links; buttons will be attached separately
`;

      const response = await this.openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system", 
            content: "You are a live sports betting expert. Write ONLY in English. Focus on in-play betting opportunities. Keep predictions urgent and concise (max 4 lines)."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        max_tokens: 200,
        temperature: 0.7
      });

      let content = this.toTelegramHTML(response.choices[0].message.content.trim());
      
      // Add live match header - dynamic based on actual number of live matches
      const header = `🔴 LIVE MATCH ${matchIndex + 1}/${totalLiveMatches} | ${match.minute}' MIN`;
      const scoreUpdate = `${match.homeTeam} ${match.homeScore}-${match.awayScore} ${match.awayTeam}`;
      
      // Only add promo on last live match
      if (matchIndex === totalLiveMatches - 1) {
        content += `\n\n⚡ Live code: ${promoCode}`;
      }
      
      return this.toTelegramHTML(`${header}\n${scoreUpdate}\n${content}`);

    } catch (error) {
      console.error('Error generating single live prediction:', error);
      return this.getFallbackSingleLivePrediction(match, matchIndex, totalLiveMatches, promoCode);
    }
  }

  // Fallback live predictions
  getFallbackLivePredictions(liveMatches, promoCode = 'SM100') {
    if (!liveMatches || liveMatches.length === 0) {
      return [`🔴 LIVE BETTING\n📺 No live matches available right now\n⚡ Live code: ${promoCode}`];
    }

    const predictions = [];
    const totalLiveMatches = Math.min(3, liveMatches.length);
    
    liveMatches.slice(0, totalLiveMatches).forEach((match, index) => {
      const prediction = this.getFallbackSingleLivePrediction(match, index, totalLiveMatches, promoCode);
      predictions.push(prediction);
    });
    
    return predictions;
  }

  // Fallback single live prediction
  getFallbackSingleLivePrediction(match, matchIndex, totalLiveMatches, promoCode = 'LIVE10') {
    const header = `🔴 LIVE MATCH ${matchIndex + 1}/${totalLiveMatches} | ${match.minute}' MIN`;
    const scoreUpdate = `${match.homeTeam} ${match.homeScore}-${match.awayScore} ${match.awayTeam}`;
    let content = `🏆 ${match.competition}\n🎯 Next Goal: Both teams scoring | Confidence: Medium\n⚡ Live betting opportunity!`;
    
    // Only add promo on last live match
    if (matchIndex === totalLiveMatches - 1) {
      content += `\n\n⚡ Live code: ${promoCode}`;
    }
    
    return `${header}\n${scoreUpdate}\n${content}`;
  }

  // Format enhanced match data for AI analysis
  formatEnhancedMatchData(match) {
    if (!match.homeTeamData || !match.awayTeamData) {
      return `${match.homeTeam.name} vs ${match.awayTeam.name} - ${match.competition.name}`;
    }

    const homeStats = match.homeTeamData.stats;
    const awayStats = match.awayTeamData.stats;
    const factors = match.predictionFactors;

    return `🏆 ${match.homeTeam.name} vs ${match.awayTeam.name} (${match.competition.name})
⏰ ${this.formatTime(match.kickoffTime)}
🏠 Home Form: ${match.homeTeamData.form} (${homeStats.winPercentage}% wins, ${homeStats.averageGoalsFor} goals/game)
✈️ Away Form: ${match.awayTeamData.form} (${awayStats.winPercentage}% wins, ${awayStats.averageGoalsFor} goals/game)
🆚 H2H: ${factors.h2hTrend} (${match.headToHead.totalMatches} recent matches)
⚽ Expected Goals: ${factors.goalExpectancy}
🎯 Risk Level: ${factors.riskLevel}`;
  }

  // Generate Live Results - for recently finished matches
  async generateLiveResults(recentResults, promoCode = 'SM100') {
    try {
      if (!recentResults || recentResults.length === 0) {
        return `⚡ <b>LIVE RESULTS UPDATE</b>\n\n📊 No recent results available\n\n🔗 Full Results: ${this.websiteUrl}`;
      }

      const prompt = `
You are a professional sports results analyst for SportMaster Telegram channel.

RECENT MATCH RESULTS:
${recentResults.map(result => 
  `${result.homeTeam} ${result.homeScore}-${result.awayScore} ${result.awayTeam} (${result.competition})`
).join('\n')}

Create an exciting LIVE RESULTS update in English with:
1. Brief commentary on surprising results or standout performances
2. Key highlights from the matches
3. Any upset results or notable scores
4. Keep it engaging and informative
5. Max 6-7 lines total

Make it feel fresh and immediate!

OUTPUT FORMAT (Telegram HTML):
- Use plain lines, optional <i> for commentary
- No Markdown (** or *) and no external links
`;

      const response = await this.openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system", 
            content: "You are a sports results expert. Write ONLY in English. Focus on key highlights and surprises from recent results. Keep it exciting and brief."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        max_tokens: 300,
        temperature: 0.7
      });

      let content = this.toTelegramHTML(response.choices[0].message.content.trim());
      
      // Format results with header
      let formattedResults = `⚡ <b>LIVE RESULTS UPDATE</b>\n\n`;
      
      // Add individual results
      recentResults.forEach(result => {
        formattedResults += `⚽ <b>${result.homeTeam} ${result.homeScore}-${result.awayScore} ${result.awayTeam}</b>\n`;
        formattedResults += `🏆 ${result.competition}\n\n`;
      });
      
      // Add AI commentary
      formattedResults += `💬 <i>${content}</i>\n\n`;
      
      // Add footer
      formattedResults += `🎁 Claim bonus with code: ${promoCode}`;
      
      return formattedResults;

    } catch (error) {
      console.error('Error generating live results:', error);
      return this.getFallbackLiveResults(recentResults, promoCode);
    }
  }

  // Generate Live Status - for currently live matches around 60 minutes
  async generateLiveStatus(liveMatches, promoCode = 'SM100') {
    try {
      if (!liveMatches || liveMatches.length === 0) {
return `🔴 <b>LIVE STATUS</b>\n\n📊 No live matches at the moment`;
      }

      const prompt = `
You are a professional live sports commentator for SportMaster Telegram channel.

CURRENT LIVE MATCHES (with minute and score):
${liveMatches.map(m => `${m.homeTeam} ${m.homeScore}-${m.awayScore} ${m.awayTeam} — ${m.minute}' (${m.competition || 'Football'})`).join('\n')}

Write an exciting LIVE STATUS update in English that:
1. Highlights what is happening now in these matches (momentum, pressure, notable events if implied by scoreline)
2. Mentions what has happened so far (comeback, tight defense, goal flurry)
3. Builds hype for the rest of the match
4. Keep it crisp and energetic, maximum 6 lines total
5. No hashtags, no emojis in analysis text
`;

      const response = await this.openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "You are a live football commentator. Write ONLY in English. Keep the tone energetic and concise."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        max_tokens: 260,
        temperature: 0.7
      });

      let commentary = this.toTelegramHTML(response.choices[0].message.content.trim());

      let formatted = `🔴 <b>LIVE STATUS</b>\n\n`;
      liveMatches.forEach(m => {
        const comp = m.competition || 'Football';
        formatted += `⚽ <b>${m.homeTeam} ${m.homeScore}-${m.awayScore} ${m.awayTeam}</b>\n`;
        formatted += `⏱️ ${m.minute}' — 🏆 ${comp}\n\n`;
      });

      formatted += `💬 <i>${commentary}</i>\n\n`;
formatted += `\n💎 Promo_Code: ${promoCode}`;

      return formatted;
    } catch (error) {
      console.error('Error generating live status:', error);
      return this.getFallbackLiveStatus(liveMatches, promoCode);
    }
  }

  getFallbackLiveStatus(liveMatches, promoCode = 'SM100') {
    if (!liveMatches || liveMatches.length === 0) {
return `🔴 <b>LIVE STATUS</b>\n\n📊 No live matches at the moment`;
    }

    let formatted = `🔴 <b>LIVE STATUS</b>\n\n`;
    liveMatches.forEach(m => {
      const comp = m.competition || 'Football';
      formatted += `⚽ <b>${m.homeTeam} ${m.homeScore}-${m.awayScore} ${m.awayTeam}</b>\n`;
      formatted += `⏱️ ${m.minute}' — 🏆 ${comp}\n\n`;
    });
    formatted += `💬 <i>Plenty of action around the hour mark. Momentum swings and big chances expected in the final stretch.</i>\n\n`;
formatted += `\n💎 Promo_Code: ${promoCode}`;

    return formatted;
  }

  // Fallback live results
  getFallbackLiveResults(recentResults, promoCode = 'SM100') {
    let content = `⚡ <b>LIVE RESULTS UPDATE</b>\n\n`;
    
    if (recentResults && recentResults.length > 0) {
      recentResults.forEach(result => {
        content += `⚽ <b>${result.homeTeam} ${result.homeScore}-${result.awayScore} ${result.awayTeam}</b>\n`;
        content += `🏆 ${result.competition}\n\n`;
      });
      
      content += `💬 <i>Great matches with exciting results! Check our analysis for betting insights.</i>\n\n`;
    } else {
      content += `📊 No recent results available at the moment\n\n`;
    }
    
    content += `🎁 Claim bonus with code: ${promoCode}`;
    
    return content;
  }

  // Generate Daily Results in English
  async generateDailyResults(results) {
    try {
      const resultsList = results.map(result => 
        `${result.homeTeam} ${result.homeScore}-${result.awayScore} ${result.awayTeam}`
      ).join('\n');

      const prompt = `
You are a sports results reporter for SportMaster Telegram channel.

Today's Results:
${resultsList}

Create engaging English content with:

1. Present today's match results in an attractive format
2. Brief commentary on key results
3. Highlight outstanding performances or surprise results
4. Mention upcoming matches preview
5. Use engaging emojis
6. Include the website ${this.websiteUrl}

Keep it informative and engaging for sports betting enthusiasts.

OUTPUT FORMAT (Telegram HTML):
- Use <b> for section headers if needed
- No Markdown (** or *)
`;

      const response = await this.openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "You are a sports results reporter for SportMaster. Write ONLY in English. Your content should be informative and engaging for sports enthusiasts."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        max_tokens: 800,
        temperature: 0.6
      });

      let content = response.choices[0].message.content.trim();
      
      // Add footer
      content += `\n\n📊 Full Results & Analysis`;
      
      return content;

    } catch (error) {
      console.error('Error generating results:', error);
      return this.getFallbackResults(results);
    }
  }

  // Generate Daily Promo Message in English
  async generatePromoMessage(promoCode = 'SM100', bonusOffer = '100% Bonus') {
    try {
      const prompt = `
You are a creative marketing expert for SportMaster, a Telegram sports hub.

BONUS DETAILS:
- Offer: ${bonusOffer}
- Code: ${promoCode}
- Platform: ${this.websiteUrl}

Create an IRRESISTIBLE English promo message that:

1. 🎯 POWERFUL opening that creates instant excitement
2. 💰 Crystal clear bonus value with specific benefits
3. 🚀 Strong urgency without being pushy  
4. 📱 Simple 3-step claim process
5. 🔥 Emotional appeal to big winners
6. ✨ Perfect emoji usage (strategic, not spam)
7. 🎲 Written for smart, serious bettors

CRITICAL REQUIREMENTS:
- Write EXACTLY 2-3 SHORT sentences in ENGLISH
- Keep it simple and clean
- Include the promo code prominently
- Focus on the bonus value
- Be direct and professional

CONTENT STYLE:
- Clean and professional
- Simple message about the bonus
- Example: "Get your bonus today! Use code SM100!"

MANDATORY LANGUAGE RULES:
- ENGLISH ONLY
- Simple, clean promotional text
- No excessive emojis or formatting
OUTPUT FORMAT (Telegram HTML):
- No Markdown (** or *)
- Keep plain sentences; optional <b> for the promo code
`;

      const response = await this.openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "You are an ENGLISH marketing expert. ABSOLUTE RULE: Output ONLY English text. Keep it concise and professional."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        max_tokens: 600,
        temperature: 0.8
      });

      let content = response.choices[0].message.content.trim();
      
      // Ensure promo code is included
      if (!content.includes(promoCode)) {
        content += `\n\n🎁 Code: ${promoCode}`;
      }
      
      return content;

    } catch (error) {
      console.error('Error generating promo:', error);
      return this.getFallbackPromo(promoCode, bonusOffer);
    }
  }

  // Generate Custom Bonus Message
  generateBonusMessage(bonusText) {
    return `🎉 Special Bonus Announcement! 🎉

${bonusText}

⏰ Limited Time Only!
🔥 Claim Now

💸 Register on our platform
📱 Start winning today

#SportMaster #Bonus #Win`;
  }

  // Fallback single prediction when AI fails
  getFallbackSinglePrediction(match, matchIndex, totalMatches, promoCode = 'SM100') {
    const homeTeam = match.homeTeam?.name || match.homeTeam;
    const awayTeam = match.awayTeam?.name || match.awayTeam;
    const competition = match.competition?.name || match.competition;
    const timeStr = this.formatTime(match.kickoffTime);
    
    const predictions = ['Over 2.5 Goals', 'Both Teams to Score', 'Home Win', 'Draw', 'Away Win'];
    const header = `🎯 MATCH ${matchIndex + 1}/${totalMatches} | ⏰ ${timeStr}`;
    let content = `⚽ ${homeTeam} vs ${awayTeam}\n🏆 ${competition}\n🎯 ${predictions[matchIndex]} | Confidence: Medium\n💡 Solid betting opportunity`;
    
    // Only add promo on last match
    if (matchIndex === totalMatches - 1) {
      content += `\n\n💎 Use code: ${promoCode}`;
    }
    
    return `${header}\n${content}`;
  }

  // Fallback content when AI fails - returns array
  getFallbackPredictions(matches, promoCode = 'WIN10') {
    if (!matches || matches.length === 0) {
      return [`🎯 TOP BETTING PREDICTIONS\n📊 Premium predictions temporarily unavailable\n💎 Use code: ${promoCode}`];
    }

    const predictions = [];
    const totalMatches = Math.min(5, matches.length);
    
    matches.slice(0, totalMatches).forEach((match, index) => {
      const prediction = this.getFallbackSinglePrediction(match, index, totalMatches, promoCode);
      predictions.push(prediction);
    });
    
    return predictions;
  }

  getFallbackResults(results) {
    let content = '📊 Today\'s Results 📊\n\n';
    
    results.forEach(result => {
      content += `${result.homeTeam} ${result.homeScore}-${result.awayScore} ${result.awayTeam}\n`;
    });
    
    content += `\n📊 Check full results on our platform`;
    return content;
  }

  getFallbackPromo(promoCode, bonusOffer) {
    return `🎁 Today's Special Bonus! 🎁

Get ${bonusOffer}!

💰 Code: ${promoCode}
⏰ Today Only!
🔥 Claim Now

🔗 Register on our platform`;
  }

  // Utility functions
  formatTime(date) {
    // Ensure date is a Date object
    const dateObj = date instanceof Date ? date : new Date(date);
    const time = dateObj.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
      timeZone: 'Africa/Addis_Ababa'
    });
    return `${time} ET`;
  }

  formatDate(date) {
    // Ensure date is a Date object
    const dateObj = date instanceof Date ? date : new Date(date);
    return dateObj.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long', 
      day: 'numeric',
      timeZone: 'Africa/Addis_Ababa'
    });
  }
}

module.exports = ContentGenerator;