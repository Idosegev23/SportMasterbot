# 🧪 מדריך בדיקת מערכת GizeBets

## 👤 **אדמין טסט מוגדר:**
- **Name:** First Name
- **Telegram ID:** 2024477887
- **Language:** English
- **Access:** ✅ Full Admin Rights

## 🚀 **שלבי הבדיקה:**

### שלב 1: הפעלת המערכת 
```bash
# התקנת תלויות
npm install

# הפעלת שרת הפיתוח
npm run dev
```

**תראה בטרמינל:**
```
✓ Ready in 2.5s
✓ Local:        http://localhost:3000
```

### שלב 2: בדיקת הדשבורד
1. פתח דפדפן: http://localhost:3000
2. תראה את הדשבורד של GizeBets
3. לחץ על **🤖 Bot Commands** בכותרת
4. לחץ על **🚀 Start Bot Commands**
5. וודא שהסטטוס מראה: **✅ Active**

### שלב 3: בדיקת פקודות הבוט בטלגרם

**פתח טלגרם וחפש:** `@Sportmsterbot`

**בדוק הפקודות הבאות:**

#### 🔍 `/help` - רשימת פקודות
```
/help
```
**תוצאה מצופה:** רשימה של כל הפקודות הזמינות

#### 📊 `/status` - סטטוס המערכת  
```
/status
```
**תוצאה מצופה:** מידע על סטטוס המערכת והזמן באתיופיה

#### ⚽ `/predictions` - תחזיות משחקים
```
/predictions
```
**תוצאה מצופה:** 
- הודעה "⚽ Generating match predictions..."
- הודעת אישור עם Message ID
- פרסום בערוץ @gizebetgames

#### 📊 `/results` - תוצאות משחקים
```
/results
```
**תוצאה מצופה:** 
- הודעה "📊 Generating match results..."
- הודעת אישור עם Message ID  
- פרסום בערוץ @gizebetgames

#### 🎁 `/sendpromo football` - פרומו כדורגל
```
/sendpromo football
```
**תוצאה מצופה:**
- הודעה "🎁 Sending promotional message..."
- הודעת אישור עם קטגוריה ו-Message ID
- פרסום בערוץ @gizebetgames

#### 💰 `/sendbonus ALL "Test Bonus"`
```
/sendbonus ALL "🎉 Test Bonus Code WIN100! 💰"
```
**תוצאה מצופה:**
- הודעה "💰 Sending bonus message..."
- הודעת אישור עם התוכן ו-Message ID
- פרסום בערוץ @gizebetgames

## ✅ **רשימת בדיקות:**

- [ ] המערכת עולה ב-http://localhost:3000
- [ ] הדשבורד נטען בהצלחה
- [ ] בוט Commands מתחיל בהצלחה
- [ ] `/help` מחזיר רשימת פקודות
- [ ] `/status` מחזיר סטטוס המערכת
- [ ] `/predictions` שולח תחזיות לערוץ
- [ ] `/results` שולח תוצאות לערוץ
- [ ] `/sendpromo` שולח פרומו לערוץ
- [ ] `/sendbonus` שולח בונוס לערוץ
- [ ] כל ההודעות מגיעות לערוץ @gizebetgames

## 🔧 **במקרה של בעיות:**

### בעיה: "Access denied" 
**פתרון:** וודא שה-ID 2024477887 נמצא בקובץ .env

### בעיה: "Bot not responding"
**פתרון:** 
1. בדוק שהטוקן נכון בקובץ .env
2. וודא ש-Bot Commands הופעל בדשבורד

### בעיה: "Messages not posted to channel"
**פתרון:**
1. וודא ש-@Sportmsterbot הוא מנהל ב-@africansportdata
2. בדוק שיש לו הרשאות Post Messages

## 📈 **מעקב ביצועים:**

בדשבורד תוכל לראות:
- ✅ **System Status:** Running/Stopped
- 📊 **Daily Stats:** כמה הודעות נשלחו היום
- 🕐 **Ethiopian Time:** הזמן הנוכחי באתיופיה
- 📈 **Analytics:** סך הקליקים והביצועים

---

**🎯 המערכת מוכנה לבדיקה עם User ID: 2024477887**