import { describe, expect, it } from 'vitest';
import { mergeCurrentSeasonSnapshot } from '../../scripts/sync-york-central-stats.mjs';

function snapshot(overrides = {}) {
  return {
    source: 'league-snapshot',
    sourceName: 'York Central Ball Hockey League',
    sourceUrl: 'https://www.yorkcentralbhl.com/team/7250-goonsquad',
    capturedAt: '2026-07-29T14:00:00.000Z',
    seasons: [],
    teams: [],
    players: [],
    memberships: [],
    games: [],
    teamGameStats: [],
    playerGameStats: [],
    goalieGameStats: [],
    gameEvents: [],
    teamSeasonSummaries: [],
    playerSeasonStats: [],
    goalieSeasonStats: [],
    detailImport: { requestedGames: 0, importedGames: 0, errors: [] },
    ...overrides,
  };
}

describe('current-season statistics sync', () => {
  it('replaces active-season rows while preserving the historical archive', () => {
    const existing = snapshot({
      seasons: [
        { id: 'summer-2026', current: true, status: 'active' },
        { id: 'spring-2026', current: false, status: 'complete' },
      ],
      teams: [
        { id: 'summer-team', seasonId: 'summer-2026' },
        { id: 'spring-team', seasonId: 'spring-2026' },
      ],
      games: [
        { id: 'summer-game', seasonTeamId: 'summer-team', status: 'scheduled' },
        { id: 'spring-game', seasonTeamId: 'spring-team', status: 'final' },
      ],
    });
    const current = snapshot({
      capturedAt: '2026-07-29T14:30:00.000Z',
      seasons: [{ id: 'summer-2026', current: true, status: 'active' }],
      teams: [{ id: 'summer-team', seasonId: 'summer-2026' }],
      games: [{
        id: 'summer-game',
        seasonTeamId: 'summer-team',
        status: 'final',
        goalsFor: 9,
        goalsAgainst: 4,
      }],
    });

    const merged = mergeCurrentSeasonSnapshot(existing, current);

    expect(merged.games).toEqual([
      expect.objectContaining({ id: 'summer-game', status: 'final', goalsFor: 9 }),
      expect.objectContaining({ id: 'spring-game', status: 'final' }),
    ]);
    expect(merged.seasons).toHaveLength(2);
    expect(merged.teams).toHaveLength(2);
    expect(merged.capturedAt).toBe('2026-07-29T14:30:00.000Z');
  });
});
