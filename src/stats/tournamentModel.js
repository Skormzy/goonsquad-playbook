import tournamentSeed from './tournaments.json';
import tournamentEvents from './tournamentEvents.json';
import tournamentGameDetails from './tournamentGameDetails.json';
import officialYoutubeActivity from '../feed/officialYoutubeActivity.json';

export const TOURNAMENT_COMPETITION_ID = 'tournaments';

export const DEFAULT_TOURNAMENT_DISPLAY = Object.freeze({
  layout: 'championship',
  accent: 'red',
  bracketMode: 'full',
  showOverview: true,
  showStandings: true,
  showBracket: true,
  showGames: true,
  showVerification: true,
  overviewLabel: 'Overview',
  standingsLabel: 'Standings',
  bracketLabel: 'Bracket',
  gamesLabel: 'Games',
});

const VIDEO_TITLE_PATTERN = /^Goonsquad vs (.+?) \((Home|Away) View\) - Game (\d+) \| (.+)$/i;

const TOURNAMENT_SLOT_LABEL_PATTERNS = Object.freeze([
  /^(?:tbd|tba|bye)$/iu,
  /^\d+(?:st|nd|rd|th)\b.*\boverall$/iu,
  /^(?:winner|loser)\b/iu,
  /^(?:highest|lowest|best)\s+(?:remaining\s+)?seed$/iu,
  /^(?:pool\s+)?[a-z]\s+(?:winner|runner-up)$/iu,
  /^(?:play-in|wildcard)\s+winner$/iu,
]);

function normalized(value) {
  return String(value || '').trim().toLowerCase();
}

function tournamentTeamId(name, index) {
  return normalized(name)
    .replace(/[^a-z0-9]+/gu, '-')
    .replace(/^-+|-+$/gu, '') || `team-${index + 1}`;
}

export function isTournamentEntrantName(value) {
  const name = String(value || '').trim();
  return Boolean(name) && !TOURNAMENT_SLOT_LABEL_PATTERNS.some((pattern) => pattern.test(name));
}

export function tournamentTeams(tournament = {}) {
  const teamName = String(tournament.teamName || 'Goonsquad').trim();
  const explicitTeams = Array.isArray(tournament.teams) ? tournament.teams : [];
  const names = [
    teamName,
    ...explicitTeams.map((team) => team?.name),
    ...(tournament.pools || []).flatMap((pool) => pool?.teams || []),
    ...(tournament.games || []).map((game) => game?.opponent),
    ...(tournament.eventGames || []).flatMap((game) => [game?.awayTeam, game?.homeTeam]),
    ...(tournament.standings || []).map((row) => row?.team),
    ...(tournament.bracket || []).flatMap((match) => [match?.homeTeam?.name, match?.awayTeam?.name]),
  ];
  const seen = new Set();

  return names.reduce((teams, name, index) => {
    const trimmedName = String(name || '').trim();
    const key = normalized(trimmedName);
    if (!isTournamentEntrantName(trimmedName) || seen.has(key)) return teams;
    seen.add(key);
    const explicit = explicitTeams.find((team) => normalized(team?.name) === key);
    teams.push({
      id: explicit?.id || tournamentTeamId(trimmedName, index),
      name: trimmedName,
      pool: explicit?.pool || '',
      seed: explicit?.seed ?? '',
      isGoonSquad: explicit?.isGoonSquad ?? key === normalized(teamName),
    });
    return teams;
  }, []);
}

