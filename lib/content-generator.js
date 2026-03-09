// Content Generator for SportMaster — Multi-Language SaaS
// Generates dynamic automated posts for any SportMaster channel
// Supports: en, am (Amharic), sw (Swahili), fr, ar, pt, es

const { GoogleGenAI } = require('@google/genai');

// Language instruction map for prompts
const LANG_INSTRUCTIONS = {
  en: { name: 'English', instruction: 'Write ONLY in English.', system: 'You write only in English.' },
  am: { name: 'Amharic', instruction: 'Write ONLY in Amharic (አማርኛ). Use Fidel script, not transliteration.', system: 'You write only in Amharic using Fidel script.' },
  sw: { name: 'Swahili', instruction: 'Write ONLY in Swahili (Kiswahili).', system: 'You write only in Swahili.' },
  fr: { name: 'French', instruction: 'Write ONLY in French.', system: 'You write only in French.' },
  ar: { name: 'Arabic', instruction: 'Write ONLY in Arabic.', system: 'You write only in Arabic.' },
  pt: { name: 'Portuguese', instruction: 'Write ONLY in Portuguese.', system: 'You write only in Portuguese.' },
  es: { name: 'Spanish', instruction: 'Write ONLY in Spanish.', system: 'You write only in Spanish.' },
};

class ContentGenerator {
  /**
   * @param {Object} opts
   * @param {string} opts.language - ISO language code (en, am, sw, fr, ar, pt, es)
   * @param {string} opts.timezone - IANA timezone (default: Africa/Addis_Ababa)
   * @param {string} opts.websiteUrl - Bot URL for footers
   */
  constructor(opts = {}) {
    // Backward compat: if string passed, treat as websiteUrl
    if (typeof opts === 'string') {
      opts = { websiteUrl: opts };
    }
    this.language = opts.language || 'en';
    this.timezone = opts.timezone || 'Africa/Addis_Ababa';
    this.websiteUrl = opts.websiteUrl || 't.me/Sportmsterbot';

    this.lang = LANG_INSTRUCTIONS[this.language] || LANG_INSTRUCTIONS.en;

    this.ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    this.textModel = process.env.GEMINI_TEXT_MODEL || 'gemini-3.1-flash-lite-preview';
  }

  // ─── GEMINI TEXT HELPER ───

  async generateText(systemPrompt, userPrompt, { maxTokens = 300, temperature = 0.7 } = {}) {
    const response = await this.ai.models.generateContent({
      model: this.textModel,
      contents: `${systemPrompt}\n\n${userPrompt}`,
      config: { maxOutputTokens: maxTokens, temperature, tools: [{ googleSearch: {} }] },
    });
    return response.text || '';
  }

  // ─── LANGUAGE HELPERS ───

  get langRule() {
    return `\n\nMANDATORY: ${this.lang.instruction}`;
  }

  get systemLang() {
    return this.lang.system;
  }

  // ─── AVIATOR CONTENT ───

  async generateAviatorQuickTip(promoCode = 'SM100') {
    try {
      const prompt = `You are a concise Aviator (crash) coach for SportMaster Telegram.
Write a VERY SHORT, HIGH-CONVERTING tip (max 5 lines) that feels premium and exciting.
Include:
• Hook line with ✈️ or ⚡
• Bankroll control (short)
• Auto Cash Out target (1.2x–1.5x)
• Optional 2-bet hedge (1 safe + 1 flexible)
• Bold, clean CTA with code ${promoCode}

Formatting:
- Telegram HTML only (<b>, <i>, <code> optional). No markdown symbols
- Use tasteful emojis (✈️⚡🎯💎) and short lines
- No promises/guarantees; actionable tone
${this.langRule}`;

      const system = `Professional Aviator coach. ${this.systemLang} Keep it practical and promotional without guarantees.`;
      const text = await this.generateText(system, prompt, { maxTokens: 160, temperature: 0.6 });

      let content = this.cleanTelegramHTML(text.trim());
      if (!/^\s*<b>.*Aviator/i.test(content)) {
        content = `✈️ <b>Aviator Quick Tip</b>\n\n` + content;
      }
      return content;
    } catch (e) {
      console.error('Error generating Aviator quick tip:', e);
      return `✈️ <b>Aviator Quick Tip</b>\n\n⚡ Keep stakes small and steady\n🎯 Auto Cash Out ~1.3x\n💡 Two-bet hedge: one safe, one flexible\n\n<b>Use code <code>${promoCode}</code></b>`;
    }
  }

