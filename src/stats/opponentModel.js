import { formatLeagueScheduleName, teamSummary } from './statsModel';
import { isAwaitingResult } from './scheduleFreshness';

const PLAYOFF_SEED_SUFFIX = /\s+\(\d+(?:st|nd|rd|th)\)$/i;
const OPPONENT_ALIASES = new Map([
  ['OG VIPERZ', 'VIPERZ'],
]);

function comparableDate(value) {
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function recordFor(games) {
  return teamSummary(games.filter((game) => game.status === 'final'));
}

export function canonicalOpponentName(value) {
  const normalized = String(value || '')
    .replace(PLAYOFF_SEED_SUFFIX, '')
    .replace(/\s+/g, ' ')
    .trim();
  return OPPONENT_ALIASES.get(normalized.toLocaleUpperCase('en-CA')) || normalized;
}

export function opponentKey(value) {
  return canonicalOpponentName(value).toLocaleUpperCase('en-CA');
}

export function opponentSlug(value) {
  return canonicalOpponentName(value)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('en-CA')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function gameOutcome(game) {
  if (!game || game.status !== 'final') return 'scheduled';
  if (Number(game.goalsFor) > Number(game.goalsAgainst)) return 'win';
  if (Number(game.goalsFor) < Number(game.goalsAgainst)) return 'loss';
  return 'tie';
}

export function buildOpponentMatchups(
  dataset,
  now = new Date(),
  {
    seasonTeamIds = null,
    scopeLabel = 'YCBHL + Greater Toronto Ball Hockey League · All Goonsquad teams',
  } = {},
) {
  if (!dataset) return [];
  const teamById = new Map((dataset.teams || []).map((team) => [team.id, team]));
  const seasonById = new Map((dataset.seasons || []).map((season) => [season.id, season]));
  const allowedTeamIds = seasonTeamIds ? new Set(seasonTeamIds) : null;
  const grouped = new Map();

  (dataset.games || []).forEach((game) => {
    if (allowedTeamIds && !allowedTeamIds.has(game.seasonTeamId)) return;
    const key = opponentKey(game.opponent);
    if (!key) return;
    const group = grouped.get(key) || {
      key,
      slug: opponentSlug(game.opponent),
      name: canonicalOpponentName(game.opponent),
      games: [],
    };
    group.games.push(game);
    grouped.set(key, group);
  });

  const nowTime = now.getTime();
  return [...grouped.values()]
    .map((group) => {
      const games = [...group.games].sort((a, b) => comparableDate(b.scheduledAt) - comparableDate(a.scheduledAt));
      const finalGames = games.filter((game) => game.status === 'final');
      const upcomingGames = games
        .filter((game) => game.status !== 'final' && comparableDate(game.scheduledAt) >= nowTime)
        .sort((a, b) => comparableDate(a.scheduledAt) - comparableDate(b.scheduledAt));
      const awaitingResults = games
        .filter((game) => isAwaitingResult(game, nowTime))
        .sort((a, b) => comparableDate(b.scheduledAt) - comparableDate(a.scheduledAt));
      const recentMeetings = [...finalGames, ...awaitingResults]
        .sort((a, b) => comparableDate(b.scheduledAt) - comparableDate(a.scheduledAt));
      const summary = recordFor(finalGames);
      const seasonGroups = new Map();

      games.forEach((game) => {
        const schedule = teamById.get(game.seasonTeamId);
        const seasonId = schedule?.seasonId || 'unknown';
        const entry = seasonGroups.get(seasonId) || {
          seasonId,
          seasonName: seasonById.get(seasonId)?.name || 'Season unavailable',
          schedules: new Set(),
          games: [],
        };
        if (schedule) entry.schedules.add(formatLeagueScheduleName(schedule));
        entry.games.push(game);
        seasonGroups.set(seasonId, entry);
      });

      const seasons = [...seasonGroups.values()]
        .map((entry) => {
          const seasonGames = [...entry.games].sort((a, b) => comparableDate(b.scheduledAt) - comparableDate(a.scheduledAt));
          return {
            seasonId: entry.seasonId,
            seasonName: entry.seasonName,
            scheduleNames: [...entry.schedules],
            games: seasonGames,
            summary: recordFor(seasonGames),
            latestAt: seasonGames[0]?.scheduledAt || '',
          };
        })
        .sort((a, b) => comparableDate(b.latestAt) - comparableDate(a.latestAt));

      const recentForm = finalGames.slice(0, 5).map((game) => ({
        game,
        outcome: gameOutcome(game),
      }));

      return {
        ...group,
        games,
        finalGames,
        upcomingGames,
        awaitingResults,
        recentMeetings,
        nextGame: upcomingGames[0] || null,
        lastGame: finalGames[0] || null,
        summary,
        seasons,
        recentForm,
        scopeLabel,
      };
    })
    .sort((a, b) => {
      if (a.nextGame && b.nextGame) return comparableDate(a.nextGame.scheduledAt) - comparableDate(b.nextGame.scheduledAt);
      if (a.nextGame) return -1;
      if (b.nextGame) return 1;
      const latestDifference = comparableDate(b.lastGame?.scheduledAt) - comparableDate(a.lastGame?.scheduledAt);
      return latestDifference || a.name.localeCompare(b.name);
    });
}

export function findOpponentMatchup(matchups, value) {
  const normalizedSlug = opponentSlug(value);
  return matchups.find((matchup) => matchup.slug === normalizedSlug) || null;
}