export function normalizeTournamentDisplay(display = {}) {
  const next = { ...DEFAULT_TOURNAMENT_DISPLAY, ...(display || {}) };
  if (!['championship', 'scoreboard', 'compact'].includes(next.layout)) {
    next.layout = DEFAULT_TOURNAMENT_DISPLAY.layout;
  }
  if (!['red', 'cyan', 'gold'].includes(next.accent)) {
    next.accent = DEFAULT_TOURNAMENT_DISPLAY.accent;
  }
  if (!['full', 'team-path', 'hidden'].includes(next.bracketMode)) {
    next.bracketMode = DEFAULT_TOURNAMENT_DISPLAY.bracketMode;
  }
  next.showBracket = next.bracketMode === 'hidden' ? false : Boolean(next.showBracket);
  ['showOverview', 'showStandings', 'showGames', 'showVerification'].forEach((key) => {
    next[key] = Boolean(next[key]);
  });
  ['overviewLabel', 'standingsLabel', 'bracketLabel', 'gamesLabel'].forEach((key) => {
    next[key] = String(next[key] || DEFAULT_TOURNAMENT_DISPLAY[key]).trim().slice(0, 24)
      || DEFAULT_TOURNAMENT_DISPLAY[key];
  });
  return next;
}

export function normalizeTournament(tournament = {}) {
  const eventSeed = tournamentEvents[tournament.id] || {};
  const gameDetails = tournamentGameDetails[tournament.id]?.games || {};
  const pools = Array.isArray(tournament.pools) ? tournament.pools : eventSeed.pools || [];
  const sourceEventGames = Array.isArray(tournament.eventGames)
    ? tournament.eventGames
    : eventSeed.eventGames || [];
  const eventGames = sourceEventGames.map((game) => ({
    ...game,
    details: gameDetails[game.id] || null,
  }));
  const mergedTournament = { ...tournament, pools, eventGames };
  return {
    ...tournament,
    id: String(tournament.id || '').trim(),
    name: String(tournament.name || 'Untitled tournament').trim(),
    shortName: String(tournament.shortName || tournament.name || 'Tournament').trim(),
    teamName: String(tournament.teamName || 'Goonsquad').trim(),
    pools,
    eventGames,
    teams: tournamentTeams(mergedTournament),
    standings: Array.isArray(tournament.standings) ? tournament.standings : [],
    games: Array.isArray(tournament.games) ? tournament.games : [],
    bracket: Array.isArray(tournament.bracket) ? tournament.bracket : [],
    leaders: Array.isArray(tournament.leaders) ? tournament.leaders : [],
    playerStats: Array.isArray(tournament.playerStats) ? tournament.playerStats : [],
    goalieStats: Array.isArray(tournament.goalieStats) ? tournament.goalieStats : [],
    display: normalizeTournamentDisplay(tournament.display),
  };
}

export function parseTournamentVideo(activity) {
  const match = String(activity?.sourceTitle || '').match(VIDEO_TITLE_PATTERN);
  if (!match) return null;
  return {
    opponent: match[1].trim(),
    angle: match[2].toLowerCase(),
    gameNumber: Number(match[3]),
    tournamentName: match[4].trim(),
    title: activity.sourceTitle,
    url: activity.linkUrl,
    thumbnail: activity.sourceImageUrl,
    videoId: activity.sourceMetadata?.videoId || '',
    publishedAt: activity.sourcePublishedAt || '',
  };
}

export function enrichTournament(tournament, activities = officialYoutubeActivity.items) {
  const normalizedTournament = normalizeTournament(tournament);
  const parsedVideos = (activities || [])
    .map(parseTournamentVideo)
    .filter(Boolean)
    .filter((video) => normalized(video.tournamentName) === normalized(normalizedTournament.name));

  const games = normalizedTournament.games.map((game) => ({
    ...game,
    media: parsedVideos
      .filter((video) => (
        video.gameNumber === game.gameNumber
        && normalized(video.opponent) === normalized(game.opponent)
      ))
      .sort((a, b) => (a.angle === 'home' ? -1 : b.angle === 'home' ? 1 : 0)),
  }));

  const teamGamesById = new Map(games.map((game) => [game.id, game]));
  const eventGames = normalizedTournament.eventGames.map((eventGame) => {
    const teamGame = eventGame.teamGameId
      ? teamGamesById.get(eventGame.teamGameId)
      : games.find((game) => game.officialGameNumber === eventGame.officialGameNumber);
    return {
      ...eventGame,
      media: teamGame?.media || [],
    };
  });

  return {
    ...normalizedTournament,
    games,
    eventGames,
  };
}

