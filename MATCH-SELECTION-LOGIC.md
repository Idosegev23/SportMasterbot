# 🎯 לוגיקת בחירת משחקים - SportMaster Bot

## 📋 סקירה כללית

המערכת בוחרת ומדרגת משחקי כדורגל לתחזיות בהתבסס על מספר קריטריונים: חשיבות הליגה, מוניטין הקבוצות, זמני משחק ומאפיינים מיוחדים (דרבים, גמרים).

---

## 🏗️ ארכיטקטורת בחירת המשחקים

### 🌅 **1. תזמון יומי (Daily Setup) - 6:00 בבוקר**
- **קובץ:** `pages/api/cron/daily-setup.js`
- **תדירות:** יומית ב-6:00 (שעון אתיופיה)
- **תהליך:**
  1. 📊 **עדיפות ראשונה:** `getAllTodayMatchesRanked()` - מביא כל המשחקים ומדרג
  2. 🔄 **Fallback:** `getTodayMatches()` - רק ליגות פופולריות
  3. 💾 **Cache:** שומר Top 5 ב-`/tmp/daily_schedule.json`

### ⏰ **2. בדיקת זמנים (Check Timing) - כל 30 דקות**
- **קובץ:** `pages/api/cron/check-timing.js`
- **תדירות:** כל 30 דקות
- **תהליך:**
  1. קורא את המשחקים השמורים מה-cache
  2. בודק איזה משחקים צריכים תחזיות (2-4 שעות לפני)
  3. שולח תחזיות למשחקים רלוונטיים

---

## 🎯 פונקציות בחירת משחקים

### **A. `getTodayMatches()` - פילטר ליגות פופולריות**
- **מיקום:** `lib/football-api.js:125`
- **אסטרטגיה:** רק ליגות מובחרות
- **ליגות כלולות:** 17 ליגות פופולריות

### **B. `getAllTodayMatchesRanked()` - כל הליגות + דירוג**
- **מיקום:** `lib/football-api.js:451`
- **אסטרטגיה:** 
  - 🌍 מביא משחקים מכל הליגות (לא רק פופולריות)
  - 📊 מדרג לפי `calculateMatchScore()`
  - 🏆 בוחר Top 5

### **C. `selectTop5Matches()` - דירוג וסינון**
- **מיקום:** `lib/football-api.js:429`
- **תהליך:**
  1. מסנן רק משחקים שטרם התחילו (`NS`, `TBD`)
  2. מחשב ציון לכל משחק
  3. ממיין לפי ציון (גבוה לנמוך)
  4. לוקח Top 5

---

## 🏆 מערכת הדירוג (`calculateMatchScore`)

### **📊 נקודות לליגה:**
```
UEFA Champions League: 100 נקודות
Premier League: 90 נקודות  
La Liga: 85 נקודות
Serie A: 80 נקודות
Bundesliga: 75 נקודות
Ligue 1: 70 נקודות
ליגות אחרות: 50 נקודות
```

### **⭐ נקודות לקבוצות:**
```
קבוצה גדולה אחת: +25 נקודות
שתי קבוצות גדולות: +50 נקודות
דרבי קלאסי: +30 נקודות נוספות
```

### **🌟 רשימת קבוצות גדולות:**

#### **🏴󠁧󠁢󠁥󠁮󠁧󠁿 אנגליה (Premier League):**
- Manchester United, Manchester City, Liverpool
- Arsenal, Chelsea, Tottenham

#### **🇪🇸 ספרד (La Liga):**
- Real Madrid, Barcelona
- Atlético Madrid, Sevilla

#### **🇩🇪 גרמניה (Bundesliga):**
- Bayern Munich, Borussia Dortmund
- RB Leipzig, Bayer Leverkusen

#### **🇮🇹 איטליה (Serie A):**
- Juventus, Inter Milan, AC Milan
- Napoli, Roma

#### **🇫🇷 צרפת (Ligue 1):**
- Paris Saint-Germain, Marseille, Lyon

#### **🇳🇱 הולנד (Eredivisie):**
- Ajax, PSV Eindhoven, Feyenoord

#### **🇵🇹 פורטוגל (Primeira Liga):**
- Porto, Benfica, Sporting CP

#### **🏴󠁧󠁢󠁳󠁣󠁴󠁿 סקוטלנד:**
- Celtic, Rangers

#### **🇹🇷 טורקיה (Süper Lig):**
- Galatasaray, Fenerbahçe, Beşiktaş

#### **🇧🇷 ברזיל (Serie A):**
- Flamengo, Palmeiras, Corinthians
- São Paulo, Internacional

#### **🇦🇷 ארגנטינה (Liga Profesional):**
- Boca Juniors, River Plate

#### **🇺🇸 ארה"ב (MLS):**
- LA Galaxy, Inter Miami, NYC FC

#### **🇸🇦 ערב הסעודית (Pro League):**
- Al-Hilal, Al-Nassr