  async generateAviatorSessionPlan(promoCode = 'SM100') {
    try {
      const prompt = `You are an Aviator session planner for SportMaster Telegram.
Create a SHORT, HIGH-ENERGY session plan with:
- Bold <b>Title</b> line with ✈️
- 3 bullets:
  • Stakes: (e.g., 0.1–0.3)
  • Auto Cash Out: (e.g., ~1.35x)
  • Goal: quick target or short session (e.g., 15–20 min)
- Close with a bold CTA mentioning code ${promoCode}

Rules:
- Telegram HTML (<b>, <i>, <code>)
- Max ~6 lines total; punchy, clean
- Tasteful emojis allowed; no links; no guarantees
${this.langRule}`;

      const system = `Professional Aviator planner. ${this.systemLang} Keep it short, clear, promotional, no guarantees.`;
      const text = await this.generateText(system, prompt, { maxTokens: 200, temperature: 0.6 });

      let content = this.cleanTelegramHTML(text.trim());
      if (!/^\s*<b>.*Aviator/i.test(content)) {
        content = `✈️ <b>Aviator Session Plan</b>\n` + content;
      }
      return content;
    } catch (e) {
      console.error('Error generating Aviator session plan:', e);
      return `✈️ <b>Aviator Session Plan</b>\n• Stakes: 0.1–0.3\n• Auto Cash Out: ~1.35x\n• Goal: short 15–20 min run\n\n<b>Use code <code>${promoCode}</code></b>`;
    }
  }

  async generateAviatorPromo(promoCode = 'SM100') {
    try {
      const prompt = `You are a marketing expert for SportMaster.
Write a HIGH-CONVERTING Aviator promo in 2–3 SHORT lines.
Tone: premium, energetic, clean.
Must include: bold hook, excitement around fast cash-outs, bold CTA with code ${promoCode}.

Formatting:
- Telegram HTML only (<b>, <i>, <code>), tasteful emojis allowed (✈️⚡🎯💎)
- No links, no guarantees
${this.langRule}`;

      const system = `${this.systemLang} Clean, concise marketing for Aviator. No guarantees.`;
      const text = await this.generateText(system, prompt, { maxTokens: 160, temperature: 0.8 });

      let content = this.cleanTelegramHTML(text.trim());
      content = `✈️ <b>Aviator Promo</b>\n\n` + content.replace(/\n{3,}/g, '\n\n');
      if (!content.includes(promoCode)) {
        content += `\n\n<b>Use code <code>${promoCode}</code></b>`;
      }
      return content;
    } catch (e) {
      console.error('Error generating Aviator promo:', e);
      return `✈️ <b>Aviator Promo</b>\n\n⚡ Fast runs. Clean targets. Smart cash-outs.\n🎯 Start your session now — <b>Use code <code>${promoCode}</code></b>`;
    }
  }

  // ─── HTML HELPERS ───

