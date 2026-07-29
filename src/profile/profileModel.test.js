import { describe, expect, it } from 'vitest';
import { memberProfileSnapshot, playerRosterCandidates } from './profileModel';

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
});
