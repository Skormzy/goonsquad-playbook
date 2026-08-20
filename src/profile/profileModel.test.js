import { describe, expect, it } from 'vitest';
import {
  memberProfileSnapshot,
  playerRosterCandidates,
  publicPlayerProfileSnapshot,
} from './profileModel';
import { OFFICIAL_STATS_DATASET } from '../stats/statsSeed';
import {
  buildPlayerIdentityIndex,
  canonicalPlayerIdentityId,
} from '../stats/playerIdentity';

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

  it('publishes separate regular-season, playoff, tournament, and combined profile totals', () => {
    const scopedDataset = {
      ...dataset,
      playerSeasonStats: [
        ...dataset.playerSeasonStats,
        { id: 's4', seasonTeamId: 'summer-mon', stage: 'playoffs', playerId: 'current-id', gamesPlayed: 2, goals: 1, assists: 3, points: 4, penaltyMinutes: 2 },
      ],
    };
    const tournaments = [{
      id: 'cup',
      name: 'Summer Cup',
      shortName: 'Cup 2026',
      startDate: '2026-08-01',
      division: 'Men\'s Rec',
      playerStats: [{ name: 'Sam Member', gamesPlayed: 3, goals: 2, assists: 2, points: 4, penaltyMinutes: 0 }],
      goalieStats: [],
    }];
    const profile = publicPlayerProfileSnapshot(
      scopedDataset,
      'current-id',
      '2026-06-30T12:00:00Z',
      { tournaments },
    );

    expect(profile.competitionStats.regular.careerField).toMatchObject({ gamesPlayed: 4, points: 8 });
    expect(profile.competitionStats.playoffs.careerField).toMatchObject({ gamesPlayed: 2, points: 4 });
    expect(profile.competitionStats.tournaments.careerField).toMatchObject({ gamesPlayed: 3, points: 4 });
    expect(profile.competitionStats.all.careerField).toMatchObject({ gamesPlayed: 9, points: 16 });
    expect(profile.availableCompetitionScopes).toEqual(['regular', 'playoffs', 'tournaments', 'all']);
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

  it.each([
    ['Adrian Bockner', 'ycbhl-player-25232', 84, 12, 21, 33, 2],
    ['Andrew Lorenowicz', 'ycbhl-player-308', 237, 0, 16, 16, 2],
    ['Matthew Stott', 'ycbhl-player-25348', 39, 3, 4, 7, 1],
    ['Michael Thomas Kerrane', 'ycbhl-player-25741', 62, 5, 5, 10, 2],
    ['Michael Woods', 'ycbhl-player-25796', 4, 5, 11, 16, 2],
    ['Michael Yen', 'ycbhl-player-26046', 20, 3, 5, 8, 2],
    ['Ryan Hunt', 'ycbhl-player-307', 61, 4, 4, 8, 2],
    ['Stephen Macdonald', 'ycbhl-player-25733', 59, 5, 6, 11, 2],
    ['Zachary Sher', 'ycbhl-player-25559', 23, 6, 9, 15, 2],
  ])('combines every reviewed archive identity for %s', (
    displayName,
    playerId,
    gamesPlayed,
    goals,
    assists,
    points,
    sourceCount,
  ) => {
    const profile = publicPlayerProfileSnapshot(
      OFFICIAL_STATS_DATASET,
      playerId,
      '2026-07-29T12:00:00Z',
    );

    expect(profile.primaryPlayer.displayName).toBe(displayName);
    expect(profile.careerField).toMatchObject({ gamesPlayed, goals, assists, points });
    expect(profile.officialProfiles).toHaveLength(sourceCount);
  });

  it.each([
    ['Adrian Bockner', 'Adrian Bockner', 'ycbhl-player-25232'],
    ['Andrew Lorenowicz', 'Andrew Lorenowicz', 'ycbhl-player-308'],
    ['Andy Lorenowicz', 'Andrew Lorenowicz', 'ycbhl-player-308'],
    ['Mathew Grenier', 'Mathew Grenier', 'ycbhl-player-25650'],
    ['Matthew Grenier', 'Mathew Grenier', 'ycbhl-player-25650'],
    ['Matthew Stott', 'Matthew Stott', 'ycbhl-player-25348'],
    ['Matt Stott', 'Matthew Stott', 'ycbhl-player-25348'],
    ['Michael Thomas Kerrane', 'Michael Thomas Kerrane', 'ycbhl-player-25741'],
    ['Michael Kerrane', 'Michael Thomas Kerrane', 'ycbhl-player-25741'],
    ['Michael Woods', 'Michael Woods', 'ycbhl-player-25796'],
    ['Michael Yen', 'Michael Yen', 'ycbhl-player-26046'],
    ['Mike Yen', 'Michael Yen', 'ycbhl-player-26046'],
    ['Ryan Hunt', 'Ryan Hunt', 'ycbhl-player-307'],
    ['Stephen Macdonald', 'Stephen Macdonald', 'ycbhl-player-25733'],
    ['Steve Macdonald', 'Stephen Macdonald', 'ycbhl-player-25733'],
    ['Zachary Sher', 'Zachary Sher', 'ycbhl-player-25559'],
    ['Zack Sher', 'Zachary Sher', 'ycbhl-player-25559'],
  ])('returns one canonical roster candidate when searching for %s', (
    query,
    displayName,
    playerId,
  ) => {
    const rosterMatches = playerRosterCandidates(OFFICIAL_STATS_DATASET, {
      includeHistory: true,
      query,
    });

    expect(rosterMatches).toHaveLength(1);
    expect(rosterMatches[0]).toMatchObject({ id: playerId, displayName });
  });

  it('builds a durable public profile for every published roster identity', () => {
    const identityIndex = buildPlayerIdentityIndex(OFFICIAL_STATS_DATASET.players);
    const profiles = OFFICIAL_STATS_DATASET.players.map((player) => (
      publicPlayerProfileSnapshot(OFFICIAL_STATS_DATASET, player.id, '2026-07-29T12:00:00Z')
    ));

    expect(profiles).toHaveLength(OFFICIAL_STATS_DATASET.players.length);
    profiles.forEach((profile, index) => {
      const sourcePlayer = OFFICIAL_STATS_DATASET.players[index];
      expect(profile).not.toBeNull();
      expect(profile.primaryPlayer.id).toBe(
        canonicalPlayerIdentityId(identityIndex, sourcePlayer.id),
      );
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
