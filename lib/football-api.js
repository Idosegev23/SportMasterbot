// Football API Integration for SportMaster
// Optimized: single API call per query + comprehensive world & African leagues

const axios = require('axios');

class FootballAPI {
  constructor() {
    this.isDirect = process.env.API_FOOTBALL_DIRECT !== 'false';
    this.baseUrl = this.isDirect
      ? 'https://v3.football.api-sports.io'
      : 'https://api-football-v1.p.rapidapi.com/v3';
    this.apiKey = process.env.API_FOOTBALL_KEY;
    this.rapidApiKey = process.env.RAPID_API_KEY;

    if (!this.apiKey) {
      console.warn('⚠️ API_FOOTBALL_KEY not set — football data will be unavailable');
    }

    // ─── LEAGUE SCORES (higher = more important for ranking) ───
    this.leagueScores = {
      // UEFA Club Competitions
      2: 150,    // Champions League
      3: 120,    // Europa League
      848: 100,  // Conference League

      // England
      39: 130,   // Premier League
      40: 75,    // Championship
      45: 85,    // FA Cup
      48: 75,    // EFL Cup

      // Spain
      140: 125,  // La Liga
      143: 65,   // Copa del Rey

      // Italy
      135: 120,  // Serie A
      137: 65,   // Coppa Italia

      // Germany
      78: 115,   // Bundesliga
      81: 65,    // DFB Pokal

      // France
      61: 110,   // Ligue 1
      66: 65,    // Coupe de France

      // Portugal
      94: 85,    // Primeira Liga

      // Netherlands
      88: 80,    // Eredivisie

      // Turkey
      203: 70,   // Süper Lig

      // Scotland
      179: 60,   // Premiership

      // Belgium
      144: 55,   // Pro League

      // ─── AFRICA (critical for Ethiopian audience) ───
      898: 95,   // Ethiopian Premier League
      12: 110,   // CAF Champions League
      13: 90,    // CAF Confederation Cup
      6: 130,    // AFCON
      36: 95,    // AFCON Qualifiers
      29: 100,   // World Cup Qualifiers (Africa / CAF)
      233: 75,   // Egyptian Premier League
      288: 70,   // South African Premier Division
      276: 65,   // Kenyan Premier League
      350: 55,   // Tanzanian Premier League
      332: 55,   // Nigerian NPFL
      200: 55,   // Moroccan Botola Pro
      202: 50,   // Tunisian Ligue 1

      // ─── SOUTH AMERICA ───
      71: 85,    // Brazilian Serie A
      128: 75,   // Argentine Liga Profesional
      11: 80,    // Copa Libertadores
      14: 70,    // Copa Sudamericana

      // ─── NORTH AMERICA / ASIA ───
      253: 60,   // MLS
      307: 60,   // Saudi Pro League

      // ─── INTERNATIONAL ───
      1: 150,    // FIFA World Cup
      4: 120,    // Euro Championship
      15: 90,    // FIFA Club World Cup
    };

    // Big teams for bonus scoring
    this.bigTeams = new Set([
      'Real Madrid', 'Barcelona', 'Manchester City', 'Manchester United',
      'Liverpool', 'Arsenal', 'Chelsea', 'Tottenham',
      'Bayern Munich', 'Borussia Dortmund', 'Paris Saint-Germain',
      'Juventus', 'AC Milan', 'Inter Milan', 'Napoli', 'Roma',
      'Atletico Madrid', 'Sevilla',
      'Ajax', 'PSV', 'Feyenoord',
      'Benfica', 'Porto', 'Sporting CP',
      'Celtic', 'Rangers',
      'Galatasaray', 'Fenerbahce', 'Besiktas',
      'Flamengo', 'Palmeiras', 'Corinthians', 'Boca Juniors', 'River Plate',
      'Al Hilal', 'Al Nassr', 'Al Ahly', 'Zamalek',
      'Kaizer Chiefs', 'Mamelodi Sundowns', 'Orlando Pirates',
      'Gor Mahia', 'Simba SC', 'Young Africans',
      'St. George', 'Ethiopian Coffee', 'Fasil Kenema',
    ]);

    // Derby pairs for bonus scoring
    this.derbyPairs = [
      ['Real Madrid', 'Atletico Madrid'], ['Real Madrid', 'Barcelona'],
      ['Inter Milan', 'AC Milan'], ['Manchester United', 'Manchester City'],
      ['Liverpool', 'Everton'], ['Arsenal', 'Tottenham'],
      ['Celtic', 'Rangers'], ['Galatasaray', 'Fenerbahce'],
      ['Boca Juniors', 'River Plate'], ['Al Ahly', 'Zamalek'],
      ['Flamengo', 'Corinthians'], ['Bayern Munich', 'Borussia Dortmund'],
    ];
  }

  // ─── HTTP HELPERS ───

  getHeaders() {
    return this.isDirect
      ? { 'x-apisports-key': this.apiKey }
      : { 'X-RapidAPI-Key': this.apiKey, 'X-RapidAPI-Host': 'api-football-v1.p.rapidapi.com' };
  }

  async apiCall(endpoint, params, { timeout = 30000 } = {}) {
    if (!this.apiKey) throw new Error('API_FOOTBALL_KEY not configured');
    const response = await axios.get(`${this.baseUrl}${endpoint}`, {
      headers: this.getHeaders(),
      params,
      timeout,
    });
    return response.data.response || [];
  }