  toTelegramHTML(text) {
    if (!text) return '';
    let t = String(text);
    t = t.replace(/```[\s\S]*?```/g, (m) => m.replace(/```/g, ''));
    t = t.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
    t = t.replace(/\*(.+?)\*/g, '<i>$1</i>');
    t = t.replace(/_(.+?)_/g, '<i>$1</i>');
    t = t.replace(/`([^`]+)`/g, '<code>$1</code>');
    return t;
  }

  cleanTelegramHTML(text) {
    if (!text) return '';
    let t = String(text);
    t = this.toTelegramHTML(t);

    t = t.replace(/<\/</g, '</');
    t = t.replace(/<\/<\/i>/g, '</i>');
    t = t.replace(/<\/<\/b>/g, '</b>');
    t = t.replace(/<[^>]*<[^>]*>/g, '');
    t = t.replace(/<[^>]*$/, '');
    t = t.replace(/^[^<]*>/, '');

    const openI = (t.match(/<i>/g) || []).length;
    const closeI = (t.match(/<\/i>/g) || []).length;
    for (let i = 0; i < openI - closeI; i++) t += '</i>';

    const openB = (t.match(/<b>/g) || []).length;
    const closeB = (t.match(/<\/b>/g) || []).length;
    for (let i = 0; i < openB - closeB; i++) t += '</b>';

    t = t.replace(/<(?!\/?(?:b|i|u|a|code|pre)[ >])[^>]*>/g, '');
    return t;
  }

  // ─── TODAY'S HYPE ───

  async generateTodayHype(matches, promoCode = 'SM100') {
    try {
      const scored = (matches || []).map(m => ({
        match: m,
        score: Number(m.rankScore || m.popularityScore || 0)
      })).sort((a, b) => b.score - a.score).map(x => x.match);
      const top = scored.slice(0, 5);

      const list = top.map((m, i) => {
        const home = m.homeTeam?.name || m.homeTeam;
        const away = m.awayTeam?.name || m.awayTeam;
        const league = m.competition?.name || m.league?.name || '';
        const timeEt = m.kickoffTime
          ? new Date(m.kickoffTime).toLocaleTimeString('en-US', { timeZone: this.timezone, hour: '2-digit', minute: '2-digit', hour12: true })
          : '';
        return `${i + 1}. ${home} vs ${away}${league ? ` (${league})` : ''}${timeEt ? ` — ${timeEt}` : ''}`;
      }).join('\n');

      const prompt = `You are a professional sports editor for SportMaster Telegram channel.
Write an exciting hype post for today's top matches.
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
- Keep it sharp and energetic
- No extra links (buttons will be attached separately)
- Close with a call-to-action to join the action today
${this.langRule}`;

      const system = `You write concise, high-energy sports hype posts. ${this.systemLang}`;
      const text = await this.generateText(system, prompt, { maxTokens: 220, temperature: 0.7 });

      let content = this.cleanTelegramHTML(text.trim());
      if (!content.toUpperCase().includes("TODAY")) {
        content = `🔥 <b>TODAY'S TOP MATCHES</b>\n\n` + content;
      }
      content += `\n\n💎 Promo_Code: ${promoCode}`;
      return content;
    } catch (error) {
      console.error('Error generating today hype:', error);
      const lines = (matches || []).slice(0, 5).map((m, i) => {
        const home = m.homeTeam?.name || m.homeTeam;
        const away = m.awayTeam?.name || m.awayTeam;
        const league = m.competition?.name || m.league?.name || '';
        const timeEt = m.kickoffTime
          ? new Date(m.kickoffTime).toLocaleTimeString('en-US', { timeZone: this.timezone, hour: '2-digit', minute: '2-digit', hour12: true })
          : '';
        return `${i + 1}. ${home} vs ${away}${league ? ` (${league})` : ''}${timeEt ? ` — ${timeEt}` : ''}`;
      });
      return `🔥 <b>TODAY'S TOP MATCHES</b>\n\n${lines.join('\n')}\n\n💎 Promo_Code: ${promoCode}`;
    }
  }

  // ─── PREDICTIONS ───

  async generateSingleMatchPrediction(match, matchIndex, totalMatches, promoCode = 'SM100') {
    try {
      const hasDetailedData = match.homeTeamData && match.awayTeamData;
      const matchAnalysis = hasDetailedData
        ? this.formatEnhancedMatchData(match)
        : `${match.homeTeam?.name || match.homeTeam} vs ${match.awayTeam?.name || match.awayTeam} - ${match.competition?.name || match.competition} - ${this.formatTime(match.kickoffTime)}`;

      const prompt = `
You are a professional sports betting analyst for SportMaster Telegram channel.

MATCH ANALYSIS:
${matchAnalysis}

Create a SHORT betting prediction with:

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
${this.langRule}`;

      const system = `You are a sports betting analyst. ${this.systemLang} Write VERY SHORT predictions. Maximum 4-5 sentences. One main bet only.`;
      const text = await this.generateText(system, prompt, { maxTokens: 200, temperature: 0.6 });

      let content = this.toTelegramHTML(text.trim());
      const timeStr = this.formatTime(match.kickoffTime);
      const header = `🎯 MATCH ${matchIndex + 1}/${totalMatches} | ⏰ ${timeStr}`;

      if (matchIndex === totalMatches - 1) {
        content += `\n\n💎 Use code: ${promoCode}`;
      }

      return this.toTelegramHTML(`${header}\n${content}`);
    } catch (error) {
      console.error('Error generating single match prediction:', error);
      return this.getFallbackSinglePrediction(match, matchIndex, totalMatches, promoCode);
    }
  }

  async generateTop5Predictions(matches, promoCode = 'SM100') {
    try {
      const predictions = [];
      const totalMatches = Math.min(5, matches.length);
      console.log(`🎯 Generating predictions for ${totalMatches} matches (out of ${matches.length} available)`);

      for (let i = 0; i < totalMatches; i++) {
        const prediction = await this.generateSingleMatchPrediction(matches[i], i, totalMatches, promoCode);
        predictions.push(prediction);
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

  // ─── LIVE PREDICTIONS ───

  async generateLivePredictions(liveMatches, promoCode = 'SM100') {
    try {
      const predictions = [];
      const total = Math.min(3, liveMatches.length);
      console.log(`🔴 Generating live predictions for ${total} matches`);

      for (let i = 0; i < total; i++) {
        const prediction = await this.generateSingleLivePrediction(liveMatches[i], i, total, promoCode);
        predictions.push(prediction);
        if (i < total - 1) await new Promise(r => setTimeout(r, 200));
      }
      return predictions;
    } catch (error) {
      console.error('Error generating live predictions:', error);
      return this.getFallbackLivePredictions(liveMatches, promoCode);
    }
  }

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
${this.langRule}`;

      const system = `You are a live sports betting expert. ${this.systemLang} Focus on in-play betting opportunities. Keep predictions urgent and concise (max 4 lines).`;
      const text = await this.generateText(system, prompt, { maxTokens: 200, temperature: 0.7 });

      let content = this.toTelegramHTML(text.trim());
      const header = `🔴 LIVE MATCH ${matchIndex + 1}/${totalLiveMatches} | ${match.minute}' MIN`;
      const scoreUpdate = `${match.homeTeam} ${match.homeScore}-${match.awayScore} ${match.awayTeam}`;

      if (matchIndex === totalLiveMatches - 1) {
        content += `\n\n⚡ Live code: ${promoCode}`;
      }

      return this.toTelegramHTML(`${header}\n${scoreUpdate}\n${content}`);
    } catch (error) {
      console.error('Error generating single live prediction:', error);
      return this.getFallbackSingleLivePrediction(match, matchIndex, totalLiveMatches, promoCode);
    }
  }

  // ─── LIVE RESULTS ───

  async generateLiveResults(recentResults, promoCode = 'SM100') {
    try {
      if (!recentResults || recentResults.length === 0) {
        return `⚡ <b>LIVE RESULTS UPDATE</b>\n\n📊 No recent results available\n\n🔗 Full Results: ${this.websiteUrl}`;
      }

      const prompt = `
You are a professional sports results analyst for SportMaster Telegram channel.

RECENT MATCH RESULTS:
${recentResults.map(r =>
  `${r.homeTeam} ${r.homeScore}-${r.awayScore} ${r.awayTeam} (${r.competition})`
).join('\n')}

Create an exciting LIVE RESULTS update with:
1. Brief commentary on surprising results or standout performances
2. Key highlights from the matches
3. Any upset results or notable scores
4. Keep it engaging and informative
5. Max 6-7 lines total

Make it feel fresh and immediate!

OUTPUT FORMAT (Telegram HTML):
- Use plain lines, optional <i> for commentary
- No Markdown (** or *) and no external links
${this.langRule}`;

      const system = `You are a sports results expert. ${this.systemLang} Focus on key highlights and surprises. Keep it exciting and brief.`;
      const text = await this.generateText(system, prompt, { maxTokens: 300, temperature: 0.7 });

      let content = this.toTelegramHTML(text.trim());

      const scoredResults = recentResults.map(r => ({
        ...r,
        score: this.calculateResultScore(r)
      })).sort((a, b) => b.score - a.score).slice(0, 5);

      let formatted = `🏆 <b>TOP RESULTS</b>\n\n`;
      scoredResults.forEach(r => {
        formatted += `⚽ <b>${r.homeTeam} ${r.homeScore}-${r.awayScore} ${r.awayTeam}</b>\n`;
      });
      formatted += `\n🔥 ${content.split('.')[0]}.\n\n`;
      formatted += `💎 Code: ${promoCode}`;
      return formatted;
    } catch (error) {
      console.error('Error generating live results:', error);
      return this.getFallbackLiveResults(recentResults, promoCode);
    }
  }

  calculateResultScore(result) {
    let score = 0;
    const leagueScores = {
      'UEFA Champions League': 150, 'Premier League': 130, 'La Liga': 125,
      'Serie A': 120, 'Bundesliga': 115, 'Ligue 1': 110, 'UEFA Europa League': 120,
      'CAF Champions League': 110, 'AFCON': 130, 'Ethiopian Premier League': 95,
    };
    const league = result.league || result.competition || '';
    score += leagueScores[league] || 30;

    const bigTeams = ['Real Madrid', 'Barcelona', 'Manchester City', 'Manchester United',
      'Liverpool', 'Arsenal', 'Chelsea', 'Bayern Munich', 'Paris Saint-Germain',
      'Al Ahly', 'Zamalek', 'Mamelodi Sundowns'];
    if (bigTeams.some(t => (result.homeTeam || '').includes(t))) score += 25;
    if (bigTeams.some(t => (result.awayTeam || '').includes(t))) score += 25;

    const totalGoals = (result.homeScore || 0) + (result.awayScore || 0);
    if (totalGoals >= 4) score += 15;
    return score;
  }

  // ─── LIVE STATUS ───

  async generateLiveStatus(liveMatches, promoCode = 'SM100') {
    try {
      if (!liveMatches || liveMatches.length === 0) {
        return `🔴 <b>LIVE STATUS</b>\n\n📊 No live matches at the moment`;
      }

      const prompt = `
You are a professional live sports commentator for SportMaster Telegram channel.

CURRENT LIVE MATCHES (with detailed stats):
${liveMatches.map(m => {
  const stats = [];
  if (m.homeScore !== undefined && m.awayScore !== undefined) stats.push(`Score: ${m.homeScore}-${m.awayScore}`);
  if (m.minute) stats.push(`${m.minute}'`);
  if (m.status && m.status !== 'LIVE') stats.push(`Status: ${m.status}`);
  if (m.events && m.events.length > 0) {
    const recent = m.events.slice(-2);
    stats.push(`Recent: ${recent.map(e => `${e.type} ${e.player || ''}`.trim()).join(', ')}`);
  }
  return `${m.homeTeam} vs ${m.awayTeam} — ${stats.join(' | ')} (${m.competition || 'Football'})`;
}).join('\n')}

Write a SHORT tactical live update:
1. ONE sharp sentence analyzing the current state (who's dominating, key tactical shift)
2. Maximum 2 lines total
3. Focus on momentum, pressure, tactical changes
4. Be insightful but concise, no hashtags or emojis
${this.langRule}`;

      const system = `You are a live football commentator. ${this.systemLang} Keep the tone energetic and concise.`;
      const text = await this.generateText(system, prompt, { maxTokens: 120, temperature: 0.8 });

      let commentary = this.toTelegramHTML(text.trim());

      let formatted = `🔴 <b>LIVE</b>\n\n`;
      liveMatches.forEach(m => {
        formatted += `⚽ <b>${m.homeTeam} ${m.homeScore || 0}-${m.awayScore || 0} ${m.awayTeam}</b> ${m.minute || '0'}'`;
        if (m.events && m.events.length > 0) {
          const important = m.events.filter(e => e.type === 'Goal' || (e.type === 'Card' && e.detail === 'Red Card'));
          if (important.length > 0) {
            const last = important.slice(-1);
            formatted += ` — ${last.map(e => `${e.type === 'Goal' ? '⚽' : '🟥'} ${e.player || ''}`).join('')}`;
          }
        }
        formatted += '\n';
      });

      if (commentary && commentary.trim().length > 0) {
        formatted += `\n<i>${commentary.trim()}</i>\n`;
      }
      formatted += `\n💎 ${promoCode}`;
      return formatted;
    } catch (error) {
      console.error('Error generating live status:', error);
      return this.getFallbackLiveStatus(liveMatches, promoCode);
    }
  }