export function buildTournamentArchive(
  tournaments = tournamentSeed,
  activities = officialYoutubeActivity.items,
) {
  return tournaments
    .map((tournament) => enrichTournament(tournament, activities))
    .sort((a, b) => String(b.startDate).localeCompare(String(a.startDate)));
}

function sourceSnapshotKey(tournament = {}) {
  const source = tournament.source || {};
  if (!source.capturedAt) return '';
  return [source.provider, source.seasonId, source.teamId, source.capturedAt]
    .map((value) => String(value || '').trim())
    .join(':');
}

function sourceRevision(tournament = {}) {
  const revision = Number(tournament.source?.revision ?? 0);
  return Number.isFinite(revision) ? revision : 0;
}

function seedSourceRefreshRequired(seed, payload) {
  if (!payload) return false;
  const seedSnapshot = sourceSnapshotKey(seed);
  const payloadSnapshot = sourceSnapshotKey(payload);
  return sourceRevision(seed) > sourceRevision(payload)
    || Boolean(seedSnapshot && seedSnapshot !== payloadSnapshot);
}

function mergeSeedTournament(seed, payload) {
  if (!payload) return seed;
  const sourceRefreshRequired = seedSourceRefreshRequired(seed, payload);

  if (sourceRefreshRequired) {
    const officialEventSeed = tournamentEvents[seed.id] || {};
    return {
      ...payload,
      ...seed,
      pools: officialEventSeed.pools || seed.pools || [],
      eventGames: officialEventSeed.eventGames || seed.eventGames || [],
      display: { ...seed.display },
    };
  }

  return {
    ...seed,
    ...payload,
    display: { ...seed.display, ...payload.display },
  };
}

export function mergeTournamentRecords(
  seedTournaments = [],
  records = [],
  { includeDrafts = false, activities = officialYoutubeActivity.items } = {},
) {
  const seedById = new Map(seedTournaments.map((tournament) => [tournament.id, tournament]));
  const recordById = new Map((records || []).map((record) => [record.id, record]));
  const merged = [];

  seedTournaments.forEach((seed) => {
    const record = recordById.get(seed.id);
    if (record && !record.isPublished && !includeDrafts) return;
    const payload = mergeSeedTournament(seed, record?.payload);
    merged.push({
      ...payload,
      _record: {
        hasOverride: Boolean(record?.payload),
        isPublished: record ? Boolean(record.isPublished) : true,
        isSeed: true,
        sourceRefreshRequired: seedSourceRefreshRequired(seed, record?.payload),
        updatedAt: record?.updatedAt || '',
      },
    });
  });

  records.forEach((record) => {
    if (seedById.has(record.id) || !record.payload) return;
    if (!record.isPublished && !includeDrafts) return;
    merged.push({
      ...record.payload,
      id: record.id,
      _record: {
        hasOverride: true,
        isPublished: Boolean(record.isPublished),
        isSeed: false,
        updatedAt: record.updatedAt || '',
      },
    });
  });

  return buildTournamentArchive(merged, activities);
}

export function tournamentForPersistence(tournament) {
  const normalizedTournament = normalizeTournament(tournament);
  const { _record, ...payload } = normalizedTournament;
  return {
    ...payload,
    games: payload.games.map((game) => {
      const persistedGame = { ...game };
      delete persistedGame.media;
      return persistedGame;
    }),
    eventGames: payload.eventGames.map((game) => {
      const persistedGame = { ...game };
      delete persistedGame.media;
      return persistedGame;
    }),
  };
}

