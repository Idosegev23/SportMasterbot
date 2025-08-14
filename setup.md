# 🚀 GizeBets System - Quick Setup Guide

## ⚡ Fast Setup (5 minutes)

### 1. Environment Setup
```bash
# Copy environment variables
cp .env.example .env

# Edit with your values
nano .env
```

**Required variables:**
```env
TELEGRAM_BOT_TOKEN=1234567890:ABCDEFGHIJKLMNOPQRSTUVWXYZ123456789
CHANNEL_ID=@africansportdata
OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
FOOTBALL_API_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### 2. Install & Run
```bash
# Install dependencies
npm install

# Start development server
npm run dev

# In a new terminal, test the system
node scripts/test-system.js
```

### 3. Start the System
Open http://localhost:3000 and click "🚀 Start System"

---

## 🎯 Quick Commands

### Manual Content Generation
```bash
# Send predictions
curl -X POST http://localhost:3000/api/manual/predictions

# Send results
curl -X POST http://localhost:3000/api/manual/results

# Send promo
curl -X POST http://localhost:3000/api/manual/promo \
  -H "Content-Type: application/json" \
  -d '{"promoType": "football"}'

# Send custom bonus
curl -X POST http://localhost:3000/api/manual/bonus \
  -H "Content-Type: application/json" \
  -d '{"bonusText": "ልዩ ቦናስ! 100% እስከ 1000 ብር!"}'
```

### System Management
```bash
# Check status
curl http://localhost:3000/api/status

# View analytics
curl http://localhost:3000/api/analytics

# Run daily content script
node scripts/daily-content.js predictions
node scripts/daily-content.js results
node scripts/daily-content.js promo
node scripts/daily-content.js all
```

---

## 📱 Telegram Bot Setup

### Bot Details (Already Configured)
- **Bot Name:** SportM@ster
- **Username:** @Sportmsterbot
- **Token:** Already configured in system
- **Channel:** @africansportdata

### Add to Channel
1. Add bot to @africansportdata
2. Make bot admin with permissions:
   - ✅ Post Messages
   - ✅ Edit Messages  
   - ✅ Delete Messages

### Test Connection
```bash
curl http://localhost:3000/api/status
```

---

## 🌐 Deploy to Vercel

### One-Command Deploy
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel --prod
```

### Set Environment Variables in Vercel
Go to Vercel dashboard → Project Settings → Environment Variables:
- `TELEGRAM_BOT_TOKEN`
- `CHANNEL_ID` 
- `OPENAI_API_KEY`
- `FOOTBALL_API_KEY`
- `CRON_SECRET` (any random string)

### Start System After Deploy
```bash
curl -X POST https://your-domain.vercel.app/api/start
```

---

## 🔧 API Keys Setup

### OpenAI API
1. Go to https://platform.openai.com/api-keys
2. Create new secret key
3. Add to `.env` as `OPENAI_API_KEY`

### Football Data API
1. Register at https://www.football-data.org/
2. Get free API key (10 calls/minute)
3. Add to `.env` as `FOOTBALL_API_KEY`

### Alternative: RapidAPI
1. Go to https://rapidapi.com/api-sports/api/api-football
2. Subscribe to free plan
3. Add to `.env` as `RAPID_API_KEY`

---

## ✅ Verification Checklist

- [ ] Telegram bot token is valid
- [ ] Bot is admin in @africansportdata
- [ ] OpenAI API key works
- [ ] Football API key works
- [ ] System status shows "running"
- [ ] Test prediction sent successfully
- [ ] Test promo sent successfully
- [ ] Analytics showing data

---

## 🎮 Daily Usage

The system runs automatically, but you can:

### Dashboard (http://localhost:3000)
- View system status
- Send manual content
- Check analytics
- Monitor performance

### Manual Commands
```bash
# Morning routine
node scripts/daily-content.js predictions

# Evening routine  
node scripts/daily-content.js results

# Promotional campaigns
node scripts/daily-content.js promo
```

---

## 🆘 Troubleshooting

### Bot Not Sending Messages
```bash
# Check bot token
curl "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/getMe"

# Check channel access
curl "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/getChat?chat_id=@africansportdata"
```

### OpenAI Issues
```bash
# Test API key
curl https://api.openai.com/v1/models \
  -H "Authorization: Bearer $OPENAI_API_KEY"
```

### System Status
```bash
# Full system check
node scripts/test-system.js
```

---

## 📞 Support

- 📧 Email: support@gizebets.et
- 💬 Telegram: @gizebetsupport
- 🌐 Website: https://gizebets.et

---

**🎯 Ready to automate your Telegram channel with GizeBets!**