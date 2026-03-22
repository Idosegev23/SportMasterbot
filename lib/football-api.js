// Football API Integration for SportMaster
// Primary: football-data.org (free tier) — covers top European leagues + Brazil
// Fallback: API-Football (api-sports.io) if key is valid

const axios = require('axios');

class FootballAPI {
  constructor() {
    // football-data.org (primary — free tier)
    this.fdKey = process.env.FOOTBALL_DATA_KEY;
    this.fdBase = 'https://api.football-data.org/v4';

    // API-Football (fallback)
    this.isDirect = process.env.API_FOOTBALL_DIRECT !== 'false';
    this.afBase = this.isDirect
      ? 'https://v3.football.api-sports.io'
      : 'https://api-football-v1.p.rapidapi.com/v3';
    this.afKey = process.env.API_FOOTBALL_KEY;

    if (!this.fdKey && !this.afKey) {
      console.warn('⚠️ No football API key set — football data will be unavailable');
    }

    // ─── LEAGUE SCORES (higher = more important for ranking) ───
    this.leagueScores = {
      // football-data.org competition IDs
      2001: 150,  // Champions League (CL)
      2146: 120,  // Europa League
      2021: 130,  // Premier League (PL)
      2016: 75,   // Championship (ELC)
      2014: 125,  // La Liga (PD)
      2019: 120,  // Serie A (SA)
      2002: 115,  // Bundesliga (BL1)
      2015: 110,  // Ligue 1 (FL1)
      2017: 85,   // Primeira Liga (PPL)
      2003: 80,   // Eredivisie (DED)
      2013: 85,   // Brazilian Serie A (BSA)
      2000: 150,  // FIFA World Cup (WC)
      2018: 120,  // European Championship (EC)

      // API-Football league IDs (for fallback)
      2: 150, 3: 120, 848: 100,
      39: 130, 40: 75, 45: 85, 48: 75,
      140: 125, 143: 65,
      135: 120, 137: 65,
      78: 115, 81: 65,
      61: 110, 66: 65,
      94: 85, 88: 80, 203: 70, 179: 60, 144: 55,
      // Africa
      898: 95, 12: 110, 13: 90, 6: 130, 36: 95, 29: 100,
      233: 75, 288: 70, 276: 65, 350: 55, 332: 55, 200: 55, 202: 50,
      // South America
      71: 85, 128: 75, 11: 80, 14: 70,
      // Other
      253: 60, 307: 60, 1: 150, 4: 120, 15: 90,
    };

    // Big teams for bonus scoring
    this.bigTeams = new Set([
      'Real Madrid', 'Barcelona', 'FC Barcelona', 'Manchester City', 'Manchester United',
      'Liverpool', 'Arsenal', 'Chelsea', 'Tottenham', 'Tottenham Hotspur',
      'Bayern Munich', 'FC Bayern München', 'Borussia Dortmund', 'Paris Saint-Germain',
      'Juventus', 'AC Milan', 'Inter Milan', 'FC Internazionale Milano', 'Napoli', 'Roma', 'AS Roma',
      'Atletico Madrid', 'Club Atlético de Madrid', 'Sevilla',
      'Ajax', 'PSV', 'Feyenoord',
      'Benfica', 'Porto', 'FC Porto', 'Sporting CP',
      'Celtic', 'Rangers',
      'Galatasaray', 'Fenerbahce', 'Besiktas',
      'Flamengo', 'Palmeiras', 'SE Palmeiras', 'Corinthians', 'Boca Juniors', 'River Plate',
      'Al Hilal', 'Al Nassr', 'Al Ahly', 'Zamalek',
      'Kaizer Chiefs', 'Mamelodi Sundowns', 'Orlando Pirates',
      'Gor Mahia', 'Simba SC', 'Young Africans',
      'St. George', 'Ethiopian Coffee', 'Fasil Kenema',
      'Newcastle', 'Newcastle United FC', 'Aston Villa',
      'Atalanta', 'Lazio', 'SS Lazio',
      'Olympique Lyon', 'AS Monaco', 'Monaco',
    ]);

    // Derby pairs for bonus scoring
    this.derbyPairs = [
      ['Real Madrid', 'Atletico'], ['Real Madrid', 'Barcelona'],
      ['Inter', 'AC Milan'], ['Manchester United', 'Manchester City'],
      ['Liverpool', 'Everton'], ['Arsenal', 'Tottenham'],
      ['Celtic', 'Rangers'], ['Galatasaray', 'Fenerbahce'],
      ['Boca Juniors', 'River Plate'], ['Al Ahly', 'Zamalek'],
      ['Flamengo', 'Corinthians'], ['Bayern', 'Dortmund'],
      ['Feyenoord', 'Ajax'], ['Newcastle', 'Sunderland'],
    ];
  }

