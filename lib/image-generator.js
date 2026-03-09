// AI Image Generator for SportMaster
// Uses Google Gemini for image generation (free tier)

const { GoogleGenAI } = require('@google/genai');

class ImageGenerator {
  constructor() {
    this.ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    this.model = process.env.GEMINI_IMAGE_MODEL || 'gemini-3.1-flash-image-preview';
  }

  // Core image generation — returns Buffer or null
  async generate(prompt, { retries = 2, delayMs = 3000 } = {}) {
    if (!process.env.GEMINI_API_KEY) {
      console.log('⚠️ GEMINI_API_KEY not set, skipping image generation');
      return null;
    }

    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        console.log(`🎨 Image generation attempt ${attempt}/${retries}...`);
        const startTime = Date.now();

        const response = await this.ai.models.generateContent({
          model: this.model,
          contents: prompt,
          config: {
            responseModalities: ['IMAGE'],
          },
        });

        // Extract image from response parts
        for (const part of response.candidates[0].content.parts) {
          if (part.inlineData) {
            const buffer = Buffer.from(part.inlineData.data, 'base64');
            const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
            console.log(`✅ Image generated in ${elapsed}s (${(buffer.length / 1024).toFixed(0)}KB)`);
            return buffer;
          }
        }

        console.log('⚠️ No image data in response');
        return null;
      } catch (error) {
        console.error(`❌ Image attempt ${attempt} failed:`, error.message);
        if (attempt < retries) {
          const wait = delayMs * attempt;
          console.log(`⏳ Retrying in ${wait / 1000}s...`);
          await new Promise(r => setTimeout(r, wait));
        }
      }
    }
    return null;
  }

  // Get current coupon code from settings
  async getCouponCode() {
    try {
      const { getEffectiveCoupon } = require('./settings-store');
      const coupon = await getEffectiveCoupon(false);
      return coupon?.code || 'SM100';
    } catch (_) {
      return 'SM100';
    }
  }

  // ─── TODAY'S TOP MATCHES HYPE IMAGE ───
  async generateTodayHypeImage(matches) {
    if (!matches || matches.length === 0) return null;

    const top = matches.slice(0, 5);
    const matchList = top.map((m, i) => {
      const home = m.homeTeam?.name || m.homeTeam;
      const away = m.awayTeam?.name || m.awayTeam;
      const league = m.competition?.name || m.league?.name || '';
      return `${i + 1}. ${home} vs ${away}${league ? ` — ${league}` : ''}`;
    }).join('\n');

    const prompt = `Design a premium sports matchday poster for a Telegram channel called "SportMaster".

FIXTURES (render EXACTLY as text on the poster):
${matchList}

DESIGN:
- Title: "TODAY'S TOP MATCHES" large and bold at top
- Dark premium background (deep navy/black gradient)
- Each fixture on its own line, clean modern typography
- Electric blue and gold accent colors
- Football themed elements (pitch lines, ball silhouette)
- Bottom: "SportMaster" branding and "t.me/Sportmsterbot"
- Square 1:1, professional sports broadcast look
- Use stylized colored shields instead of real logos`;

    return this.generate(prompt);
  }

  // ─── MATCH PREDICTION IMAGE ───
  async generatePredictionImage(matches) {
    if (!matches || matches.length === 0) return null;

    const main = matches[0];
    const home = main.homeTeam?.name || main.homeTeam;
    const away = main.awayTeam?.name || main.awayTeam;
    const comp = main.competition?.name || main.competition;
    const coupon = await this.getCouponCode();

    const prompt = `Design a premium football prediction poster for "${home} vs ${away}" in ${comp}.

DESIGN:
- "MATCH PREDICTION" title at top
- "${home}" and "${away}" names displayed with "VS" between them
- "${comp}" shown below
- Dark background, electric blue and gold accents
- Football pitch elements, dynamic lighting
- Bottom: "SportMaster" and code "${coupon}"
- Square 1:1, sports broadcast style
- Use stylized shields, not real logos`;

    return this.generate(prompt);
  }

  // ─── LIVE MATCH IMAGE ───
  async generateLiveImage(liveMatches) {
    if (!liveMatches || liveMatches.length === 0) return null;

    const m = liveMatches[0];
    const coupon = await this.getCouponCode();

    const prompt = `Design a LIVE football match poster.

MATCH: ${m.homeTeam} ${m.homeScore}-${m.awayScore} ${m.awayTeam} (${m.minute}')

DESIGN:
- Red "LIVE" badge with glow in top corner
- Large scoreboard: "${m.homeTeam} ${m.homeScore} - ${m.awayScore} ${m.awayTeam}"
- Minute: "${m.minute}'"
- Dark background with red/orange dynamic lighting
- Motion blur action elements
- Bottom: "SportMaster" and code "${coupon}"
- Square 1:1, exciting broadcast look`;

    return this.generate(prompt);
  }

  // ─── RESULTS IMAGE ───
  async generateResultsImage(results) {
    if (!results || results.length === 0) return null;

    const top = results.slice(0, 5);
    const lines = top.map((r, i) => {
      const home = r.homeTeam?.name || r.homeTeam;
      const away = r.awayTeam?.name || r.awayTeam;
      return `${i + 1}. ${home} ${r.homeScore ?? '?'}-${r.awayScore ?? '?'} ${away}`;
    }).join('\n');
    const coupon = await this.getCouponCode();

    const prompt = `Design a football results summary poster.

RESULTS (render EXACTLY):
${lines}

DESIGN:
- Title: "MATCH RESULTS" at top
- Clean scoreboard rows, scores highlighted in gold
- Dark background with green/teal accents
- Bottom: "SportMaster" and code "${coupon}"
- Square 1:1, professional scoreboard style`;

    return this.generate(prompt);
  }

  // ─── PROMO IMAGE ───
  async generatePromoImage(promoCode) {
    const prompt = `Design a promotional poster for a sports Telegram channel bonus.

KEY ELEMENTS:
- Headline: "EXCLUSIVE BONUS"
- Code "${promoCode}" in a glowing badge prominently displayed
- "CLAIM NOW" button visual
- Gift/bonus visual elements, football atmosphere

DESIGN:
- Dark gradient (deep blue to purple)
- Gold and electric blue accents
- Premium luxury feel
- Sparkle/glow effects around the code
- Bottom: "SportMaster" and "t.me/Sportmsterbot"
- Square 1:1, eye-catching`;

    return this.generate(prompt);
  }

  // ─── NEWS IMAGE ───
  async generateNewsImage(newsItem = null) {
    const headline = newsItem?.title || 'Sports News Update';

    const prompt = `Design a sports news header image.

HEADLINE: "${headline}"

DESIGN:
- "SPORTS NEWS" banner at top
- Headline text displayed clearly
- Dark background, news broadcast studio look
- Red/white news ticker at bottom
- Football visual elements
- "SportMaster" branding
- Square 1:1, crisp broadcast style`;

    return this.generate(prompt);
  }

  // ─── FALLBACK IMAGE ───
  async generateFallbackImage(type = 'news') {
    const prompts = {
      news: 'Design a "SPORTS NEWS UPDATE" poster with dark background, news ticker, football elements, "SportMaster" branding. Square 1:1.',
      promo: 'Design a "SPECIAL BONUS" poster with dark gradient, gift elements, "SportMaster" branding. Square 1:1.',
    };
    return this.generate(prompts[type] || prompts.news);
  }

  // ─── AVIATOR IMAGE ───
  async generateAviatorImage(variant = 'session', promoCode = 'SM100') {
    const focus = {
      promo: 'promotional feel with bold "Aviator" title',
      tip: 'clean graph with multiplier data',
      session: 'session planning vibe with cockpit HUD',
    };

    const prompt = `Design an Aviator crash game poster.

ELEMENTS:
- Rising multiplier curve x1.00 → x1.50+
- Airplane icon ascending the curve
- "Cash Out" button element
- ${focus[variant] || focus.session}

DESIGN:
- Dark background, neon red and cyan accents
- Futuristic HUD aesthetic
- Code "${promoCode}" in a glowing badge
- "SportMaster" branding at bottom
- Square 1:1, gaming aesthetic, minimal text`;

    return this.generate(prompt);
  }
}

module.exports = ImageGenerator;