  async retryApiCall(fn, maxRetries = 2, baseDelay = 2000) {
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

  // ─── DATE HELPERS (Ethiopian timezone) ───

  todayStr() {
    return new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Addis_Ababa' });
  }

  yesterdayStr() {
    return new Date(Date.now() - 86400000).toLocaleDateString('en-CA', { timeZone: 'Africa/Addis_Ababa' });
  }

  // ─── MAIN DATA METHODS (single API call each!) ───

  // Get ALL today's fixtures in ONE call, then filter/rank client-side
  async getTodayMatches(channelLeagues = []) {
    const today = this.todayStr();
    console.log(`⚽ Fetching ALL matches for ${today} (single API call)...`);

    const fixtures = await this.retryApiCall(() =>
      this.apiCall('/fixtures', { date: today, timezone: 'Africa/Addis_Ababa' })
    );

    console.log(`📊 Got ${fixtures.length} total fixtures`);
    if (fixtures.length === 0) return [];

    const quality = this.filterQualityMatches(fixtures, channelLeagues);
    console.log(`🔍 ${quality.length} matches from quality leagues`);

    return this.selectTopMatches(quality, 5);
  }

  // Get yesterday's finished results in ONE call
  async getYesterdayResults(channelLeagues = []) {
    const yesterday = this.yesterdayStr();
    console.log(`📊 Fetching results for ${yesterday} (single API call)...`);

    const fixtures = await this.retryApiCall(() =>
      this.apiCall('/fixtures', { date: yesterday, status: 'FT', timezone: 'Africa/Addis_Ababa' })
    );

    console.log(`📊 Got ${fixtures.length} finished fixtures`);
    if (fixtures.length === 0) return [];

    const quality = this.filterQualityMatches(fixtures, channelLeagues);
    return quality
      .sort((a, b) => this.calculateMatchScore(b) - this.calculateMatchScore(a))
      .slice(0, 5)
      .map(m => this.processResults([m])[0])
      .filter(Boolean);
  }

  // Get currently live matches in ONE call
  async getLiveMatches(channelLeagues = []) {
    console.log('🔴 Fetching live matches...');

    const fixtures = await this.retryApiCall(() =>
      this.apiCall('/fixtures', { live: 'all' })
    );

    console.log(`🔴 ${fixtures.length} live fixtures`);
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

  // Get upcoming matches (next 0.5-4 hours)
  async getUpcomingMatches(channelLeagues = []) {
    const matches = await this.getTodayMatches(channelLeagues);
    const now = Date.now();
    return matches.filter(m => {
      const hours = (new Date(m.kickoffTime) - now) / 3600000;
      return hours > 0.5 && hours < 4;
    });
  }

  // Enhanced top 5 with H2H (optional extra API calls)
  async getEnhancedTop5Matches(channelLeagues = []) {
    const top5 = await this.getTodayMatches(channelLeagues);
    for (const match of top5.slice(0, 3)) {
      try {
        match.headToHead = await this.getH2H(match.homeTeam.id, match.awayTeam.id);
      } catch (_) {}
    }
    return top5;
  }

  async getH2H(teamId1, teamId2) {
    try {
      const data = await this.apiCall('/fixtures/headtohead', {
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

      // If channel has specific leagues configured, use only those
      if (channelLeagues.length > 0) {
        return channelLeagues.includes(leagueId);
      }

      // Exclude youth/reserve/women
      if (/u21|u20|u19|u18|u17|youth|reserve|academy|women/i.test(leagueName)) return false;

      // Include if it's in our scored leagues
      if (this.leagueScores[leagueId] >= 50) return true;

      // Fallback: include by name pattern
      return /premier|liga|serie|bundesliga|ligue|champions|europa|cup|world|afcon|nations/i.test(leagueName);
    });
  }

  calculateMatchScore(match) {
    let score = this.leagueScores[match.league?.id] || 15;

    // Top-tier bonus
    if ([2, 3, 39, 140, 135, 78, 61, 6, 1, 4, 12, 898].includes(match.league?.id)) score += 50;

    // Team bonuses
    const h = match.teams?.home?.name || '';
    const a = match.teams?.away?.name || '';
    if (this.bigTeams.has(h)) score += 25;
    if (this.bigTeams.has(a)) score += 25;
    if (this.bigTeams.has(h) && this.bigTeams.has(a)) score += 30;

    // Derby bonus
    if (this.derbyPairs.some(([x, y]) =>
      (h.includes(x) && a.includes(y)) || (h.includes(y) && a.includes(x))
    )) score += 30;

    // Prime time (14-21h)
    const hour = new Date(match.fixture?.date).getHours();
    if (hour >= 14 && hour <= 21) score += 15;

    // Knockout stage
    if (/final|semi|quarter/i.test(match.league?.round || '')) score += 40;

    // High-scoring games
    if (((match.goals?.home || 0) + (match.goals?.away || 0)) >= 4) score += 15;

    return score;
  }

  selectTopMatches(fixtures, count = 5) {
    const upcoming = fixtures.filter(m => ['NS', 'TBD'].includes(m.fixture?.status?.short));
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
