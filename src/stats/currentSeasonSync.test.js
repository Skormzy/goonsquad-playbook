import { describe, expect, it } from 'vitest';
import {
  divisionStandings,
  mergeCurrentSeasonSnapshot,
} from '../../scripts/sync-york-central-stats.mjs';

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
    standings: [],
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
      standings: [
        { seasonTeamId: 'summer-team', rank: 8, teamName: 'GOONSQUAD', points: 0 },
        { seasonTeamId: 'spring-team', rank: 4, teamName: 'GOONSQUAD', points: 7 },
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
      standings: [
        { seasonTeamId: 'summer-team', rank: 7, teamName: 'GOONSQUAD', points: 2 },
      ],
    });

    const merged = mergeCurrentSeasonSnapshot(existing, current);

    expect(merged.games).toEqual([
      expect.objectContaining({ id: 'summer-game', status: 'final', goalsFor: 9 }),
      expect.objectContaining({ id: 'spring-game', status: 'final' }),
    ]);
    expect(merged.seasons).toHaveLength(2);
    expect(merged.teams).toHaveLength(2);
    expect(merged.standings).toEqual([
      expect.objectContaining({ seasonTeamId: 'summer-team', rank: 7, points: 2 }),
      expect.objectContaining({ seasonTeamId: 'spring-team', rank: 4, points: 7 }),
    ]);
    expect(merged.capturedAt).toBe('2026-07-29T14:30:00.000Z');
  });

  it('captures every official standings row and marks the selected Goon Squad team', () => {
    const html = `
      <div class="stats-box standings">
        <table>
          <tr><th>Team</th><th>GP</th><th>W</th><th>L</th><th>T</th><th>PTS</th></tr>
          <tr><td><a href="/team/7248-red-wolves">RED WOLVES</a></td><td>12</td><td>11</td><td>1</td><td>0</td><td>22</td></tr>
          <tr><td><a href="/team/7250-goonsquad">GOONSQUAD</a></td><td>11</td><td>0</td><td>11</td><td>0</td><td>0</td></tr>
        </table>
      </div>
    `;

    expect(divisionStandings('/team/7250-goonsquad', html, 'summer-2026-mon-thu')).toEqual([
      expect.objectContaining({
        seasonTeamId: 'summer-2026-mon-thu',
        rank: 1,
        teamName: 'RED WOLVES',
        teamExternalId: '7248',
        gamesPlayed: 12,
        points: 22,
        isGoonSquad: false,
      }),
      expect.objectContaining({
        rank: 2,
        teamName: 'GOONSQUAD',
        teamExternalId: '7250',
        gamesPlayed: 11,
        points: 0,
        isGoonSquad: true,
      }),
    ]);
  });
});
