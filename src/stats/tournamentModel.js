import tournamentSeed from './tournaments.json';
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

function normalized(value) {
  return String(value || '').trim().toLowerCase();
}

function tournamentTeamId(name, index) {
  return normalized(name)
    .replace(/[^a-z0-9]+/gu, '-')
    .replace(/^-+|-+$/gu, '') || `team-${index + 1}`;
}

export function tournamentTeams(tournament = {}) {
  const teamName = String(tournament.teamName || 'Goonsquad').trim();
  const explicitTeams = Array.isArray(tournament.teams) ? tournament.teams : [];
  const names = explicitTeams.length
    ? explicitTeams.map((team) => team?.name)
    : [
      teamName,
      ...(tournament.games || []).map((game) => game?.opponent),
      ...(tournament.standings || []).map((row) => row?.team),
      ...(tournament.bracket || []).flatMap((match) => [match?.homeTeam?.name, match?.awayTeam?.name]),
    ];
  const seen = new Set();

  return names.reduce((teams, name, index) => {
    const trimmedName = String(name || '').trim();
    const key = normalized(trimmedName);
    if (!trimmedName || key === 'tbd' || seen.has(key)) return teams;
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
  return {
    ...tournament,
    id: String(tournament.id || '').trim(),
    name: String(tournament.name || 'Untitled tournament').trim(),
    shortName: String(tournament.shortName || tournament.name || 'Tournament').trim(),
    teamName: String(tournament.teamName || 'Goonsquad').trim(),
    teams: tournamentTeams(tournament),
    standings: Array.isArray(tournament.standings) ? tournament.standings : [],
    games: Array.isArray(tournament.games) ? tournament.games : [],
    bracket: Array.isArray(tournament.bracket) ? tournament.bracket : [],
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

  return {
    ...normalizedTournament,
    games,
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
    const payload = record?.payload
      ? {
        ...seed,
        ...record.payload,
        display: { ...seed.display, ...record.payload.display },
      }
      : seed;
    merged.push({
      ...payload,
      _record: {
        hasOverride: Boolean(record?.payload),
        isPublished: record ? Boolean(record.isPublished) : true,
        isSeed: true,
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
  };
}

export function tournamentById(tournaments, tournamentId) {
  return tournaments.find((tournament) => tournament.id === tournamentId) || tournaments[0] || null;
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

export const TOURNAMENT_ARCHIVE = buildTournamentArchive();
