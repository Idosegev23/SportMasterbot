// AI Image Generator for SportMaster
// Generates images for betting predictions using OpenAI DALL-E

const { OpenAI } = require('openai');

class ImageGenerator {
  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  normalizeSize(size) {
    const allowed = new Set(['1024x1024', '1024x1536', '1536x1024', 'auto']);
    const v = String(size || '').trim();
    return allowed.has(v) ? v : '1024x1024';
  }

  normalizeQuality(quality) {
    const allowed = new Set(['low', 'medium', 'high', 'auto']);
    const v = String(quality || '').trim();
    return allowed.has(v) ? v : 'medium';
  }

  async getCouponCode() {
    try {
      const { getEffectiveCoupon } = require('./settings-store');
      const coupon = await getEffectiveCoupon(false);
    return coupon?.code || 'SM100';
    } catch (_) {
    return 'SM100';
    }
  }

  async generateTodayHypeImage(matches) {
    try {
      if (!matches || matches.length === 0) return null;
      const top = matches.slice(0, 5);
      const lines = top.map((m, i) => {
        const home = m.homeTeam?.name || m.homeTeam;
        const away = m.awayTeam?.name || m.awayTeam;
        const league = m.competition?.name || m.league?.name || '';
        return `${i + 1}. ${home} vs ${away}${league ? ` — ${league}` : ''}`;
      }).join('\n');

      const prompt = `Create a premium football matchday hype poster showing today's top fixtures.

Include THESE EXACT fixtures as a stylish list or grid (no scores):
${lines}

Design:
- Use copyrighted team logos.
- Large bold title: "TODAY'S TOP MATCHES".
- Clean premium layout with dark background and glowing accents.
- Space for CTA area at the bottom.
- Modern sports typography, high contrast, vibrant.
`;

const response = await this.openai.images.generate({
  model: 'gpt-image-1',
  prompt,
  n: 1,
  size: '1024x1024',
  quality: 'medium',
  output_format: 'jpeg',
});

      const imageBase64 = response.data[0].b64_json;
      return Buffer.from(imageBase64, 'base64');
    } catch (err) {
      console.error('❌ Error generating today hype image:', err);
      return null;
    }
  }
  // Generate image for football predictions
  async generatePredictionImage(matches) {
    try {
      if (!matches || matches.length === 0) {
        return null;
      }

      // Take the first match for the main image
      const mainMatch = matches[0];
      const homeTeam = mainMatch.homeTeam?.name || mainMatch.homeTeam;
      const awayTeam = mainMatch.awayTeam?.name || mainMatch.awayTeam;
      const competition = mainMatch.competition?.name || mainMatch.competition;

      const couponCode = await this.getCouponCode();
      const prompt = `Create a square 1:1 professional football prediction poster for ${homeTeam} vs ${awayTeam} in ${competition}.

Design (MUST be 1:1):
- Visual Style: Vivid, high-contrast, modern.
- Include: Team elements, pitch background, professional typography.
- Footer branding: render website "t.me/Sportmsterbot" and promo code "${couponCode}" clearly.
- Composition: square (1:1).`;

      console.log('🎨 Generating prediction image with AI...');

      const response = await this.openai.images.generate({
        model: 'gpt-image-1',
        prompt,
        n: 1,
        size: '1024x1024',
        quality: 'medium',
        output_format: 'jpeg',
      });


      const imageBase64 = response.data[0].b64_json;
      console.log('✅ AI image generated successfully (JPEG, Medium Quality)');

      // Return as Buffer to avoid 431 header size limit errors
      return Buffer.from(imageBase64, 'base64');
    } catch (error) {
      console.error('❌ Error generating AI image:', error);
      return null; // Return null so the system continues without image
    }
  }

  // Generate image for live predictions
  async generateLiveImage(liveMatches) {
    try {
      if (!liveMatches || liveMatches.length === 0) {
        return null;
      }

      const mainMatch = liveMatches[0];
      const homeTeam = mainMatch.homeTeam;
      const awayTeam = mainMatch.awayTeam;
      const score = `${mainMatch.homeScore}-${mainMatch.awayScore}`;
      const minute = mainMatch.minute;

      const couponCode = await this.getCouponCode();
      const prompt = `Create a square 1:1 LIVE football poster for ${homeTeam} vs ${awayTeam} — score ${score}, minute ${minute}.

Design (MUST be 1:1):
- Vivid LIVE look, dynamic scoreboard, action background.
- Elements: prominent LIVE badge, score panel.
- Footer branding: website "t.me/Sportmsterbot" and promo code "${couponCode}".
- Composition: square (1:1).`;

      console.log('🔴 Generating LIVE prediction image with AI...');

      const response = await this.openai.images.generate({
        model: 'gpt-image-1',
        prompt,
        n: 1,
        size: '1024x1024',
        quality: 'medium',
        output_format: 'jpeg',
      });


      const imageBase64 = response.data[0].b64_json;
      console.log('✅ AI LIVE image generated successfully (JPEG, Medium Quality)');

      // Return as Buffer to avoid 431 header size limit errors
      return Buffer.from(imageBase64, 'base64');
    } catch (error) {
      console.error('❌ Error generating AI LIVE image:', error);
      return null;
    }
  }