### **🥊 דרבים קלאסיים (+30 נקודות):**
```
Real Madrid vs Atlético Madrid
Barcelona vs Espanyol
Inter Milan vs AC Milan
Manchester United vs Manchester City
Liverpool vs Everton
Celtic vs Rangers
Galatasaray vs Fenerbahçe
Boca Juniors vs River Plate
```

### **⏰ נקודות זמן:**
```
שעות פריים טיים (14:00-21:00): +15 נקודות
```

### **🏅 נקודות שלב:**
```
גמר/חצי גמר/רבע גמר: +40 נקודות
```

---

## 📃 רשימת ליגות פופולריות

### **🎯 Top 17 Popular Leagues:**
```javascript
39   - Premier League (England)
140  - La Liga (Spain)  
135  - Serie A (Italy)
78   - Bundesliga 1 (Germany)
61   - Ligue 1 (France)
2    - UEFA Champions League (Europe)
3    - UEFA Europa League (Europe)
88   - Eredivisie (Netherlands)
94   - Primeira Liga (Portugal)
253  - Major League Soccer (USA/Canada)
203  - Scottish Premiership
201  - Turkish Super Lig
71   - Serie A Brazil
128  - Liga Profesional Argentina
262  - Saudi Pro League
144  - Bundesliga 2 (Germany)
141  - La Liga 2 (Spain)
```

---

## 🔄 זרימת הבחירה בפועל

### **🤖 תחזיות אוטומטיות (Cron Jobs):**
```
1. 06:00 - Daily Setup קובע Top 5 משחקים
2. xx:00 - Check Timing (כל 30 דקות) - בודק מתי לשלוח
3. xx:xx - שליחת תחזיות (2-4 שעות לפני משחק)
```

### **✋ תחזיות ידניות (Manual API):**
```
1. עדיפות ראשונה: Cached matches מהDaily Setup
2. Fallback 1: getAllTodayMatchesRanked() (אם bypassFilters=1)
3. Fallback 2: getTodayMatches() (ליגות פופולריות בלבד)
4. בחירה: המשחק הבא הקרוב ביותר זמנית
```

---

## 📊 דוגמאות לחישוב ציונים

### **🔥 דוגמה 1: משחק גדול**
```
Liverpool vs Manchester City (Premier League, 16:00):
├── ליגה: 90 נקודות (Premier League)
├── קבוצות: 50 נקודות (שתי קבוצות גדולות)  
├── זמן: 15 נקודות (פריים טיים)
└── סה"כ: 155 נקודות ⭐⭐⭐
```

### **⚽ דוגמה 2: משחק בינוני**
```
Real Madrid vs Getafe (La Liga, 22:00):
├── ליגה: 85 נקודות (La Liga)
├── קבוצות: 25 נקודות (רק ריאל גדולה)
├── זמן: 0 נקודות (מאוחר מדי)
└── סה"כ: 110 נקודות ⭐⭐
```

### **🏆 דוגמה 3: דרבי**
```
Real Madrid vs Atlético Madrid (La Liga, 18:00):
├── ליגה: 85 נקודות (La Liga)
├── קבוצות: 50 נקודות (שתי קבוצות גדולות)
├── דרבי: 30 נקודות (דרבי מדריד)
├── זמן: 15 נקודות (פריים טיים)
└── סה"כ: 180 נקודות ⭐⭐⭐⭐
```

### **🥉 דוגמה 4: משחק קטן**
```
Burnley vs Luton Town (Premier League, 12:00):
├── ליגה: 90 נקודות (Premier League)
├── קבוצות: 0 נקודות (אין קבוצות גדולות)
├── זמן: 0 נקודות (לא פריים טיים)
└── סה"כ: 90 נקודות ⭐
```

---

## 🔧 קבצים רלוונטיים

### **🧠 ליבת המערכת:**
- `lib/football-api.js` - לוגיקת API וחישוב ציונים
- `lib/scheduler.js` - ניהול תזמונים ואוטומציה

### **⏰ Cron Jobs:**
- `pages/api/cron/daily-setup.js` - הגדרה יומית
- `pages/api/cron/check-timing.js` - בדיקת זמנים
- `pages/api/cron/hype.js` - שליחת תחזיות יומיות

### **🛠️ APIs ידניים:**
- `pages/api/manual/predictions.js` - תחזיות ידניות
- `pages/api/today-matches.js` - צפייה במשחקי היום

### **💾 ניהול Cache:**
- `lib/storage.js` - שמירה וטעינה של לוח זמנים יומי

---

## 🎯 התוצאה הסופית

המערכת תמיד בוחרת את **5 המשחקים הכי מעניינים לקהל** בהתבסס על:

✅ **ליגות פרסטיז'יות** - Champions League, Top 5 European Leagues  
✅ **קבוצות מפורסמות** - Real Madrid, Barcelona, Manchester United וכו'  
✅ **דרבים קלאסיים** - El Clasico, Manchester Derby, Milan Derby  
✅ **זמנים נוחים** - שעות אחר הצהריים וערב  
✅ **שלבים חשובים** - גמרים, חצי גמרים, רבע גמרים  

**המטרה:** לספק תחזיות על המשחקים שהכי מעניינים את הקהל הרחב!