  // ─── DATE HELPERS (Ethiopian timezone) ───

  todayStr() {
    return new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Addis_Ababa' });
  }

  yesterdayStr() {
    return new Date(Date.now() - 86400000).toLocaleDateString('en-CA', { timeZone: 'Africa/Addis_Ababa' });
  }

  // ─── football-data.org PROVIDER ───

  async fdCall(endpoint, params = {}, { timeout = 30000 } = {}) {
    const response = await axios.get(`${this.fdBase}${endpoint}`, {
      headers: { 'X-Auth-Token': this.fdKey },
      params,
      timeout,
    });
    return response.data;
  }

  // Normalize football-data.org match → unified format (same shape as API-Football)
  normalizeFdMatch(m) {
    return {
      fixture: {
        id: m.id,
        date: m.utcDate,
        venue: { name: m.venue || 'TBD' },
        status: {
          short: this.mapFdStatus(m.status),
          elapsed: m.minute || null,
        },
      },
      league: {
        id: m.competition?.id,
        name: m.competition?.name,
        logo: m.competition?.emblem,
        round: m.stage === 'REGULAR_SEASON' ? `Matchday ${m.matchday}` : (m.stage || ''),
      },
      teams: {
        home: { id: m.homeTeam?.id, name: m.homeTeam?.shortName || m.homeTeam?.name, logo: m.homeTeam?.crest },
        away: { id: m.awayTeam?.id, name: m.awayTeam?.shortName || m.awayTeam?.name, logo: m.awayTeam?.crest },
      },
      goals: {
        home: m.score?.fullTime?.home,
        away: m.score?.fullTime?.away,
      },
      events: [],
    };
  }

  mapFdStatus(status) {
    const map = {
      SCHEDULED: 'NS', TIMED: 'NS', POSTPONED: 'PST', CANCELLED: 'CANC',
      IN_PLAY: 'LIVE', PAUSED: 'HT', FINISHED: 'FT', SUSPENDED: 'SUSP',
      AWARDED: 'FT',
    };
    return map[status] || status;
  }

  // ─── API-Football PROVIDER (fallback) ───

  getAfHeaders() {
    return this.isDirect
      ? { 'x-apisports-key': this.afKey }
      : { 'X-RapidAPI-Key': this.afKey, 'X-RapidAPI-Host': 'api-football-v1.p.rapidapi.com' };
  }

  async afCall(endpoint, params, { timeout = 30000 } = {}) {
    if (!this.afKey) throw new Error('API_FOOTBALL_KEY not configured');
    const response = await axios.get(`${this.afBase}${endpoint}`, {
      headers: this.getAfHeaders(),
      params,
      timeout,
    });
    return response.data.response || [];
  }

  // ─── RETRY HELPER ───