export function tournamentById(tournaments, tournamentId) {
  return tournaments.find((tournament) => tournament.id === tournamentId) || tournaments[0] || null;
}

export function tournamentEventGames(tournament = {}) {
  if (Array.isArray(tournament.eventGames) && tournament.eventGames.length) {
    return tournament.eventGames;
  }
  const teamName = tournament.teamName || 'Goonsquad';
  return (tournament.games || []).map((game) => ({
    ...game,
    id: game.eventGameId || game.id,
    awayTeam: game.site === 'Away' ? teamName : game.opponent,
    awayScore: game.site === 'Away' ? game.scoreFor : game.scoreAgainst,
    homeTeam: game.site === 'Away' ? game.opponent : teamName,
    homeScore: game.site === 'Away' ? game.scoreAgainst : game.scoreFor,
    teamGameId: game.id,
  }));
}

export function tournamentGameById(tournament, gameId) {
  return tournamentEventGames(tournament).find((game) => game.id === gameId) || null;
}

export function tournamentPools(tournament = {}) {
  if (Array.isArray(tournament.pools) && tournament.pools.length) return tournament.pools;
  const grouped = new Map();
  (tournament.teams || []).forEach((team) => {
    if (!team.pool) return;
    const id = tournamentTeamId(team.pool, grouped.size);
    if (!grouped.has(id)) grouped.set(id, { id, name: team.pool, teams: [] });
    grouped.get(id).teams.push(team.name);
  });
  return [...grouped.values()];
}

export function tournamentPoolStandings(tournament, poolId) {
  const pool = tournamentPools(tournament).find((item) => item.id === poolId);
  if (!pool) return [];
  const rows = new Map(pool.teams.map((team) => [normalized(team), {
    team,
    isGoonSquad: normalized(team) === normalized(tournament.teamName || 'Goonsquad'),
    gamesPlayed: 0,
    wins: 0,
    losses: 0,
    ties: 0,
    goalsFor: 0,
    goalsAgainst: 0,
    points: 0,
  }]));

  tournamentEventGames(tournament)
    .filter((game) => game.stage === 'round-robin')
    .forEach((game) => {
      if (!Number.isFinite(game.awayScore) || !Number.isFinite(game.homeScore)) return;
      const away = rows.get(normalized(game.awayTeam));
      const home = rows.get(normalized(game.homeTeam));
      if (away) {
        away.gamesPlayed += 1;
        away.goalsFor += game.awayScore;
        away.goalsAgainst += game.homeScore;
        away.wins += game.awayScore > game.homeScore ? 1 : 0;
        away.losses += game.awayScore < game.homeScore ? 1 : 0;
        away.ties += game.awayScore === game.homeScore ? 1 : 0;
        away.points += game.awayScore > game.homeScore ? 2 : game.awayScore === game.homeScore ? 1 : 0;
      }
      if (home) {
        home.gamesPlayed += 1;
        home.goalsFor += game.homeScore;
        home.goalsAgainst += game.awayScore;
        home.wins += game.homeScore > game.awayScore ? 1 : 0;
        home.losses += game.homeScore < game.awayScore ? 1 : 0;
        home.ties += game.homeScore === game.awayScore ? 1 : 0;
        home.points += game.homeScore > game.awayScore ? 2 : game.homeScore === game.awayScore ? 1 : 0;
      }
    });

  return sortedTournamentStandings([...rows.values()]);
}