  getFallbackLiveStatus(liveMatches, promoCode = 'SM100') {
    if (!liveMatches || liveMatches.length === 0) {
      return `🔴 <b>LIVE</b>\n\n📊 No matches live`;
    }
    let formatted = `🔴 <b>LIVE</b>\n\n`;
    liveMatches.forEach(m => {
      formatted += `⚽ <b>${m.homeTeam} ${m.homeScore || 0}-${m.awayScore || 0} ${m.awayTeam}</b> ${m.minute || '0'}'\n`;
    });
    const hasGoals = liveMatches.some(m => (m.homeScore || 0) > 0 || (m.awayScore || 0) > 0);
    const lateGame = liveMatches.some(m => (m.minute || 0) >= 70);
    if (hasGoals && lateGame) formatted += `\n<i>Final push as teams chase crucial points</i>\n`;
    else if (hasGoals) formatted += `\n<i>Goals change the tactical dynamic</i>\n`;
    else if (lateGame) formatted += `\n<i>Tension builds in the closing stages</i>\n`;
    else formatted += `\n<i>Tactical battle in progress</i>\n`;
    formatted += `\n💎 ${promoCode}`;
    return formatted;
  }

  // ─── DAILY RESULTS ───

  async generateDailyResults(results) {
    try {
      const resultsList = results.map(r =>
        `${r.homeTeam} ${r.homeScore}-${r.awayScore} ${r.awayTeam}`
      ).join('\n');

      const prompt = `
You are a sports results reporter for SportMaster Telegram channel.

Today's Results:
${resultsList}

Create engaging content with:
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
${this.langRule}`;

      const system = `You are a sports results reporter for SportMaster. ${this.systemLang} Your content should be informative and engaging.`;
      const text = await this.generateText(system, prompt, { maxTokens: 800, temperature: 0.6 });

      let content = text.trim();
      content += `\n\n📊 Full Results & Analysis`;
      return content;
    } catch (error) {
      console.error('Error generating results:', error);
      return this.getFallbackResults(results);
    }
  }