  async retryCall(fn, maxRetries = 2, baseDelay = 2000) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        console.log(`❌ API attempt ${attempt}/${maxRetries} failed:`, error.message);
        if (attempt === maxRetries) throw error;
        await new Promise(r => setTimeout(r, baseDelay * attempt));
      }
    }
  }

  // ─── MAIN DATA METHODS ───

  async getTodayMatches(channelLeagues = []) {
    const today = this.todayStr();
    // Also fetch tomorrow to cover timezone edge cases
    const tomorrow = new Date(Date.now() + 86400000).toLocaleDateString('en-CA', { timeZone: 'Africa/Addis_Ababa' });
    console.log(`⚽ Fetching ALL matches for ${today} (single API call)...`);

    let fixtures = [];

    // Try football-data.org first
    if (this.fdKey) {
      try {
        const data = await this.retryCall(() =>
          this.fdCall('/matches', { dateFrom: today, dateTo: today })
        );
        fixtures = (data.matches || []).map(m => this.normalizeFdMatch(m));
        console.log(`📊 [football-data.org] Got ${fixtures.length} total fixtures`);
      } catch (err) {
        console.log(`⚠️ football-data.org failed: ${err.message}`);
      }
    }

    // Fallback to API-Football
    if (fixtures.length === 0 && this.afKey) {
      try {
        fixtures = await this.retryCall(() =>
          this.afCall('/fixtures', { date: today, timezone: 'Africa/Addis_Ababa' })
        );
        console.log(`📊 [API-Football] Got ${fixtures.length} total fixtures`);
      } catch (err) {
        console.log(`⚠️ API-Football also failed: ${err.message}`);
      }
    }

    if (fixtures.length === 0) return [];

    const quality = this.filterQualityMatches(fixtures, channelLeagues);
    console.log(`🔍 ${quality.length} matches from quality leagues`);

    return this.selectTopMatches(quality, 5);
  }

  async getYesterdayResults(channelLeagues = []) {
    const yesterday = this.yesterdayStr();
    console.log(`📊 Fetching results for ${yesterday} (single API call)...`);

    let fixtures = [];

    if (this.fdKey) {
      try {
        const data = await this.retryCall(() =>
          this.fdCall('/matches', { dateFrom: yesterday, dateTo: yesterday, status: 'FINISHED' })
        );
        fixtures = (data.matches || []).map(m => this.normalizeFdMatch(m));
        console.log(`📊 [football-data.org] Got ${fixtures.length} finished fixtures`);
      } catch (err) {
        console.log(`⚠️ football-data.org failed: ${err.message}`);
      }
    }

    if (fixtures.length === 0 && this.afKey) {
      try {
        fixtures = await this.retryCall(() =>
          this.afCall('/fixtures', { date: yesterday, status: 'FT', timezone: 'Africa/Addis_Ababa' })
        );
        console.log(`📊 [API-Football] Got ${fixtures.length} finished fixtures`);
      } catch (err) {
        console.log(`⚠️ API-Football also failed: ${err.message}`);
      }
    }

    if (fixtures.length === 0) return [];

    const quality = this.filterQualityMatches(fixtures, channelLeagues);
    return quality
      .sort((a, b) => this.calculateMatchScore(b) - this.calculateMatchScore(a))
      .slice(0, 5)
      .map(m => this.processResults([m])[0])
      .filter(Boolean);
  }

  async getLiveMatches(channelLeagues = []) {
    console.log('🔴 Fetching live matches...');

    let fixtures = [];

    if (this.fdKey) {
      try {
        const data = await this.retryCall(() =>
          this.fdCall('/matches', { status: 'LIVE,IN_PLAY,PAUSED' })
        );
        fixtures = (data.matches || []).map(m => this.normalizeFdMatch(m));
        console.log(`🔴 [football-data.org] ${fixtures.length} live fixtures`);
      } catch (err) {
        console.log(`⚠️ football-data.org live failed: ${err.message}`);
      }
    }

    if (fixtures.length === 0 && this.afKey) {
      try {
        fixtures = await this.retryCall(() =>
          this.afCall('/fixtures', { live: 'all' })
        );
        console.log(`🔴 [API-Football] ${fixtures.length} live fixtures`);
      } catch (err) {
        console.log(`⚠️ API-Football live also failed: ${err.message}`);
      }
    }

    if (fixtures.length === 0) return [];

    const quality = this.filterQualityMatches(fixtures, channelLeagues);
    return quality
      .sort((a, b) => this.calculateMatchScore(b) - this.calculateMatchScore(a))
      .slice(0, 5)
      .map(m => ({
        homeTeam: m.teams.home.name,
        awayTeam: m.teams.away.name,
        homeScore: m.goals.home ?? 0,
        awayScore: m.goals.away ?? 0,
        minute: m.fixture.status.elapsed || 0,
        status: m.fixture.status.short,
        competition: m.league.name,
        leagueId: m.league.id,
        events: m.events || [],
      }));
  }

  async getUpcomingMatches(channelLeagues = []) {
    const matches = await this.getTodayMatches(channelLeagues);
    const now = Date.now();
    return matches.filter(m => {
      const hours = (new Date(m.kickoffTime) - now) / 3600000;
      return hours > 0.5 && hours < 4;
    });
  }

  async getEnhancedTop5Matches(channelLeagues = []) {
    const top5 = await this.getTodayMatches(channelLeagues);
    // H2H only available via API-Football
    if (this.afKey) {
      for (const match of top5.slice(0, 3)) {
        try {
          match.headToHead = await this.getH2H(match.homeTeam.id, match.awayTeam.id);
        } catch (_) {}
      }
    }
    return top5;
  }

  async getH2H(teamId1, teamId2) {
    if (!this.afKey) return { totalMatches: 0, results: [] };
    try {
      const data = await this.afCall('/fixtures/headtohead', {
        h2h: `${teamId1}-${teamId2}`, last: 5,
      });
      return {
        totalMatches: data.length,
        results: data.map(m => ({
          home: m.teams.home.name,
          away: m.teams.away.name,
          homeGoals: m.goals.home,
          awayGoals: m.goals.away,
        })),
      };
    } catch (_) {
      return { totalMatches: 0, results: [] };
    }
  }

  // ─── FILTERING & SCORING ───

  filterQualityMatches(fixtures, channelLeagues = []) {
    return fixtures.filter(m => {
      const leagueId = m.league?.id;
      const leagueName = (m.league?.name || '').toLowerCase();

      if (channelLeagues.length > 0) {
        return channelLeagues.includes(leagueId);
      }

      // Exclude youth/reserve/women
      if (/u21|u20|u19|u18|u17|youth|reserve|academy|women/i.test(leagueName)) return false;

      // Exclude postponed/cancelled
      const status = m.fixture?.status?.short;
      if (['PST', 'CANC'].includes(status)) return false;

      // Include if it's in our scored leagues
      if (this.leagueScores[leagueId] >= 50) return true;

      // Fallback: include by name pattern
      return /premier|liga|serie|bundesliga|ligue|champions|europa|cup|world|afcon|nations|eredivisie/i.test(leagueName);
    });
  }

  calculateMatchScore(match) {
    let score = this.leagueScores[match.league?.id] || 15;

    const topIds = [2, 3, 39, 140, 135, 78, 61, 6, 1, 4, 12, 898,
      2001, 2021, 2014, 2019, 2002, 2015, 2000, 2018]; // both providers
    if (topIds.includes(match.league?.id)) score += 50;

    const h = match.teams?.home?.name || '';
    const a = match.teams?.away?.name || '';
    if (this.bigTeams.has(h)) score += 25;
    if (this.bigTeams.has(a)) score += 25;
    if (this.bigTeams.has(h) && this.bigTeams.has(a)) score += 30;

    if (this.derbyPairs.some(([x, y]) =>
      (h.includes(x) && a.includes(y)) || (h.includes(y) && a.includes(x))
    )) score += 30;

    const hour = new Date(match.fixture?.date).getHours();
    if (hour >= 14 && hour <= 21) score += 15;

    if (/final|semi|quarter/i.test(match.league?.round || '')) score += 40;

    if (((match.goals?.home || 0) + (match.goals?.away || 0)) >= 4) score += 15;

    return score;
  }

  selectTopMatches(fixtures, count = 5) {
    const upcoming = fixtures.filter(m => ['NS', 'TBD', 'TIMED'].includes(m.fixture?.status?.short));
    const pool = upcoming.length > 0 ? upcoming : fixtures;

    const ranked = pool
      .map(m => ({ ...m, _score: this.calculateMatchScore(m) }))
      .sort((a, b) => b._score - a._score)
      .slice(0, count);

    console.log('🏆 Top matches:');
    ranked.forEach((m, i) => console.log(`  ${i + 1}. ${m.teams.home.name} vs ${m.teams.away.name} (${m.league.name}) — ${m._score}pts`));

    return this.processMatches(ranked);
  }

  // ─── DATA PROCESSING ───

  processMatches(fixtures) {
    return fixtures.map(m => ({
      id: m.fixture.id,
      homeTeam: { id: m.teams.home.id, name: m.teams.home.name, crest: m.teams.home.logo },
      awayTeam: { id: m.teams.away.id, name: m.teams.away.name, crest: m.teams.away.logo },
      competition: { id: m.league.id, name: m.league.name, emblem: m.league.logo },
      kickoffTime: new Date(m.fixture.date),
      venue: m.fixture.venue?.name || 'TBD',
      stage: m.league.round,
      rankScore: m._score || 0,
    })).sort((a, b) => a.kickoffTime - b.kickoffTime);
  }

  processResults(fixtures) {
    return fixtures
      .filter(m => m.fixture?.status?.short === 'FT')
      .map(m => ({
        homeTeam: m.teams.home.name,
        awayTeam: m.teams.away.name,
        homeScore: m.goals.home,
        awayScore: m.goals.away,
        competition: m.league.name,
        leagueId: m.league.id,
      }));
  }

  getMatchTimings(matches) {
    if (!matches || matches.length === 0) return null;
    const timings = matches.map(m => ({
      id: m.id,
      kickoffTime: new Date(m.kickoffTime),
      timeUntilKickoff: (new Date(m.kickoffTime) - Date.now()) / 60000,
      teams: `${m.homeTeam?.name || m.homeTeam} vs ${m.awayTeam?.name || m.awayTeam}`,
    })).sort((a, b) => a.kickoffTime - b.kickoffTime);

    return {
      nextMatch: timings[0],
      allMatches: timings,
      shouldPostPredictions: timings.some(t => t.timeUntilKickoff > 60 && t.timeUntilKickoff < 240),
      shouldPostResults: timings.some(t => t.timeUntilKickoff < -90),
    };
  }

  // Backward compat aliases
  async getAllTodayMatchesRanked() { return this.getTodayMatches(); }
  async getAllYesterdayResults() { return this.getYesterdayResults(); }
}

module.exports = FootballAPI;
