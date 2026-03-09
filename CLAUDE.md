# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

SportMasterbot is a **multi-tenant SaaS** Telegram sports betting bot. One bot token serves multiple Telegram channels, each with its own language, coupon code, league preferences, and analytics. Built with Next.js (Pages Router) and deployed on Vercel.

## Commands

```bash
npm run dev              # Start Next.js dev server (localhost:3000)
npm run build            # Production build
npm start                # Start production server
npm run generate-daily   # CLI script for manual daily content generation
```

No test runner or linter is configured.

## Architecture

### Tech Stack
- **Framework:** Next.js 14 (Pages Router, JavaScript/CommonJS)
- **Bot:** node-telegram-bot-api (polling locally, webhook on Vercel)
- **AI Content:** OpenAI GPT-4o-mini (text generation)
- **AI Images:** Google Gemini (`gemini-3.1-flash-image-preview` via `@google/genai`, free tier ~500 RPD)
- **Database:** Supabase (PostgreSQL) with file-system fallback
- **Sports Data:** API-Football — single API call per query, client-side filtering/ranking
- **Scheduling:** Vercel Crons (production), node-cron (local)
- **Styling:** Tailwind CSS

### Multi-Tenant Architecture
- **channel-config.js** — Manages per-channel settings from Supabase `channels` table
- Each channel has: `channel_id`, `display_name`, `language`, `coupon_code`, `bonus_offer`, `leagues` (JSONB array of API-Football league IDs), `timezone`, `buttons` (JSONB)
- In-memory cache with 5-minute TTL, falls back to `DEFAULT_CHANNEL` when Supabase unavailable
- All cron handlers loop through `getActiveChannels()` and send to each channel independently
- ContentGenerator accepts `{ language, timezone }` — supports en, am (Amharic), sw (Swahili), fr, ar, pt, es
- TelegramManager methods accept optional `channelConfig` parameter for per-channel sending

### Core Modules (`/lib`)
- **channel-config.js** — Multi-channel CRUD and caching (Supabase `channels` table)
- **telegram.js** — Multi-channel message sending with retry/backoff, image support, inline buttons. All send methods accept `channelConfig`
- **football-api.js** — Single API call per query (not one per league). 40+ leagues scored by importance. Methods accept `channelLeagues` array for per-channel filtering
- **content-generator.js** — Multi-language content via OpenAI. Constructor accepts `{ language, timezone, websiteUrl }`
- **image-generator.js** — Gemini image generation (free tier). Methods: generateTodayHypeImage, generatePredictionImage, generateLiveImage, generateResultsImage, generatePromoImage, generateAviatorImage
- **scheduler.js** — SportMasterScheduler: cron orchestration, multi-channel aware. All `executeManual*` methods accept `channelConfig`
- **settings-store.js** — Legacy per-bot settings in `/tmp/bot-settings.json` (buttons, coupon overrides)
- **storage.js** — Dual-layer: Supabase primary, file fallback (`/temp/daily-schedule.json`)
- **lock.js** — TTL-based lock to prevent duplicate sends (default 5min expiry)
- **cooldown.js** — Time-window rate limiting
- **simple-bot-commands.js** — Telegram command handlers (/start, /help, /predictions, etc.)

### Content Pipeline Flow
1. `football-api.js` fetches ALL today's fixtures in one API call, filters by channel's league preferences
2. `content-generator.js` sends match data to GPT-4o-mini with channel's language instruction
3. `image-generator.js` generates image via Gemini (returns Buffer or null)
4. `telegram.js` sends HTML message + image to the channel's `channel_id`
5. Supabase logs include `channel_id` for per-channel analytics

### League Scoring System
Each league has a numeric importance score. Top-tier leagues (Champions League, World Cup, EPL, La Liga, AFCON) score 110-150. African leagues are prominently included: Ethiopian Premier League (898→95), CAF Champions League (12→110), AFCON (6→130). Match scoring adds bonuses for: big teams, derbies, prime time, knockout stages, high-scoring games.

### API Routes (`/pages/api`)
- **Cron handlers** (`/api/cron/`) — All loop through active channels. Includes: daily-setup, hype, news, check-timing, results, promo, summary, live-status, channel-stats
- **Manual triggers** (`/api/manual/`) — predictions, results, promo, bonus, aviator content
- **Webhook** (`/api/webhook/telegram`) — Receives Telegram updates
- **Control** — `/api/start`, `/api/stop`, `/api/status`, `/api/settings`

### Admin Dashboard (`/pages`)
- `/` — Main dashboard
- `/admin` — System control panel
- `/manual` — Manual message sending UI
- `/analytics` — Analytics dashboard

### Vercel Deployment
- **Region:** cle1 (Ohio)
- **Function timeouts:** 30s default, 60s for webhook/manual, 240s for cron jobs
- **Cron schedule** defined in `vercel.json` — all times UTC (code adjusts to Africa/Addis_Ababa)

## Key Environment Variables

```
TELEGRAM_BOT_TOKEN     # From BotFather
CHANNEL_ID             # Default channel (e.g., @africansportdata)
ADMIN_USER_IDS         # Comma-separated Telegram user IDs for admin
OPENAI_API_KEY         # GPT-4o-mini for content generation
GEMINI_API_KEY         # Google Gemini for image generation (free tier)
GEMINI_IMAGE_MODEL     # Optional override (default: gemini-3.1-flash-image-preview)
API_FOOTBALL_KEY       # api-football-v1
API_FOOTBALL_DIRECT    # "true" for direct API, omit for RapidAPI proxy
RAPID_API_KEY          # For RapidAPI proxy mode
SUPABASE_URL           # Supabase project URL
SUPABASE_SERVICE_KEY   # Supabase service role key
CRON_SECRET            # Bearer token for cron authentication
```

## Key Patterns

- **Multi-channel first**: Every cron and manual handler fetches `getActiveChannels()` and loops
- **Telegram messages use HTML parse mode** (`<b>`, `<i>`, `<code>`)
- **Lock-before-send**: Critical sends acquire a lock via `lock.js` to prevent duplicates
- **Cooldown between sends**: Rate limiting via `cooldown.js`
- **Single API call**: `football-api.js` fetches all fixtures for a date in ONE call, filters client-side
- **Channel-specific content**: Each channel gets content in its configured language with its coupon code
- **Image generation is non-blocking**: Falls back to text-only if Gemini fails or times out
- **Backward compat**: `GizeBetsScheduler` alias exists for `SportMasterScheduler`; `ContentGenerator` accepts string arg for websiteUrl

## Supabase Tables

- `channels` — Multi-tenant channel config (see channel-config.js for schema)
- `posts` — Content log with `channel_id`, `content_type`, `language`
- `telegram_posts` — Detailed post tracking with metadata
- `telegram_message_stats` — Per-message view/forward stats
