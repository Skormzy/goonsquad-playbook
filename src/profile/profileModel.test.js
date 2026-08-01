import { describe, expect, it } from 'vitest';
import {
  memberProfileSnapshot,
  playerRosterCandidates,
  publicPlayerProfileSnapshot,
} from './profileModel';
import { OFFICIAL_STATS_DATASET } from '../stats/statsSeed';

const dataset = {
  seasons: [
    { id: 'summer-2026', name: 'Summer 2026', startDate: '2026-05-01', current: true },
    { id: 'winter-2025', name: 'Winter 2025', startDate: '2025-01-01', current: false },
  ],
  teams: [
    { id: 'summer-mon', seasonId: 'summer-2026', scheduleLabel: 'MON' },
    { id: 'winter-sun', seasonId: 'winter-2025', scheduleLabel: 'SUN' },
  ],
  players: [
    { id: 'current-id', externalId: '101', displayName: 'Sam Member', active: true, primaryPosition: 'W' },
    { id: 'history-id', externalId: '88', displayName: 'Sam Member', active: false, primaryPosition: 'C' },
    { id: 'different-sam', externalId: '77', displayName: 'Sam Member', active: false, primaryPosition: 'D' },
    { id: 'teammate', externalId: '202', displayName: 'Alex Teammate', active: true, primaryPosition: 'D' },
  ],
  memberships: [
    { id: 'm1', seasonTeamId: 'summer-mon', playerId: 'current-id', position: 'W', jerseyNumber: '19', active: true },
    { id: 'm2', seasonTeamId: 'winter-sun', playerId: 'history-id', position: 'C', jerseyNumber: '9', active: true },
    { id: 'm3', seasonTeamId: 'winter-sun', playerId: 'different-sam', position: 'D', jerseyNumber: '4', active: true },
    { id: 'm4', seasonTeamId: 'summer-mon', playerId: 'teammate', position: 'D', jerseyNumber: '5', active: true },
  ],
  playerSeasonStats: [
    { id: 's1', seasonTeamId: 'summer-mon', stage: 'regular', playerId: 'current-id', gamesPlayed: 4, goals: 3, assists: 5, points: 8, penaltyMinutes: 2, powerPlayGoals: 1, shortHandedGoals: 0, emptyNetGoals: 0 },
    { id: 's2', seasonTeamId: 'winter-sun', stage: 'regular', playerId: 'history-id', gamesPlayed: 6, goals: 4, assists: 3, points: 7, penaltyMinutes: 4, powerPlayGoals: 0, shortHandedGoals: 1, emptyNetGoals: 0 },
    { id: 's3', seasonTeamId: 'winter-sun', stage: 'regular', playerId: 'different-sam', gamesPlayed: 7, goals: 20, assists: 20, points: 40, penaltyMinutes: 0, powerPlayGoals: 0, shortHandedGoals: 0, emptyNetGoals: 0 },
  ],
  goalieSeasonStats: [],
  games: [
    { id: 'g1', seasonTeamId: 'summer-mon', scheduledAt: '2026-06-01T20:00:00Z', opponent: 'Raiders', status: 'final', goalsFor: 5, goalsAgainst: 3 },
    { id: 'g2', seasonTeamId: 'summer-mon', scheduledAt: '2026-07-01T20:00:00Z', opponent: 'Rivals', status: 'scheduled', goalsFor: null, goalsAgainst: null },
  ],
  playerGameStats: [
    { id: 'l1', gameId: 'g1', playerId: 'current-id', gamesPlayed: 1, goals: 1, assists: 2 },
  ],
  goalieGameStats: [],
};