  // ─── PROMO ───

  async generatePromoMessage(promoCode = 'SM100', bonusOffer = '100% Bonus') {
    try {
      const prompt = `
You are a creative marketing expert for SportMaster, a Telegram sports hub.

BONUS DETAILS:
- Offer: ${bonusOffer}
- Code: ${promoCode}
- Platform: ${this.websiteUrl}

Create an IRRESISTIBLE promo message that:
1. 🎯 POWERFUL opening that creates instant excitement
2. 💰 Crystal clear bonus value with specific benefits
3. 🚀 Strong urgency without being pushy
4. 📱 Simple 3-step claim process
5. 🔥 Emotional appeal to big winners
6. ✨ Perfect emoji usage (strategic, not spam)
7. 🎲 Written for smart, serious bettors

CRITICAL REQUIREMENTS:
- Write EXACTLY 2-3 SHORT sentences
- Keep it simple and clean
- Include the promo code prominently
- Focus on the bonus value
- Be direct and professional

OUTPUT FORMAT (Telegram HTML):
- No Markdown (** or *)
- Keep plain sentences; optional <b> for the promo code
${this.langRule}`;

      const system = `You are a marketing expert. ${this.systemLang} ABSOLUTE RULE: Output ONLY ${this.lang.name} text. Keep it concise and professional.`;
      const text = await this.generateText(system, prompt, { maxTokens: 600, temperature: 0.8 });

      let content = text.trim();
      if (!content.includes(promoCode)) {
        content += `\n\n🎁 Code: ${promoCode}`;
      }
      return content;
    } catch (error) {
      console.error('Error generating promo:', error);
      return this.getFallbackPromo(promoCode, bonusOffer);
    }
  }