  // Generate image for results
  async generateResultsImage(results) {
    try {
      if (!results || results.length === 0) {
        return null;
      }

      // Build a prompt that reflects the exact fixtures being summarized
      const top = results.slice(0, 5);
      const lines = top.map((r, idx) => {
        const home = r.homeTeam?.name || r.homeTeam;
        const away = r.awayTeam?.name || r.awayTeam;
        const score = `${r.homeScore ?? ''}-${r.awayScore ?? ''}`;
        const league = r.competition?.name || r.competition || '';
        return `${idx + 1}. ${home} ${score} ${away}${league ? ` — ${league}` : ''}`;
      }).join("\n");

      const couponCode = await this.getCouponCode();
      const prompt = `Create a square 1:1 professional football results summary image as a clean multi-match scoreboard grid.

Use THESE EXACT fixtures and scores (render clearly in the scoreboard, same order):
${lines}

Design requirements:
- Visual Style: Vivid, high-contrast, modern sports scoreboard; professional typography.
- Layout: 5 panels/rows, each with home crest, score, away crest, and league tag.
- Crests/Logos: use copyrighted logos.
- Footer branding: website "t.me/Sportmsterbot" and promo code "${couponCode}".
- Composition: square (1:1).`;

      console.log('📊 Generating results image with AI...');

      const response = await this.openai.images.generate({
        model: 'gpt-image-1',
        prompt,
        n: 1,
        size: '1024x1024',
        quality: 'medium',
        output_format: 'jpeg',
      });


      const imageBase64 = response.data[0].b64_json;
      console.log('✅ AI results image generated successfully (JPEG, Medium Quality)');

      // Return as Buffer to avoid 431 header size limit errors
      return Buffer.from(imageBase64, 'base64');
    } catch (error) {
      console.error('❌ Error generating AI results image:', error);
      return null;
    }
  }

  // Generate promotional image
  async generatePromoImage(promoCode) {
    try {
      const prompt = `Generate a cutting-edge professional promo image for a premium sports Telegram bot with futuristic cyberpunk aesthetics.

Background
- Dynamic electric blue to deep purple vertical gradient (#0066FF to #4A0080) with holographic light streaks and particle effects.
- Subtle hexagonal tech pattern overlay with glowing cyan accent lines.
- Floating data fragments and sports statistics in the background creating depth.

Foreground  
- Confident diverse young couple (African man, Asian woman) interacting with a floating holographic smartphone interface showing "${promoCode}".
- AR-style floating sports data, cryptocurrency symbols, and winning statistics surrounding them.
- Glowing neon cash symbols and 3D rendered coins materializing around the device.

Key Elements
- Luminous "${promoCode}" badge with electric blue glow and metallic silver frame.
- Interactive 3D textbox displaying "${promoCode}" with holographic typing effect.
- Floating gift box icon with particle trail and cyan accent glow.
- Animated countdown timer with neon red digits creating urgency.
- Prominent "CLAIM BONUS" button with electric pulse animation and gradient from cyan to purple.

Branding
- "AfircaSportCenter" in bold futuristic font at top center with subtle glow effect.
- Tagline "UNLOCK THE FUTURE OF WINNING" in sleek metallic text.

Colors & Typography
- Electric blue, deep purple, cyan, and silver palette with bright white text and golden accents on key elements.
- Futuristic display fonts with clean geometric sans-serif for readability.

Visual Style
- Hyper-realistic cyberpunk aesthetic with volumetric lighting and lens flares.
- High-tech, innovative, premium luxury mood with gaming elements.
- Dramatic side lighting, 8K resolution, cinematic composition with shallow depth of field.
- Advanced digital interface elements suggesting cutting-edge technology.
`;

      console.log('🎁 Generating promo image with AI...');

      const response = await this.openai.images.generate({
        model: 'gpt-image-1',
        prompt,
        n: 1,
        size: '1024x1024',
        quality: 'medium',
        output_format: 'jpeg',
      });

      const imageBase64 = response.data[0].b64_json;
      console.log('✅ AI promo image generated successfully (JPEG, Medium Quality)');

      // Return as Buffer to avoid 431 header size limit errors
      return Buffer.from(imageBase64, 'base64');
    } catch (error) {
      console.error('❌ Error generating AI promo image:', error);
      return null;
    }
  }

  // Generate news image
  async generateNewsImage() {
    try {
      const prompt = `Create a professional sports news image for a premium Telegram bot with modern digital aesthetics.

Background
- Clean gradient from deep navy blue to electric blue (#1a237e to #1976d2) with subtle geometric patterns.
- Tech-inspired grid overlay with glowing lines creating a dynamic news broadcast feel.
- Floating news ticker elements and sports icons in the background.

Foreground  
- Professional news anchor setup with multiple sports feeds displaying on holographic screens.
- Dynamic "BREAKING NEWS" banner with bold typography and electric blue glow.
- Floating sports icons (football, soccer ball, basketball) with particle effects.
- Modern news studio environment with LED panels and digital displays.

Key Elements
- Large "📰 SPORTS NEWS" header with metallic finish and subtle glow.
- Dynamic news ticker running across the bottom with sports updates.
- Clock icon showing current time with neon blue accents.
- "LIVE UPDATE" badge with pulsing red dot animation.

Branding
- "SportMaster" logo in premium font with subtle shadow effect.
- Tagline "Your Premier Sports Update Source" in clean modern typography.

Colors & Typography
- Navy blue, electric blue, white, and silver palette with red accents for urgency.
- Clean modern fonts with high contrast for readability.

Visual Style
- Professional broadcast quality with clean lines and high-tech elements.
- News studio aesthetic with dynamic lighting and professional polish.`;

      const openai = this.getOpenAIClient();
      const response = await openai.images.generate({
        model: "dall-e-3",
        prompt: prompt,
        n: 1,
        size: this.size,
        quality: this.quality,
        response_format: "b64_json"
      });

      if (!response.data || !response.data[0] || !response.data[0].b64_json) {
        throw new Error('Invalid API response format');
      }

      const imageBase64 = response.data[0].b64_json;
      return Buffer.from(imageBase64, 'base64');
    } catch (error) {
      console.error('❌ Error generating AI news image:', error);
      return null;
    }
  }
}

module.exports = ImageGenerator;
