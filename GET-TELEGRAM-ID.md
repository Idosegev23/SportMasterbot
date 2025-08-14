# 🔑 Get Your Telegram ID - Simple Guide

## 🚨 **PROBLEM: Bot not responding?**

The bot only responds to authorized admin users. You need to add your Telegram User ID to the system.

## 📱 **Step 1: Get Your Telegram ID**

### Method 1: Using @userinfobot
1. Open Telegram
2. Search for `@userinfobot`
3. Send `/start` to the bot
4. Copy your **User ID** (numbers only)

### Method 2: Using @myidbot
1. Open Telegram  
2. Search for `@myidbot`
3. Send `/getid` to the bot
4. Copy your **User ID** (numbers only)

## ⚙️ **Step 2: Add Your ID to Vercel**

### Option A: Via Vercel Dashboard
1. Go to [vercel.com](https://vercel.com)
2. Find your `gize-bot` project
3. Go to **Settings** → **Environment Variables**
4. Add/Edit: `ADMIN_USER_IDS`
5. Value: `your_telegram_id_here`
   - Example: `123456789`
   - Multiple IDs: `123456789,987654321,555666777`

### Option B: Via Local .env (for development)
```env
ADMIN_USER_IDS=123456789,987654321
```

## 🔄 **Step 3: Restart the Bot**

After adding your ID, restart the bot:

### Via UI:
1. Go to: `https://gize-bot.vercel.app/simple-bot`
2. Click **🔄 Restart Bot**

### Via API:
```bash
curl -X POST https://gize-bot.vercel.app/api/simple-bot \
  -H "Content-Type: application/json" \
  -d '{"action": "restart"}'
```

## ✅ **Step 4: Test the Bot**

1. Open Telegram
2. Find `@Sportmsterbot`
3. Send `/start`
4. You should see the main menu with buttons

## 🎯 **Expected Commands (English Only):**

- 🏠 `/start` - Main Menu
- ❓ `/help` - Commands List  
- ⚽ `/predictions` - Send Predictions
- 📊 `/results` - Send Results
- 🎁 `/promo` - Send Promo
- 🔴 `/live` - Live Matches
- 📅 `/today` - Today Games
- 📈 `/status` - System Status

## 🚨 **Still Not Working?**

### Check These:
1. **Correct Bot:** Make sure you're messaging `@Sportmsterbot`
2. **Correct ID:** Double-check your Telegram ID
3. **Bot Running:** Visit `https://gize-bot.vercel.app/simple-bot` - should show "✅ RUNNING"
4. **Environment Variables:** Check Vercel dashboard for `ADMIN_USER_IDS`

### Debug Steps:
1. Clear commands: `https://gize-bot.vercel.app/simple-bot` → **🗑️ Clear Commands**
2. Restart bot: **🔄 Restart Bot**  
3. Wait 30 seconds
4. Try `/start` again

---

## 📝 **Example Setup:**

If your Telegram ID is `123456789`:

**Vercel Environment Variable:**
```
ADMIN_USER_IDS = 123456789
```

**For multiple admins:**
```
ADMIN_USER_IDS = 123456789,987654321,555666777
```

**Test Message:**
Send `/start` to `@Sportmsterbot` - should get English menu with buttons.

---

**🎯 All content is in ENGLISH ONLY as requested!**