export function tournamentSummary(tournament) {
  const games = tournament?.games || [];
  const played = games.filter((game) => game.status === 'played' || game.status === 'final');
  const scored = played.filter((game) => Number.isFinite(game.scoreFor) && Number.isFinite(game.scoreAgainst));
  const wins = scored.filter((game) => game.scoreFor > game.scoreAgainst).length;
  const losses = scored.filter((game) => game.scoreFor < game.scoreAgainst).length;
  const ties = scored.filter((game) => game.scoreFor === game.scoreAgainst).length;
  const opponents = new Set(games.map((game) => game.opponent).filter(Boolean));
  const videoAngles = games.reduce((total, game) => total + (game.media?.length || 0), 0);
  const goalsFor = scored.reduce((total, game) => total + game.scoreFor, 0);
  const goalsAgainst = scored.reduce((total, game) => total + game.scoreAgainst, 0);
  const teamStats = tournament?.teamStats || {};

  return {
    documentedGames: games.length,
    playedGames: played.length,
    scoredGames: scored.length,
    wins,
    losses,
    ties,
    opponents: opponents.size,
    videoAngles,
    record: scored.length ? `${wins}-${losses}-${ties}` : 'Archive pending',
    goalsFor: Number.isFinite(teamStats.goalsFor) ? teamStats.goalsFor : goalsFor,
    goalsAgainst: Number.isFinite(teamStats.goalsAgainst) ? teamStats.goalsAgainst : goalsAgainst,
    goalDifferential: Number.isFinite(teamStats.goalDifferential)
      ? teamStats.goalDifferential
      : goalsFor - goalsAgainst,
    finish: tournament?.finish || '',
    poolFinish: tournament?.pool?.finish || null,
    poolRecord: tournament?.pool?.record || '',
  };
}

export function sortedTournamentStandings(standings = []) {
  return [...standings]
    .sort((a, b) => (
      (b.points ?? 0) - (a.points ?? 0)
      || ((b.goalsFor ?? 0) - (b.goalsAgainst ?? 0)) - ((a.goalsFor ?? 0) - (a.goalsAgainst ?? 0))
      || (b.goalsFor ?? 0) - (a.goalsFor ?? 0)
      || String(a.team).localeCompare(String(b.team))
    ))
    .map((row, index) => ({
      ...row,
      rank: row.rank ?? index + 1,
    }));
}

export function tournamentBracketRounds(bracket = []) {
  const rounds = new Map();
  bracket.forEach((match) => {
    const roundId = match.roundId || 'round';
    if (!rounds.has(roundId)) {
      rounds.set(roundId, {
        id: roundId,
        name: match.roundName || 'Round',
        order: match.roundOrder ?? rounds.size,
        matches: [],
      });
    }
    rounds.get(roundId).matches.push(match);
  });
  return [...rounds.values()]
    .sort((a, b) => a.order - b.order)
    .map((round) => ({
      ...round,
      matches: round.matches.sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
    }));
}

function bracketWinnerName(match = {}) {
  if (match.winner === 'away') return match.awayTeam?.name || '';
  if (match.winner === 'home') return match.homeTeam?.name || '';
  if (Number.isFinite(match.awayScore) && Number.isFinite(match.homeScore)) {
    if (match.awayScore > match.homeScore) return match.awayTeam?.name || '';
    if (match.homeScore > match.awayScore) return match.homeTeam?.name || '';
  }
  return '';
}

export function tournamentBracketTree(bracket = []) {
  const rounds = tournamentBracketRounds(bracket).map((round) => ({
    ...round,
    matches: [...round.matches],
  }));

  for (let roundIndex = rounds.length - 2; roundIndex >= 0; roundIndex -= 1) {
    const current = rounds[roundIndex];
    const next = rounds[roundIndex + 1];
    const remaining = [...current.matches];
    const ordered = [];

    next.matches.forEach((nextMatch) => {
      [nextMatch.awayTeam?.name, nextMatch.homeTeam?.name].forEach((teamName) => {
        const feederIndex = remaining.findIndex((match) => (
          normalized(bracketWinnerName(match)) === normalized(teamName)
        ));
        if (feederIndex >= 0) ordered.push(remaining.splice(feederIndex, 1)[0]);
      });
    });

    current.matches = [...ordered, ...remaining];
  }

  return rounds;
}

export const TOURNAMENT_ARCHIVE = buildTournamentArchive();