describe('member profile model', () => {
  it('shows the current roster first and keeps historical same-name records distinct', () => {
    const current = playerRosterCandidates(dataset);
    expect(current.map((candidate) => candidate.id)).toEqual(['teammate', 'current-id']);

    const history = playerRosterCandidates(dataset, { includeHistory: true, query: 'Sam Member' });
    expect(history.map((candidate) => candidate.id)).toEqual(['current-id', 'different-sam', 'history-id']);
  });

  it('aggregates only the league identities explicitly linked to the member', () => {
    const claims = [
      { playerId: 'cloud-current', player: { externalId: '101' }, status: 'linked', primary: true },
      { playerId: 'cloud-history', player: { externalId: '88' }, status: 'linked', primary: false },
    ];
    const profile = memberProfileSnapshot(dataset, claims, '2026-06-30T12:00:00Z');

    expect(profile.primaryPlayer.externalId).toBe('101');
    expect(profile.linkStatus).toBe('linked');
    expect(profile.seasonsPlayed).toBe(2);
    expect(profile.careerField).toMatchObject({ gamesPlayed: 10, goals: 7, assists: 8, points: 15 });
    expect(profile.careerField.points).not.toBe(55);
    expect(profile.recentGames[0]).toMatchObject({ result: 'W', points: 3 });
    expect(profile.nextGame.id).toBe('g2');
  });

  it('never labels an unresolved past fixture as the next game', () => {
    const claims = [
      { playerId: 'cloud-current', player: { externalId: '101' }, status: 'linked', primary: true },
    ];
    const profile = memberProfileSnapshot(dataset, claims, '2026-07-29T12:00:00Z');

    expect(profile.nextGame).toBeNull();
  });

  it('builds a shareable official profile for one exact roster identity', () => {
    const profile = publicPlayerProfileSnapshot(
      dataset,
      'current-id',
      '2026-06-30T12:00:00Z',
    );

    expect(profile.primaryPlayer.displayName).toBe('Sam Member');
    expect(profile.players.map((player) => player.id)).toEqual(['current-id']);
    expect(profile.jerseyNumber).toBe('19');
    expect(profile.position).toBe('W');
    expect(profile.careerField).toMatchObject({
      gamesPlayed: 4,
      goals: 3,
      assists: 5,
      points: 8,
    });
  });

  it('returns null for an unknown public player route', () => {
    expect(publicPlayerProfileSnapshot(dataset, 'missing')).toBeNull();
  });

  it('combines Mathew Grenier across both verified Goonsquad league archives', () => {
    const profile = publicPlayerProfileSnapshot(
      OFFICIAL_STATS_DATASET,
      'ycbhl-player-25650',
      '2026-07-29T12:00:00Z',
    );

    expect(profile.players.map((player) => player.id)).toEqual(expect.arrayContaining([
      'ycbhl-player-25650',
      'gtbhl-player-88577',
    ]));
    expect(profile.leagueNames).toEqual(expect.arrayContaining([
      'YCBHL',
      'Greater Toronto Ball Hockey League',
    ]));
    expect(profile.seasonsPlayed).toBe(6);
    expect(profile.careerField).toMatchObject({
      gamesPlayed: 49,
      goals: 54,
      assists: 39,
      points: 93,
    });
    expect(profile.officialProfiles).toHaveLength(2);

    const rosterMatches = playerRosterCandidates(OFFICIAL_STATS_DATASET, {
      includeHistory: true,
      query: 'Mathew Grenier',
    });
    expect(rosterMatches).toHaveLength(1);
    expect(rosterMatches[0]).toMatchObject({
      id: 'ycbhl-player-25650',
      identityPlayerIds: expect.arrayContaining([
        'ycbhl-player-25650',
        'gtbhl-player-88577',
      ]),
    });
  });

  it('builds a durable public profile for every published roster identity', () => {
    const profiles = OFFICIAL_STATS_DATASET.players.map((player) => (
      publicPlayerProfileSnapshot(OFFICIAL_STATS_DATASET, player.id, '2026-07-29T12:00:00Z')
    ));

    expect(profiles).toHaveLength(OFFICIAL_STATS_DATASET.players.length);
    profiles.forEach((profile, index) => {
      const sourcePlayer = OFFICIAL_STATS_DATASET.players[index];
      expect(profile).not.toBeNull();
      expect(profile.primaryPlayer).toMatchObject({
        id: sourcePlayer.id,
        displayName: sourcePlayer.displayName,
      });
      expect(profile.players.map((player) => player.id)).toContain(sourcePlayer.id);
      expect(profile.careerField.points).toBe(
        profile.careerField.goals + profile.careerField.assists,
      );
      expect(profile.seasonsPlayed).toBeGreaterThanOrEqual(0);
      expect(new Set(profile.recentGames.map(({ game }) => game.id)).size).toBe(
        profile.recentGames.length,
      );
      expect(profile.recentGames.map(({ game }) => game.scheduledAt)).toEqual(
        profile.recentGames
          .map(({ game }) => game.scheduledAt)
          .slice()
          .sort((a, b) => String(b).localeCompare(String(a))),
      );
    });
  });
});
