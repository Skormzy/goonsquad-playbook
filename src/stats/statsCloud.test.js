import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';

const cloudState = vi.hoisted(() => ({ client: null }));

vi.mock('../playmaker/playmakerCloud', () => ({
  getPlaymakerCloudClient: () => cloudState.client,
  playmakerCloudConfigured: true,
}));

import {
  loadStatisticsDataset,
  mergeStatisticsDatasets,
  PUBLIC_STATISTICS_QUERIES,
  readAllPages,
} from './statsCloud';

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

afterEach(() => {
  cloudState.client = null;
  vi.unstubAllGlobals();
});

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

describe('statistics cloud pagination', () => {
  it('loads every row when a table exceeds the Supabase default row limit', async () => {
    const sourceRows = Array.from({ length: 2505 }, (_, index) => ({ id: `row-${index}` }));
    const requestedRanges = [];
    const queryFactory = () => ({
      range(from, to) {
        requestedRanges.push([from, to]);
        return Promise.resolve({
          data: sourceRows.slice(from, to + 1),
          error: null,
        });
      },
    });

    const rows = await readAllPages(queryFactory, 1000);

    expect(rows).toEqual(sourceRows);
    expect(requestedRanges).toEqual([
      [0, 999],
      [1000, 1999],
      [2000, 2999],
    ]);
  });

  it('requests one final empty page when the row count is an exact page multiple', async () => {
    const sourceRows = Array.from({ length: 2000 }, (_, index) => ({ id: index }));
    const requestedRanges = [];
    const queryFactory = () => ({
      range(from, to) {
        requestedRanges.push([from, to]);
        return Promise.resolve({
          data: sourceRows.slice(from, to + 1),
          error: null,
        });
      },
    });

    await expect(readAllPages(queryFactory, 1000)).resolves.toHaveLength(2000);
    expect(requestedRanges).toEqual([
      [0, 999],
      [1000, 1999],
      [2000, 2999],
    ]);
  });

  it('fails closed when any page returns a Supabase error', async () => {
    const failure = new Error('statistics page failed');
    const queryFactory = () => ({
      range(from) {
        return Promise.resolve(from === 0
          ? { data: Array.from({ length: 2 }, (_, id) => ({ id })), error: null }
          : { data: null, error: failure });
      },
    });

    await expect(readAllPages(queryFactory, 2)).rejects.toThrow('statistics page failed');
  });
});

describe('public statistics projection', () => {
  it('requests only explicit publishable columns from safe projection relations', async () => {
    const requests = [];
    cloudState.client = {
      from(relation) {
        const request = { relation, columns: null, ranges: [] };
        requests.push(request);
        const query = {
          select(columns) {
            request.columns = columns;
            return query;
          },
          order() {
            return query;
          },
          range(from, to) {
            request.ranges.push([from, to]);
            return Promise.resolve({ data: [], error: null });
          },
        };
        return query;
      },
    };
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => dataset(),
    })));

    await loadStatisticsDataset({ useCloudProjection: true });

    expect(requests).toHaveLength(Object.keys(PUBLIC_STATISTICS_QUERIES).length);
    expect(requests.map(({ relation }) => relation)).toEqual(
      Object.values(PUBLIC_STATISTICS_QUERIES).map(({ relation }) => relation),
    );

    const forbiddenColumns = new Set([
      '*',
      'notes',
      'verified_by',
      'created_at',
      'updated_at',
      'user_id',
    ]);
    requests.forEach(({ relation, columns, ranges }) => {
      expect(relation).toMatch(/^public_stats_/);
      expect(columns).toBe(PUBLIC_STATISTICS_QUERIES[
        Object.keys(PUBLIC_STATISTICS_QUERIES).find(
          (key) => PUBLIC_STATISTICS_QUERIES[key].relation === relation,
        )
      ].columns);
      columns.split(',').forEach((column) => {
        expect(forbiddenColumns.has(column.trim())).toBe(false);
      });
      expect(ranges).toEqual([[0, 999]]);
    });
  });

  it('contains no wildcard or sensitive field in the public query contract', () => {
    const serialized = Object.values(PUBLIC_STATISTICS_QUERIES)
      .map(({ relation, columns }) => `${relation}:${columns}`)
      .join('\n');

    expect(serialized).not.toMatch(/select\(\s*['"]?\*/i);
    expect(serialized).not.toMatch(/(^|[,:\s])(notes|verified_by|created_at|updated_at|user_id)([,:\s]|$)/i);
    expect(Object.values(PUBLIC_STATISTICS_QUERIES).every(
      ({ relation }) => relation.startsWith('public_stats_'),
    )).toBe(true);
  });

  it('keeps the runtime dataset when the projection migration is not deployed yet', async () => {
    cloudState.client = {
      from() {
        const query = {
          select() {
            return query;
          },
          order() {
            return query;
          },
          range() {
            return Promise.resolve({
              data: null,
              error: new Error('relation public_stats_seasons does not exist'),
            });
          },
        };
        return query;
      },
    };
    const runtimeDataset = dataset({
      source: 'runtime-release-snapshot',
      games: [{ id: 'runtime-game', source: 'league', seasonTeamId: 't1' }],
    });
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => runtimeDataset,
    })));

    await expect(loadStatisticsDataset({ useCloudProjection: true })).resolves.toBe(runtimeDataset);
  });

  it('revokes direct reads and omits private fields from the SQL projections', () => {
    const migration = readFileSync(
      new URL('../../supabase/migrations/202607290002_public_statistics_projection.sql', import.meta.url),
      'utf8',
    );
    const gamesView = migration.match(
      /create or replace view public\.public_stats_games[\s\S]*?(?=create or replace view public\.public_stats_team_game_stats)/,
    )?.[0] || '';
    const membershipsView = migration.match(
      /create or replace view public\.public_stats_memberships[\s\S]*?(?=create or replace view public\.public_stats_games)/,
    )?.[0] || '';
    const eventsView = migration.match(
      /create or replace view public\.public_stats_game_events[\s\S]*?(?=do \$\$)/,
    )?.[0] || '';

    expect(migration).toMatch(/revoke select on table[\s\S]*from anon, authenticated;/);
    expect(gamesView).not.toMatch(/\bg\.notes\b|\bverified_by\b/);
    expect(membershipsView).not.toMatch(/\brm\.notes\b/);
    expect(eventsView).not.toMatch(/\bge\.detail\s+as\s+detail\b/i);
    expect(eventsView).toMatch(/ge\.event_type <> 'note'/);
    expect(eventsView).toContain("'scorer', ge.detail -> 'scorer'");
    expect(eventsView).toContain("'penalty', ge.detail -> 'penalty'");
  });
});
