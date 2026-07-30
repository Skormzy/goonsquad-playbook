import officialSnapshot from './yorkCentralSnapshot.json';

export const EMPTY_STATS_DATASET = Object.freeze({
  source: 'structure',
  seasons: Object.freeze([
    Object.freeze({
      id: 'summer-2026',
      slug: 'summer-2026',
      name: 'Summer 2026',
      startDate: null,
      endDate: null,
      status: 'active',
      current: true,
    }),
  ]),
  teams: Object.freeze([
    Object.freeze({
      id: 'summer-2026-monday',
      seasonId: 'summer-2026',
      name: 'Monday Team',
      scheduleLabel: 'Monday',
      division: '',
    }),
  ]),
  players: Object.freeze([]),
  memberships: Object.freeze([]),
  games: Object.freeze([]),
  teamGameStats: Object.freeze([]),
  playerGameStats: Object.freeze([]),
  goalieGameStats: Object.freeze([]),
  gameEvents: Object.freeze([]),
  teamSeasonSummaries: Object.freeze([]),
  standings: Object.freeze([]),
  playerSeasonStats: Object.freeze([]),
  goalieSeasonStats: Object.freeze([]),
});

export const OFFICIAL_STATS_DATASET = Object.freeze(officialSnapshot);