  generateBonusMessage(bonusText) {
    return `🎉 Special Bonus Announcement! 🎉\n\n${bonusText}\n\n⏰ Limited Time Only!\n🔥 Claim Now\n\n💸 Register on our platform\n📱 Start winning today`;
  }

  // ─── FALLBACKS ───

  getFallbackSinglePrediction(match, matchIndex, totalMatches, promoCode = 'SM100') {
    const homeTeam = match.homeTeam?.name || match.homeTeam;
    const awayTeam = match.awayTeam?.name || match.awayTeam;
    const competition = match.competition?.name || match.competition;
    const timeStr = this.formatTime(match.kickoffTime);
    const predictions = ['Over 2.5 Goals', 'Both Teams to Score', 'Home Win', 'Draw', 'Away Win'];
    const header = `🎯 MATCH ${matchIndex + 1}/${totalMatches} | ⏰ ${timeStr}`;
    let content = `⚽ ${homeTeam} vs ${awayTeam}\n🏆 ${competition}\n🎯 ${predictions[matchIndex]} | Confidence: Medium\n💡 Solid betting opportunity`;
    if (matchIndex === totalMatches - 1) content += `\n\n💎 Use code: ${promoCode}`;
    return `${header}\n${content}`;
  }

  getFallbackPredictions(matches, promoCode = 'SM100') {
    if (!matches || matches.length === 0) {
      return [`🎯 TOP BETTING PREDICTIONS\n📊 Premium predictions temporarily unavailable\n💎 Use code: ${promoCode}`];
    }
    const totalMatches = Math.min(5, matches.length);
    return matches.slice(0, totalMatches).map((m, i) => this.getFallbackSinglePrediction(m, i, totalMatches, promoCode));
  }

