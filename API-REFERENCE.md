# API Reference — SportMasterbot

> קובץ עזר לקלוד קוד: מפרט מלא של כל ה-APIs שהפרויקט משתמש בהם.
> עדכון אחרון: מרץ 2026

---

## תוכן עניינים

1. [API-Football v3](#1-api-football-v3)
2. [Google Gemini — יצירת תמונות](#2-google-gemini--יצירת-תמונות)
3. [OpenAI GPT — יצירת תוכן](#3-openai-gpt--יצירת-תוכן)
4. [Supabase — מסד נתונים](#4-supabase--מסד-נתונים)
5. [Telegram Bot API](#5-telegram-bot-api)

---

## 1. API-Football v3

### 1.1 כללי

| פרט | ערך |
|---|---|
| **ספק** | API-Sports (api-football.com) |
| **גרסה** | v3 (3.9.3+) |
| **Base URL (ישיר)** | `https://v3.football.api-sports.io` |
| **Base URL (RapidAPI)** | `https://api-football-v1.p.rapidapi.com/v3` |
| **פרוטוקול** | REST / HTTPS GET בלבד |
| **פורמט תגובה** | JSON |
| **תיעוד רשמי** | https://www.api-football.com/documentation-v3 |

### 1.2 אימות (Authentication)

**מצב ישיר (Direct — מומלץ):**
```
Header: x-apisports-key: YOUR_API_KEY
```

**מצב RapidAPI:**
```
Header: X-RapidAPI-Key: YOUR_RAPID_API_KEY
Header: X-RapidAPI-Host: api-football-v1.p.rapidapi.com
```

**בפרויקט שלנו** (`lib/football-api.js`):
```javascript
getHeaders() {
  return this.isDirect
    ? { 'x-apisports-key': this.apiKey }
    : { 'X-RapidAPI-Key': this.apiKey, 'X-RapidAPI-Host': 'api-football-v1.p.rapidapi.com' };
}
```

Env vars:
- `API_FOOTBALL_KEY` — המפתח הראשי
- `API_FOOTBALL_DIRECT` — `"true"` לגישה ישירה, `"false"` ל-RapidAPI
- `RAPID_API_KEY` — למצב RapidAPI בלבד

### 1.3 Rate Limits & מגבלות

| תוכנית | בקשות/יום | בקשות/דקה |
|---|---|---|
| Free | 100 | 10 |
| Pro (מחיר לפי שימוש) | לפי תוכנית | 300 |

**Response Headers לבדיקת מכסה:**
- `x-ratelimit-requests-limit` — מכסה יומית
- `x-ratelimit-requests-remaining` — נותר ביום
- `X-RateLimit-Limit` — מכסה לדקה
- `X-RateLimit-Remaining` — נותר בדקה

### 1.4 מבנה תגובה כללי (Response Structure)

כל תגובה מ-API-Football מגיעה במבנה הבא:

```json
{
  "get": "fixtures",
  "parameters": { "date": "2026-03-09" },
  "errors": [],
  "results": 42,
  "paging": {
    "current": 1,
    "total": 1
  },
  "response": [
    { /* ... actual data ... */ }
  ]
}
```

| שדה | תיאור |
|---|---|
| `get` | שם ה-endpoint שנקרא |
| `parameters` | הפרמטרים שנשלחו |
| `errors` | מערך שגיאות (ריק = הצלחה) |
| `results` | מספר תוצאות שחזרו |
| `paging` | עמוד נוכחי וסה"כ עמודים |
| `response` | **מערך הנתונים** — זה מה שאנחנו מחלצים |

**בפרויקט שלנו:**
```javascript
const response = await axios.get(`${this.baseUrl}${endpoint}`, { headers, params });
return response.data.response || []; // מחזירים רק את מערך response
```

### 1.5 Fixture Status Codes

קודי סטטוס משחקים — חיוני להבנת הנתונים:

| קוד | שם מלא | תיאור |
|---|---|---|
| `TBD` | Time To Be Defined | שעת המשחק עדיין לא ידועה |
| `NS` | Not Started | טרם התחיל |
| `1H` | First Half | מחצית ראשונה — משחק חי |
| `HT` | Halftime | הפסקה |
| `2H` | Second Half | מחצית שנייה — משחק חי |
| `ET` | Extra Time | הארכה |
| `BT` | Break Time | הפסקה בהארכה |
| `P` | Penalty In Progress | פנדלים |
| `FT` | Match Finished | משחק הסתיים (90 דקות) |
| `AET` | After Extra Time | הסתיים אחרי הארכה |
| `PEN` | After Penalty | הסתיים אחרי פנדלים |
| `PST` | Postponed | נדחה |
| `CANC` | Cancelled | בוטל |
| `ABD` | Abandoned | ננטש |
| `INT` | Interrupted | הופסק |
| `SUSP` | Suspended | מושעה |
| `AWD` | Awarded | ניצחון טכני |
| `WO` | Walkover | Walkover |
| `LIVE` | Live (alias) | כל הסטטוסים החיים: `1H-HT-2H-ET-BT-P-SUSP-INT` |

**קיבוצי סטטוסים שימושיים:**
- משחקים שהסתיימו: `FT-AET-PEN`
- משחקים חיים: `1H-HT-2H-ET-BT-P`
- משחקים עתידיים: `NS-TBD`

---

### 1.6 כל ה-Endpoints — פירוט מלא

---

#### 1.6.1 Timezone

```
GET /timezone
```
**תיאור:** מחזיר רשימה של כל אזורי הזמן הנתמכים. משמש כפרמטר `timezone` ב-fixtures.

**פרמטרים:** אין

**שימוש בפרויקט:** אנחנו משתמשים ב-`Africa/Addis_Ababa` כ-timezone קבוע.

---

#### 1.6.2 Seasons

```
GET /leagues/seasons
```
**תיאור:** מחזיר את כל השנים (seasons) הזמינות ב-API.

**פרמטרים:** אין

**תגובה:** מערך מספרים `[2008, 2009, ..., 2025]`

---

#### 1.6.3 Countries

```
GET /countries
```
**תיאור:** מחזיר רשימת מדינות.

| פרמטר | סוג | חובה | תיאור |
|---|---|---|---|
| `name` | string | לא | שם מדינה (מלא) |
| `code` | string | לא | קוד ISO2 (לדוגמה: `GB`, `ET`) |
| `search` | string | לא | חיפוש חופשי (מינ' 3 תווים) |

---

#### 1.6.4 Leagues

```
GET /leagues
```
**תיאור:** מחזיר מידע על ליגות ותחרויות. **כולל שדה `coverage`** שמראה אילו נתונים זמינים.

| פרמטר | סוג | חובה | תיאור |
|---|---|---|---|
| `id` | integer | לא | מזהה ליגה ספציפי |
| `name` | string | לא | שם ליגה |
| `country` | string | לא | שם מדינה |
| `code` | string | לא | קוד מדינה (ISO2) |
| `season` | integer | לא | שנה (לדוגמה: `2025`) |
| `team` | integer | לא | מזהה קבוצה |
| `type` | string | לא | `league` או `cup` |
| `current` | string | לא | `true` / `false` — עונה נוכחית |
| `search` | string | לא | חיפוש חופשי (מינ' 3 תווים) |
| `last` | integer | לא | X עונות אחרונות |

**שדה Coverage חשוב:**
```json
"coverage": {
  "fixtures": {
    "events": true,
    "lineups": true,
    "statistics_fixtures": true,
    "statistics_players": true
  },
  "standings": true,
  "players": true,
  "top_scorers": true,
  "top_assists": true,
  "top_cards": true,
  "injuries": true,
  "predictions": true,
  "odds": true
}
```
> לפני שמושכים נתונים מליגה, תמיד לבדוק את `coverage` כדי לוודא שהנתונים זמינים.

**ליגות שלנו** (מתוך `leagueScores` ב-`football-api.js`):

| ID | ליגה | Score |
|---|---|---|
| 1 | FIFA World Cup | 150 |
| 2 | Champions League | 150 |
| 6 | AFCON | 130 |
| 39 | Premier League | 130 |
| 140 | La Liga | 125 |
| 135 | Serie A | 120 |
| 4 | Euro Championship | 120 |
| 3 | Europa League | 120 |
| 78 | Bundesliga | 115 |
| 61 | Ligue 1 | 110 |
| 12 | CAF Champions League | 110 |
| 29 | WC Qualifiers (Africa) | 100 |
| 848 | Conference League | 100 |
| 898 | Ethiopian Premier League | 95 |
| 36 | AFCON Qualifiers | 95 |
| 13 | CAF Confederation Cup | 90 |
| 15 | FIFA Club World Cup | 90 |
| 94 | Primeira Liga | 85 |
| 71 | Brazilian Serie A | 85 |
| 45 | FA Cup | 85 |
| 88 | Eredivisie | 80 |
| 11 | Copa Libertadores | 80 |
| 40 | Championship | 75 |
| 48 | EFL Cup | 75 |
| 128 | Argentine Liga | 75 |
| 233 | Egyptian Premier League | 75 |
| 203 | Süper Lig | 70 |
| 288 | South African PL | 70 |
| 14 | Copa Sudamericana | 70 |
| 143 | Copa del Rey | 65 |
| 137 | Coppa Italia | 65 |
| 81 | DFB Pokal | 65 |
| 66 | Coupe de France | 65 |
| 276 | Kenyan PL | 65 |
| 253 | MLS | 60 |
| 307 | Saudi Pro League | 60 |
| 179 | Scottish Premiership | 60 |
| 350 | Tanzanian PL | 55 |
| 332 | Nigerian NPFL | 55 |
| 200 | Moroccan Botola | 55 |
| 144 | Belgian Pro League | 55 |
| 202 | Tunisian Ligue 1 | 50 |

---

#### 1.6.5 Teams

```
GET /teams
```
**תיאור:** מידע על קבוצות.

| פרמטר | סוג | חובה | תיאור |
|---|---|---|---|
| `id` | integer | לא | מזהה קבוצה |
| `name` | string | לא | שם קבוצה |
| `league` | integer | לא | מזהה ליגה |
| `season` | integer | לא | עונה |
| `country` | string | לא | מדינה |
| `code` | string | לא | קוד ISO2 |
| `venue` | integer | לא | מזהה אצטדיון |
| `search` | string | לא | חיפוש (מינ' 3 תווים) |

**תגובה מכילה:**
```json
{
  "team": {
    "id": 33,
    "name": "Manchester United",
    "code": "MUN",
    "country": "England",
    "founded": 1878,
    "national": false,
    "logo": "https://..."
  },
  "venue": {
    "id": 556,
    "name": "Old Trafford",
    "city": "Manchester",
    "capacity": 76212,
    "surface": "grass",
    "image": "https://..."
  }
}
```

---

#### 1.6.6 Teams Statistics

```
GET /teams/statistics
```
**תיאור:** סטטיסטיקות קבוצה בליגה ועונה ספציפיים.

| פרמטר | סוג | חובה | תיאור |
|---|---|---|---|
| `league` | integer | **כן** | מזהה ליגה |
| `season` | integer | **כן** | עונה |
| `team` | integer | **כן** | מזהה קבוצה |
| `date` | string | לא | תאריך (YYYY-MM-DD) |

**כולל:** goals for/against, clean sheets, failed to score, longest streak, form, lineups, cards, penalties...

---

#### 1.6.7 Venues

```
GET /venues
```
**תיאור:** מידע על אצטדיונים.

| פרמטר | סוג | חובה | תיאור |
|---|---|---|---|
| `id` | integer | לא | מזהה אצטדיון |
| `name` | string | לא | שם |
| `city` | string | לא | עיר |
| `country` | string | לא | מדינה |
| `search` | string | לא | חיפוש |

---

#### 1.6.8 Standings (טבלה)

```
GET /standings
```
**תיאור:** טבלת ליגה.

| פרמטר | סוג | חובה | תיאור |
|---|---|---|---|
| `league` | integer | **כן** | מזהה ליגה |
| `season` | integer | **כן** | עונה |
| `team` | integer | לא | קבוצה ספציפית |

**תגובה מכילה:** rank, team, points, goalsDiff, group, form, status, description, all/home/away breakdown (played/win/draw/lose/goals for/against).

**דוגמה:**
```
GET /standings?league=39&season=2025
```

---

#### 1.6.9 Fixtures ⭐ (הכי חשוב!)

```
GET /fixtures
```
**תיאור:** ליבת ה-API — משחקים. **זו הנקודה המרכזית בפרויקט שלנו.**

| פרמטר | סוג | חובה | תיאור |
|---|---|---|---|
| `id` | integer | לא | מזהה משחק ספציפי |
| `ids` | string | לא | מזהים מרובים מופרדים ב-`-` (**מקסימום 20**) |
| `live` | string | לא | `all` — כל המשחקים החיים |
| `date` | string | לא | תאריך YYYY-MM-DD |
| `league` | integer | לא | מזהה ליגה |
| `season` | integer | לא | עונה |
| `team` | integer | לא | מזהה קבוצה |
| `status` | string | לא | קודי סטטוס מופרדים ב-`-` (למשל `FT-AET-PEN`) |
| `timezone` | string | לא | אזור זמן (למשל `Africa/Addis_Ababa`) |
| `from` | string | לא | תאריך התחלה (YYYY-MM-DD) |
| `to` | string | לא | תאריך סיום (YYYY-MM-DD) |
| `round` | string | לא | סיבוב (למשל `Regular Season - 1`) |
| `venue` | integer | לא | מזהה אצטדיון |
| `last` | integer | לא | X משחקים אחרונים |
| `next` | integer | לא | X משחקים הבאים |

**חובה:** לפחות פרמטר אחד חייב להיות מוגדר.

**מבנה תגובה:**
```json
{
  "fixture": {
    "id": 868123,
    "referee": "M. Oliver",
    "timezone": "Africa/Addis_Ababa",
    "date": "2026-03-09T21:00:00+03:00",
    "timestamp": 1773090000,
    "periods": { "first": 1773090000, "second": null },
    "venue": { "id": 556, "name": "Old Trafford", "city": "Manchester" },
    "status": { "long": "Not Started", "short": "NS", "elapsed": null }
  },
  "league": {
    "id": 39,
    "name": "Premier League",
    "country": "England",
    "logo": "https://...",
    "flag": "https://...",
    "season": 2025,
    "round": "Regular Season - 28"
  },
  "teams": {
    "home": { "id": 33, "name": "Manchester United", "logo": "https://...", "winner": null },
    "away": { "id": 40, "name": "Liverpool", "logo": "https://...", "winner": null }
  },
  "goals": { "home": null, "away": null },
  "score": {
    "halftime": { "home": null, "away": null },
    "fulltime": { "home": null, "away": null },
    "extratime": { "home": null, "away": null },
    "penalty": { "home": null, "away": null }
  }
}
```

**איך אנחנו משתמשים בפרויקט:**

```javascript
// משחקי היום — קריאה אחת!
await this.apiCall('/fixtures', { date: '2026-03-09', timezone: 'Africa/Addis_Ababa' });

// תוצאות אתמול
await this.apiCall('/fixtures', { date: '2026-03-08', status: 'FT', timezone: 'Africa/Addis_Ababa' });

// משחקים חיים
await this.apiCall('/fixtures', { live: 'all' });
```

> **חשוב:** אנחנו עושים קריאה אחת בלבד ליום ומסננים לוקלית — זה חוסך API calls!

---

#### 1.6.10 Fixtures — Rounds

```
GET /fixtures/rounds
```
**תיאור:** רשימת סיבובים (rounds) בליגה.

| פרמטר | סוג | חובה | תיאור |
|---|---|---|---|
| `league` | integer | **כן** | מזהה ליגה |
| `season` | integer | **כן** | עונה |
| `current` | boolean | לא | `true` = סיבוב נוכחי בלבד |

---

#### 1.6.11 Fixtures — Head to Head

```
GET /fixtures/headtohead
```
**תיאור:** היסטוריית עימותים בין שתי קבוצות.

| פרמטר | סוג | חובה | תיאור |
|---|---|---|---|
| `h2h` | string | **כן** | `{team1_id}-{team2_id}` |
| `date` | string | לא | תאריך ספציפי |
| `league` | integer | לא | ליגה |
| `season` | integer | לא | עונה |
| `last` | integer | לא | X עימותים אחרונים |
| `from` | string | לא | מתאריך |
| `to` | string | לא | עד תאריך |
| `status` | string | לא | סטטוס |
| `timezone` | string | לא | אזור זמן |
| `venue` | integer | לא | אצטדיון |

**שימוש בפרויקט:**
```javascript
await this.apiCall('/fixtures/headtohead', { h2h: `${teamId1}-${teamId2}`, last: 5 });
```

---

#### 1.6.12 Fixtures — Statistics

```
GET /fixtures/statistics
```
**תיאור:** סטטיסטיקות משחק (חזקות, כדורים, בעיטות וכו').

| פרמטר | סוג | חובה | תיאור |
|---|---|---|---|
| `fixture` | integer | **כן** | מזהה משחק |
| `team` | integer | לא | קבוצה ספציפית |
| `type` | string | לא | סוג סטטיסטיקה ספציפי |

**סוגי סטטיסטיקות:** Shots on Goal, Shots off Goal, Total Shots, Blocked Shots, Shots insidebox, Shots outsidebox, Fouls, Corner Kicks, Offsides, Ball Possession, Yellow Cards, Red Cards, Goalkeeper Saves, Total passes, Passes accurate, Passes %, expected_goals.

---

#### 1.6.13 Fixtures — Events

```
GET /fixtures/events
```
**תיאור:** אירועי משחק (שערים, כרטיסים, החלפות).

| פרמטר | סוג | חובה | תיאור |
|---|---|---|---|
| `fixture` | integer | **כן** | מזהה משחק |
| `team` | integer | לא | קבוצה |
| `player` | integer | לא | שחקן |
| `type` | string | לא | `Goal`, `Card`, `subst`, `Var` |

**מבנה אירוע:**
```json
{
  "time": { "elapsed": 45, "extra": 2 },
  "team": { "id": 33, "name": "Manchester United", "logo": "..." },
  "player": { "id": 123, "name": "M. Rashford" },
  "assist": { "id": 456, "name": "B. Fernandes" },
  "type": "Goal",
  "detail": "Normal Goal",
  "comments": null
}
```

---

#### 1.6.14 Fixtures — Lineups

```
GET /fixtures/lineups
```
**תיאור:** הרכבים וסידור טקטי.

| פרמטר | סוג | חובה | תיאור |
|---|---|---|---|
| `fixture` | integer | **כן** | מזהה משחק |
| `team` | integer | לא | קבוצה |
| `player` | integer | לא | שחקן |
| `type` | string | לא | סוג (למשל `formation`) |

**כולל:** formation, startXI, substitutes, coach

---

#### 1.6.15 Fixtures — Players Statistics

```
GET /fixtures/players
```
**תיאור:** סטטיסטיקות שחקנים במשחק ספציפי.

| פרמטר | סוג | חובה | תיאור |
|---|---|---|---|
| `fixture` | integer | **כן** | מזהה משחק |
| `team` | integer | לא | קבוצה |

---

#### 1.6.16 Injuries

```
GET /injuries
```
**תיאור:** רשימת שחקנים פצועים/מושעים.

| פרמטר | סוג | חובה | תיאור |
|---|---|---|---|
| `league` | integer | לא* | מזהה ליגה |
| `season` | integer | לא* | עונה |
| `fixture` | integer | לא* | מזהה משחק |
| `team` | integer | לא | קבוצה |
| `player` | integer | לא | שחקן |
| `date` | string | לא | תאריך |
| `timezone` | string | לא | אזור זמן |

*חובה: `fixture` או `league+season`

---

#### 1.6.17 Predictions

```
GET /predictions
```
**תיאור:** חיזוי AI מובנה למשחק — כולל אחוזי ניצחון, advice, ותחזית.

| פרמטר | סוג | חובה | תיאור |
|---|---|---|---|
| `fixture` | integer | **כן** | מזהה משחק |

**מבנה תגובה:**
```json
{
  "predictions": {
    "winner": { "id": 33, "name": "Manchester United", "comment": "Win or draw" },
    "win_or_draw": true,
    "under_over": "-3.5",
    "goals": { "home": "-2.5", "away": "-1.5" },
    "advice": "Double chance : Manchester United or draw",
    "percent": { "home": "55%", "draw": "25%", "away": "20%" }
  },
  "league": { ... },
  "teams": {
    "home": { "id": 33, "name": "...", "league": { "form": "WWDLW", "fixtures": {...}, "goals": {...} }, "last_5": {...} },
    "away": { ... }
  },
  "comparison": {
    "form": { "home": "75%", "away": "60%" },
    "att": { "home": "80%", "away": "70%" },
    "def": { "home": "65%", "away": "55%" },
    "poisson_distribution": { ... },
    "h2h": { "home": "60%", "away": "40%" },
    "goals": { "home": "70%", "away": "50%" },
    "total": { "home": "70%", "away": "55%" }
  },
  "h2h": [ ... ]
}
```

> **שימושי מאוד!** ניתן לשלב עם התוכן שנוצר ב-GPT כדי לשפר את איכות התחזיות.

---

#### 1.6.18 Coaches

```
GET /coachs
```
**תיאור:** מידע על מאמנים וקריירה.

| פרמטר | סוג | חובה | תיאור |
|---|---|---|---|
| `id` | integer | לא | מזהה מאמן |
| `team` | integer | לא | קבוצה |
| `search` | string | לא | חיפוש (מינ' 3 תווים) |

---

#### 1.6.19 Players

```
GET /players
```
**תיאור:** סטטיסטיקות שחקנים בעונה.

| פרמטר | סוג | חובה | תיאור |
|---|---|---|---|
| `id` | integer | לא | מזהה שחקן |
| `team` | integer | לא | קבוצה |
| `league` | integer | לא | ליגה |
| `season` | integer | **כן** (לרוב) | עונה |
| `search` | string | לא | חיפוש |
| `page` | integer | לא | עמוד (תוצאות עם pagination) |

---

#### 1.6.20 Players — Seasons

```
GET /players/seasons
```
**תיאור:** רשימת עונות שבהן שיחק שחקן.

| פרמטר | סוג | חובה | תיאור |
|---|---|---|---|
| `player` | integer | לא | מזהה שחקן |

---

#### 1.6.21 Players — Top Scorers

```
GET /players/topscorers
```
| פרמטר | סוג | חובה | תיאור |
|---|---|---|---|
| `league` | integer | **כן** | ליגה |
| `season` | integer | **כן** | עונה |

מחזיר **20** מלכי השערים.

---

#### 1.6.22 Players — Top Assists

```
GET /players/topassists
```
| פרמטר | סוג | חובה | תיאור |
|---|---|---|---|
| `league` | integer | **כן** | ליגה |
| `season` | integer | **כן** | עונה |

---

#### 1.6.23 Players — Top Yellow Cards

```
GET /players/topyellowcards
```
| פרמטר | סוג | חובה | תיאור |
|---|---|---|---|
| `league` | integer | **כן** | ליגה |
| `season` | integer | **כן** | עונה |

---

#### 1.6.24 Players — Top Red Cards

```
GET /players/topredcards
```
| פרמטר | סוג | חובה | תיאור |
|---|---|---|---|
| `league` | integer | **כן** | ליגה |
| `season` | integer | **כן** | עונה |

---

#### 1.6.25 Players — Squads

```
GET /players/squads
```
**תיאור:** סגל שחקנים של קבוצה.

| פרמטר | סוג | חובה | תיאור |
|---|---|---|---|
| `team` | integer | לא* | קבוצה |
| `player` | integer | לא* | שחקן |

*חובה: `team` או `player`

---

#### 1.6.26 Transfers

```
GET /transfers
```
| פרמטר | סוג | חובה | תיאור |
|---|---|---|---|
| `player` | integer | לא* | שחקן |
| `team` | integer | לא* | קבוצה |

*חובה: `player` או `team`

---

#### 1.6.27 Trophies

```
GET /trophies
```
| פרמטר | סוג | חובה | תיאור |
|---|---|---|---|
| `player` | integer | לא* | שחקן |
| `coach` | integer | לא* | מאמן |

*חובה: `player` או `coach`

---

#### 1.6.28 Sidelined

```
GET /sidelined
```
**תיאור:** שחקנים מושבתים (פציעה/השעיה).

| פרמטר | סוג | חובה | תיאור |
|---|---|---|---|
| `player` | integer | לא* | שחקן |
| `coach` | integer | לא* | מאמן |

*חובה: `player` או `coach`

---

#### 1.6.29 Odds (Pre-Match)

```
GET /odds
```
**תיאור:** אודס לפני משחק מבוקמייקרים שונים.

| פרמטר | סוג | חובה | תיאור |
|---|---|---|---|
| `fixture` | integer | לא | מזהה משחק |
| `league` | integer | לא | ליגה |
| `season` | integer | לא | עונה |
| `date` | string | לא | תאריך |
| `timezone` | string | לא | אזור זמן |
| `page` | integer | לא | עמוד (pagination) |
| `bookmaker` | integer | לא | בוקמייקר ספציפי |
| `bet` | integer | לא | סוג הימור ספציפי |

---

#### 1.6.30 Odds — Live (In-Play)

```
GET /odds/live
```
**תיאור:** אודס חיים במהלך משחקים.

| פרמטר | סוג | חובה | תיאור |
|---|---|---|---|
| `fixture` | integer | לא | מזהה משחק |
| `league` | integer | לא | ליגה |
| `bet` | integer | לא | סוג הימור |

---

#### 1.6.31 Odds — Bookmakers

```
GET /odds/bookmakers
```
**תיאור:** רשימת בוקמייקרים הנתמכים.

| פרמטר | סוג | חובה | תיאור |
|---|---|---|---|
| `id` | integer | לא | מזהה בוקמייקר |
| `search` | string | לא | חיפוש |

---

#### 1.6.32 Odds — Bets (Types)

```
GET /odds/bets
```
**תיאור:** רשימת סוגי הימורים זמינים.

| פרמטר | סוג | חובה | תיאור |
|---|---|---|---|
| `id` | integer | לא | מזהה סוג |
| `search` | string | לא | חיפוש |

---

#### 1.6.33 Odds — Mapping

```
GET /odds/mapping
```
**תיאור:** מיפוי בין fixtures ו-odds — עוזר לגלות אילו משחקים יש להם אודס.

| פרמטר | סוג | חובה | תיאור |
|---|---|---|---|
| `page` | integer | לא | עמוד |

---

### 1.7 טיפים לחיסכון ב-API Calls

1. **קריאה אחת ליום** — `/fixtures?date=YYYY-MM-DD` מחזיר את כל המשחקים. סנן client-side.
2. **פרמטר `ids`** — עד 20 fixtures בקריאה אחת עם events, lineups, statistics, players.
3. **בדוק `coverage`** — לא כל הליגות תומכות בכל הנתונים.
4. **Cache** — תוצאות לא משתנות אחרי `FT`. שמור ואל תקרא שוב.
5. **`timezone`** — תמיד לשלוח כדי לקבל שעות מקומיות.
6. **Retry עם delay** — ה-API עלול להחזיר 429. חכה ונסה שוב.

---

## 2. Google Gemini — יצירת תמונות

### 2.1 כללי

| פרט | ערך |
|---|---|
| **ספק** | Google AI (ai.google.dev) |
| **SDK** | `@google/genai` (npm) |
| **מודל נוכחי בפרויקט** | `gemini-3.1-flash-image-preview` |
| **מודלים זמינים** | `gemini-3.1-flash-image-preview`, `gemini-3-pro-image-preview`, `gemini-2.5-flash-image` |
| **Free Tier** | ~500 RPD (requests per day) |
| **תיעוד** | https://ai.google.dev/gemini-api/docs/image-generation |

### 2.2 אתחול

```javascript
const { GoogleGenAI } = require('@google/genai');
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
```

Env vars:
- `GEMINI_API_KEY` — מפתח API
- `GEMINI_IMAGE_MODEL` — (אופציונלי) override למודל ברירת מחדל

### 2.3 יצירת תמונה

```javascript
const response = await ai.models.generateContent({
  model: 'gemini-3.1-flash-image-preview',
  contents: 'Your prompt here',
  config: {
    responseModalities: ['IMAGE'],          // IMAGE בלבד, או ['TEXT', 'IMAGE']
    imageConfig: {
      aspectRatio: '1:1',                   // יחס תמונה
      imageSize: '1K'                       // רזולוציה: "512px", "1K", "2K", "4K"
    }
  }
});

// חילוץ התמונה
for (const part of response.candidates[0].content.parts) {
  if (part.inlineData) {
    const buffer = Buffer.from(part.inlineData.data, 'base64');
    // buffer מוכן לשליחה ל-Telegram
  }
}
```

### 2.4 פרמטרים נתמכים

| פרמטר | ערכים | תיאור |
|---|---|---|
| `responseModalities` | `['IMAGE']`, `['TEXT', 'IMAGE']` | מה לקבל בחזרה |
| `imageConfig.aspectRatio` | `1:1`, `16:9`, `4:3`, `3:2`, `1:4`, `4:1`, `1:8`, `8:1` | יחס תמונה |
| `imageConfig.imageSize` | `512px`, `1K`, `2K`, `4K` | רזולוציה |

### 2.5 יכולות מתקדמות

- **Multi-turn editing** — שיחה רב-שלבית לעריכת תמונות
- **Reference images** — עד 14 תמונות מקור לשליטה בקומפוזיציה
- **Google Search grounding** — הארקת תמונות בנתונים בזמן אמת
- **Text rendering** — רינדור טקסט מתקדם לאינפוגרפיקות
- **SynthID watermark** — סימון אוטומטי בכל תמונה שנוצרת

### 2.6 שימוש בפרויקט

הפרויקט משתמש ב-Gemini עבור 7 סוגי תמונות (`lib/image-generator.js`):

| מתודה | תיאור | Prompt Focus |
|---|---|---|
| `generateTodayHypeImage(matches)` | פוסטר "TODAY'S TOP MATCHES" | רשימת 5 משחקים מובילים |
| `generatePredictionImage(matches)` | פוסטר תחזית למשחק | HOME vs AWAY + competition |
| `generateLiveImage(liveMatches)` | פוסטר משחק חי | תוצאה + דקה + LIVE badge |
| `generateResultsImage(results)` | סיכום תוצאות | 5 תוצאות עליונות |
| `generatePromoImage(promoCode)` | פרסום בונוס | קוד + CLAIM NOW |
| `generateNewsImage(newsItem)` | כותרת חדשות | headline + news ticker |
| `generateAviatorImage(variant, code)` | משחק Aviator | multiplier curve + airplane |

**כל הפרומפטים:**
- מבקשים תמונה ריבועית 1:1
- רקע כהה (navy/black gradient)
- ברנדינג "SportMaster" + "t.me/Sportmsterbot"
- מגנים מסוגננים במקום לוגואים אמיתיים

---

## 3. OpenAI GPT — יצירת תוכן

### 3.1 כללי

| פרט | ערך |
|---|---|
| **מודל** | `gpt-4o-mini` |
| **שימוש** | יצירת תוכן טקסטואלי רב-שפתי |
| **שפות נתמכות** | en, am (אמהרית), sw (סואהילית), fr, ar, pt, es |
| **SDK** | OpenAI Node.js |

Env vars:
- `OPENAI_API_KEY`

### 3.2 שימוש בפרויקט

`ContentGenerator` (`lib/content-generator.js`) מקבל `{ language, timezone, websiteUrl }` ויוצר:
- תחזיות משחקים
- סיכומי תוצאות
- חדשות ספורט
- תוכן פרומו
- תוכן Aviator
- Daily summary

כל התוכן נשלח כ-HTML (parse_mode: HTML) ב-Telegram.

---

## 4. Supabase — מסד נתונים

### 4.1 כללי

| פרט | ערך |
|---|---|
| **טכנולוגיה** | PostgreSQL (managed) |
| **SDK** | `@supabase/supabase-js` |
| **Fallback** | File system (`/tmp/`) |

Env vars:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_KEY`

### 4.2 טבלאות

| טבלה | תיאור |
|---|---|
| `channels` | קונפיגורציה multi-tenant — `channel_id`, `display_name`, `language`, `coupon_code`, `bonus_offer`, `leagues` (JSONB), `timezone`, `buttons` (JSONB) |
| `posts` | לוג תוכן — `channel_id`, `content_type`, `language` |
| `telegram_posts` | מעקב פוסטים מפורט עם metadata |
| `telegram_message_stats` | סטטיסטיקות צפיות/העברות לכל הודעה |

---

## 5. Telegram Bot API

### 5.1 כללי

| פרט | ערך |
|---|---|
| **SDK** | `node-telegram-bot-api` |
| **Parse Mode** | HTML (`<b>`, `<i>`, `<code>`, `<a>`) |
| **Webhook (prod)** | `/api/webhook/telegram` |
| **Polling (dev)** | Local dev mode |

Env vars:
- `TELEGRAM_BOT_TOKEN`
- `CHANNEL_ID` — ערוץ ברירת מחדל
- `ADMIN_USER_IDS` — מזהי אדמין (מופרדים בפסיק)

### 5.2 שיטות שליחה

כל שיטות השליחה ב-`lib/telegram.js` מקבלות `channelConfig` אופציונלי:
- `sendMessage(chatId, text, options, channelConfig)`
- `sendPhoto(chatId, photo, options, channelConfig)` — photo יכול להיות Buffer מ-Gemini
- Inline buttons מתוך `channelConfig.buttons`

---

## 6. נספח — Best Practices לפרויקט

### 6.1 זרימת תוכן (Content Pipeline)

```
1. football-api.js  →  קריאה אחת ל-API-Football (fixtures by date)
2. סינון client-side  →  לפי leagueScores + channelLeagues
3. content-generator.js  →  GPT-4o-mini יוצר טקסט בשפת הערוץ
4. image-generator.js  →  Gemini יוצר תמונה (Buffer או null)
5. telegram.js  →  שליחת HTML + תמונה לערוץ
6. Supabase  →  לוג עם channel_id
```

### 6.2 Multi-Tenant

- **כל cron** מריץ `getActiveChannels()` ולולאה על כל ערוץ
- **כל ערוץ** מקבל תוכן בשפה שלו עם קוד קופון שלו
- **Cache** של 5 דקות לקונפיגורציית ערוצים

### 6.3 אסטרטגיית API-Football

- קריאה אחת בודדת ליום (`/fixtures?date=...`)
- סינון לפי `leagueScores` (threshold 50+)
- דירוג משחקים ב-`calculateMatchScore()` עם בונוסים ל:
  - ליגות top-tier (+50)
  - קבוצות גדולות (+25 כל אחת, +30 אם שתיהן)
  - דרבי (+30)
  - שעות prime time 14-21 (+15)
  - שלבי נוקאאוט (+40)
  - משחקים עתירי שערים (+15)
- בחירת top 5 משחקים
- H2H אופציונלי (קריאות נוספות ל-3 משחקים ראשונים)
