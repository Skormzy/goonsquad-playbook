import { describe, expect, it } from 'vitest';
import { mergeStatisticsDatasets } from './statsCloud';

function dataset(overrides = {}) {
  return {
    source: 'league-snapshot',
    seasons: [{ id: 's1' }],
    teams: [{ id: 't1', seasonId: 's1', source: 'league' }],
    players: [{ id: 'static-player', externalId: '10', source: 'league' }],
    memberships: [{ id: 'static-membership', playerId: 'static-player', seasonTeamId: 't1' }],
    games: [{ id: 'static-game', externalId: '20', source: 'league', seasonTeamId: 't1' }],
    teamGameStats: [],
    playerGameStats: [],
    goalieGameStats: [],
    gameEvents: [],
    teamSeasonSummaries: [{ seasonTeamId: 't1', source: 'league' }],
    playerSeasonStats: [{ id: 'static-total', playerId: 'static-player', seasonTeamId: 't1', source: 'league' }],
    goalieSeasonStats: [],
    ...overrides,
  };
}

describe('statistics cloud merge', () => {
  it('ignores an incomplete league import and keeps team-managed additions', () => {
    const result = mergeStatisticsDatasets(dataset(), dataset({
      source: 'cloud',
      players: [
        { id: 'partial-league-player', source: 'league' },
        { id: 'team-player', source: 'team' },
      ],
      memberships: [
        { id: 'partial-membership', playerId: 'partial-league-player' },
        { id: 'team-membership', playerId: 'team-player' },
      ],
      games: [
        { id: 'partial-game', source: 'league' },
        { id: 'team-game', source: 'team' },
      ],
      playerSeasonStats: [],
      teamSeasonSummaries: [],
    }));
    expect(result.players.map((player) => player.id)).toEqual(['static-player', 'team-player']);
    expect(result.memberships.map((membership) => membership.id)).toEqual(['static-membership', 'team-membership']);
    expect(result.games.map((game) => game.id)).toEqual(['static-game', 'team-game']);
    expect(result.leagueImportComplete).toBe(false);
  });

  it('uses a complete cloud league import as the authoritative copy', () => {
    const result = mergeStatisticsDatasets(dataset(), dataset({
      source: 'cloud',
      players: [{ id: 'cloud-player', source: 'league' }],
      memberships: [{ id: 'cloud-membership', playerId: 'cloud-player' }],
      games: [{ id: 'cloud-game', source: 'league' }],
      playerSeasonStats: [{ id: 'cloud-total', source: 'league' }],
      teamSeasonSummaries: [{ seasonTeamId: 't1', source: 'league' }],
    }));
    expect(result.players.map((player) => player.id)).toEqual(['cloud-player']);
    expect(result.games.map((game) => game.id)).toEqual(['cloud-game']);
    expect(result.playerSeasonStats.map((line) => line.id)).toEqual(['cloud-total']);
    expect(result.leagueImportComplete).toBe(true);
  });

  it('does not discard local game sheets when cloud totals are present but deep detail is incomplete', () => {
    const base = dataset({
      teamGameStats: [{ gameId: 'static-game', source: 'league' }],
      playerGameStats: [{ id: 'static-player-line', gameId: 'static-game', source: 'league' }],
      goalieGameStats: [{ id: 'static-goalie-line', gameId: 'static-game', source: 'league' }],
      gameEvents: [{ id: 'static-event', gameId: 'static-game', source: 'league' }],
    });
    const result = mergeStatisticsDatasets(base, dataset({
      source: 'cloud',
      players: [{ id: 'cloud-player', source: 'league' }],
      memberships: [{ id: 'cloud-membership', playerId: 'cloud-player' }],
      games: [{ id: 'cloud-game', source: 'league' }],
      playerSeasonStats: [{ id: 'cloud-total', source: 'league' }],
      teamSeasonSummaries: [{ seasonTeamId: 't1', source: 'league' }],
    }));
    expect(result.leagueImportComplete).toBe(false);
    expect(result.games.map((game) => game.id)).toEqual(['static-game']);
    expect(result.gameEvents.map((event) => event.id)).toEqual(['static-event']);
  });

  it('does not let an older complete cloud import replace a fresher runtime snapshot', () => {
    const base = dataset({
      capturedAt: '2026-07-29T13:00:00.000Z',
    });
    const result = mergeStatisticsDatasets(base, dataset({
      source: 'cloud',
      players: [{ id: 'cloud-player', source: 'league' }],
      memberships: [{ id: 'cloud-membership', playerId: 'cloud-player' }],
      games: [{
        id: 'cloud-game',
        source: 'league',
        verifiedAt: '2026-07-22T13:00:00.000Z',
      }],
      playerSeasonStats: [{ id: 'cloud-total', source: 'league' }],
      teamSeasonSummaries: [{ seasonTeamId: 't1', source: 'league' }],
    }));

    expect(result.games.map((game) => game.id)).toEqual(['static-game']);
    expect(result.leagueImportFresh).toBe(false);
    expect(result.leagueImportComplete).toBe(false);
  });
});
