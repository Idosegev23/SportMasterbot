# 🏈 API-Football Setup Guide

## 📋 **הגדרה למנוי ישיר ב-API-Football:**

### **שלב 1: קבלת מפתח API**
1. לך ל-[Dashboard API-Football](https://dashboard.api-football.com/profile?access)
2. התחבר לחשבון שלך
3. העתק את ה-API Key מהדשבורד

### **שלב 2: עדכון משתני סביבה ב-Vercel**
1. לך ל-[Vercel Environment Variables](https://vercel.com/dashboard)
2. בחר את הפרויקט שלך
3. לך ל-Settings > Environment Variables
4. עדכן/הוסף:
   - `API_FOOTBALL_DIRECT` = `true`
   - `API_FOOTBALL_KEY` = **המפתח שלך מהדשבורד**

### **שלב 3: פריסה**
```bash
vercel --prod
```

---

## 🔧 **תכונות מתקדמות:**

### **Rate Limiting Protection** ✅
- המערכת מוסיפה השהיה של 100ms בין בקשות
- טיפול מתקדם בשגיאות HTTP שונות
- החזרה אוטומטית ל-Fallback Data

### **Error Handling** ✅
- **403**: מפתח לא חוקי
- **429**: חריגה ממגבלת בקשות
- **404**: לא נמצאו נתונים
- **500**: שגיאת שרת

### **Supported Leagues** ✅
- Premier League (39)
- La Liga (140)
- Serie A (135)
- Bundesliga (78)
- Ligue 1 (61)
- Champions League (2)

---

## 🧪 **בדיקה:**
```bash
# בדיקת סטטוס המערכת
curl https://your-vercel-url.vercel.app/api/status

# בדיקת predictions ידנית
curl -X POST https://your-vercel-url.vercel.app/api/manual/predictions
```

---

## 📚 **תיעוד נוסף:**
- [API-Football Documentation v3](https://www.api-football.com/documentation-v3)
- [Vercel Environment Variables](https://vercel.com/docs/projects/environment-variables)

---

**💡 טיפ:** אם המערכת עובדת כמו שצריך עם Fallback Data, אין צורך לשנות כלום.