  getFallbackLivePredictions(liveMatches, promoCode = 'SM100') {
    if (!liveMatches || liveMatches.length === 0) {
      return [`🔴 LIVE BETTING\n📺 No live matches available right now\n⚡ Live code: ${promoCode}`];
    }
    const total = Math.min(3, liveMatches.length);
    return liveMatches.slice(0, total).map((m, i) => this.getFallbackSingleLivePrediction(m, i, total, promoCode));
  }

  getFallbackSingleLivePrediction(match, matchIndex, totalLiveMatches, promoCode = 'LIVE10') {
    const header = `🔴 LIVE MATCH ${matchIndex + 1}/${totalLiveMatches} | ${match.minute}' MIN`;
    const scoreUpdate = `${match.homeTeam} ${match.homeScore}-${match.awayScore} ${match.awayTeam}`;
    let content = `🏆 ${match.competition}\n🎯 Next Goal: Both teams scoring | Confidence: Medium\n⚡ Live betting opportunity!`;
    if (matchIndex === totalLiveMatches - 1) content += `\n\n⚡ Live code: ${promoCode}`;
    return `${header}\n${scoreUpdate}\n${content}`;
  }

  getFallbackLiveResults(recentResults, promoCode = 'SM100') {
    let content = `⚡ <b>LIVE RESULTS UPDATE</b>\n\n`;
    if (recentResults && recentResults.length > 0) {
      recentResults.forEach(r => {
        content += `⚽ <b>${r.homeTeam} ${r.homeScore}-${r.awayScore} ${r.awayTeam}</b>\n`;
        content += `🏆 ${r.competition}\n\n`;
      });
      content += `💬 <i>Great matches with exciting results!</i>\n\n`;
    } else {
      content += `📊 No recent results available at the moment\n\n`;
    }
    content += `🎁 Claim bonus with code: ${promoCode}`;
    return content;
  }

  getFallbackResults(results) {
    let content = '📊 Today\'s Results 📊\n\n';
    results.forEach(r => {
      content += `${r.homeTeam} ${r.homeScore}-${r.awayScore} ${r.awayTeam}\n`;
    });
    content += `\n📊 Check full results on our platform`;
    return content;
  }

  getFallbackPromo(promoCode, bonusOffer) {
    return `🎁 Today's Special Bonus! 🎁\n\nGet ${bonusOffer}!\n\n💰 Code: ${promoCode}\n⏰ Today Only!\n🔥 Claim Now\n\n🔗 Register on our platform`;
  }

  // ─── ENHANCED DATA FORMATTING ───

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

  // ─── UTILITIES ───

  formatTime(date) {
    const dateObj = date instanceof Date ? date : new Date(date);
    const time = dateObj.toLocaleTimeString('en-US', {
      hour: '2-digit', minute: '2-digit', hour12: true,
      timeZone: this.timezone
    });
    return `${time}`;
  }

  formatDate(date) {
    const dateObj = date instanceof Date ? date : new Date(date);
    return dateObj.toLocaleDateString('en-US', {
      year: 'numeric', month: 'long', day: 'numeric',
      timeZone: this.timezone
    });
  }
}

module.exports = ContentGenerator;
