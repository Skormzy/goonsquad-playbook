import { describe, expect, it } from 'vitest';
import { memberProfileSnapshot, playerRosterCandidates, publicPlayerProfileSnapshot } from '../profile/profileModel';
import { buildAllTimeRecords } from './allTimeRecordsModel';
import { statsSnapshot } from './statsModel';
import { applyPublicPlayerDetails, resolvePlayerNumberAssignments } from './publicPlayerDetails';

const dataset = {
  seasons: [{ id: 'season', current: true }],
  teams: [{ id: 'team', seasonId: 'season' }],
  players: [
    { id: 'ycbhl-player-307', externalId: '307', displayName: 'Ryan Hunt', primaryPosition: 'C' },
    { id: 'gtbhl-player-84495', externalId: 'gtbhl:84495', displayName: 'Ryan Hunt', primaryPosition: 'W' },
    { id: 'unrelated', displayName: 'Ryan Hunt', primaryPosition: 'G' },
  ],
  memberships: [{ id: 'roster', playerId: 'gtbhl-player-84495', seasonTeamId: 'team', position: 'W' }],
  games: [],
  playerSeasonStats: [{ playerId: 'gtbhl-player-84495', seasonTeamId: 'team', gamesPlayed: 1, goals: 1, assists: 0 }],
};

describe('public player position assignments', () => {
  it.each(['D', null])('propagates the newest saved position %s across verified aliases and public views', (primaryPosition) => {
    const result = applyPublicPlayerDetails(dataset, [
      { player_id: 'old-cloud-id', external_id: '307', primary_position: 'G', primary_position_updated_at: '2026-09-22T12:00:00Z' },
      { player_id: 'new-cloud-id', external_id: 'gtbhl:84495', primary_position: primaryPosition, primary_position_updated_at: '2026-09-23T12:00:00Z' },
    ]);

    result.players.slice(0, 2).forEach((player) => expect(player).toMatchObject({
      primaryPosition,
      primaryPositionUpdatedAt: '2026-09-23T12:00:00Z',
      primaryPositionAuthoritative: true,
    }));
    expect(result.players[2].primaryPosition).toBe('G');
    expect(result.memberships[0].position).toBe('W');
    expect(dataset.players[0].primaryPosition).toBe('C');
    expect(playerRosterCandidates(result)[0].position).toBe(primaryPosition);
    expect(publicPlayerProfileSnapshot(result, 'gtbhl-player-84495').position).toBe(primaryPosition);
    expect(buildAllTimeRecords(result).skaters[0].position).toBe(primaryPosition);
  });

  it('keeps historical per-source positions without an explicit assignment timestamp', () => {
    const result = applyPublicPlayerDetails(dataset, [
      { external_id: '307', primary_position: null },
      { external_id: 'gtbhl:84495', primary_position: 'D' },
    ]);
    expect(result.players.map((player) => player.primaryPosition)).toEqual(['C', 'D', 'G']);
    expect(playerRosterCandidates(result)[0].position).toBe('W');
  });

  it('resolves admin snapshot positions with the same alias and clear rules', () => {
    const result = resolvePlayerNumberAssignments(dataset.players.map((player) => (
      player.id === 'gtbhl-player-84495'
        ? { ...player, primaryPosition: null, primaryPositionUpdatedAt: '2026-09-23T12:00:00Z' }
        : player
    )));
    expect(result.slice(0, 2).map((player) => player.primaryPosition)).toEqual([null, null]);
    expect(result[2].primaryPosition).toBe('G');
  });
});

describe('public manual player merges', () => {
  const original = {
    seasons: [{ id: 'season', name: 'Season', current: true }],
    teams: [{ id: 'team', seasonId: 'season', scheduleLabel: 'MON' }],
    players: [
      { id: 'ycbhl-player-1', externalId: '1', displayName: 'Typo Name', jerseyNumber: '12', primaryPosition: 'W' },
      { id: 'ycbhl-player-99', externalId: '99', displayName: 'Correct Name', jerseyNumber: '99', primaryPosition: 'G' },
    ],
    memberships: [
      { id: 'old-roster', playerId: 'ycbhl-player-1', seasonTeamId: 'team', position: 'W', jerseyNumber: '12' },
      { id: 'correct-roster', playerId: 'ycbhl-player-99', seasonTeamId: 'team', position: 'G', jerseyNumber: '99' },
    ],
    playerSeasonStats: [
      { id: 'old-season', playerId: 'ycbhl-player-1', seasonTeamId: 'team', gamesPlayed: 2, goals: 3, assists: 4, points: 7 },
      { id: 'correct-season', playerId: 'ycbhl-player-99', seasonTeamId: 'team', gamesPlayed: 1, goals: 2, assists: 1, points: 3 },
    ],
    goalieSeasonStats: [
      { id: 'old-goalie', playerId: 'ycbhl-player-1', seasonTeamId: 'team', gamesPlayed: 2, wins: 1, losses: 1, ties: 0, goalsAgainst: 5, shotsAgainst: 40, shutouts: 0, minutesPlayed: 60 },
      { id: 'correct-goalie', playerId: 'ycbhl-player-99', seasonTeamId: 'team', gamesPlayed: 1, wins: 1, losses: 0, ties: 0, goalsAgainst: 1, shotsAgainst: 20, shutouts: 0, minutesPlayed: 30 },
    ],
    games: [
      { id: 'old-game', seasonTeamId: 'team', status: 'final', scheduledAt: '2026-06-01' },
      { id: 'correct-game', seasonTeamId: 'team', status: 'final', scheduledAt: '2026-06-02' },
    ],
    playerGameStats: [
      { id: 'old-line', gameId: 'old-game', playerId: 'ycbhl-player-1', gamesPlayed: 1, goals: 3, assists: 4 },
      { id: 'correct-line', gameId: 'correct-game', playerId: 'ycbhl-player-99', gamesPlayed: 1, goals: 2, assists: 1 },
    ],
    goalieGameStats: [],
    teamGameStats: [],
    teamSeasonSummaries: [],
  };
  const metadata = [
    {
      player_id: 'cloud-old', external_id: '1', display_name: 'Typo Name',
      merged_into_player_id: 'cloud-correct', merged_into_external_id: '99', merged_into_display_name: 'Correct Name',
      jersey_number: '12', jersey_number_updated_at: '2026-09-22T12:00:00Z',
      primary_position: 'W', primary_position_updated_at: '2026-09-22T12:00:00Z',
      avatar_url: 'https://example.com/old-avatar.jpg',
    },
    {
      player_id: 'cloud-correct', external_id: '99', display_name: 'Correct Name', canonical_display_name: 'Correct Name',
      merged_into_player_id: null,
      jersey_number: null, jersey_number_updated_at: '2026-09-23T12:00:00Z',
      primary_position: null, primary_position_updated_at: '2026-09-23T12:00:00Z',
    },
  ];

  it('maps UUID merges before aggregating statistics and keeps old profile links and source names searchable', () => {
    const result = applyPublicPlayerDetails(original, metadata);
    const candidates = playerRosterCandidates(result, { includeHistory: true, query: 'Typo Name' });
    expect(candidates).toHaveLength(1);
    expect(candidates[0]).toMatchObject({ id: 'ycbhl-player-99', displayName: 'Correct Name', position: null, jerseyNumber: null });
    const stats = statsSnapshot(result, 'season', 'team');
    expect(stats.fieldPlayers).toHaveLength(1);
    expect(stats.fieldPlayers[0]).toMatchObject({ playerId: 'ycbhl-player-99', displayName: 'Correct Name', gamesPlayed: 3, goals: 5, assists: 5, points: 10 });
    expect(stats.goalies).toHaveLength(1);
    expect(stats.goalies[0]).toMatchObject({ gamesPlayed: 3, wins: 2, goalsAgainst: 6, shotsAgainst: 60, minutesPlayed: 90 });
    expect(stats.goalies[0].savePercentage).toBeCloseTo(0.9);
    expect(stats.goalies[0].goalsAgainstAverage).toBe(2);
    const profile = publicPlayerProfileSnapshot(result, 'ycbhl-player-1');
    expect(profile.primaryPlayer).toMatchObject({ id: 'ycbhl-player-99', displayName: 'Correct Name', avatarUrl: 'https://example.com/old-avatar.jpg' });
    expect(profile.careerField).toMatchObject({ gamesPlayed: 3, goals: 5, assists: 5, points: 10 });
    expect(profile.careerGoalie).toMatchObject({ gamesPlayed: 3, wins: 2, goalsAgainst: 6, shotsAgainst: 60 });
    expect(profile.recentGames).toHaveLength(2);
    expect(publicPlayerProfileSnapshot(result, 'cloud-old').primaryPlayer.id).toBe('ycbhl-player-99');
    expect(publicPlayerProfileSnapshot(result, 'cloud-correct').primaryPlayer.id).toBe('ycbhl-player-99');
    expect(memberProfileSnapshot(result, [{ playerId: 'cloud-old', primary: true }]).careerField.points).toBe(10);
    expect(profile.position).toBeNull();
    expect(profile.jerseyNumber).toBeNull();
    expect(buildAllTimeRecords(result).skaters).toHaveLength(1);
    expect(buildAllTimeRecords(result).skaters[0]).toMatchObject({ playerId: 'ycbhl-player-99', displayName: 'Correct Name', gamesPlayed: 3, points: 10 });
    expect(result.playerSeasonStats).toBe(original.playerSeasonStats);
    expect(original.players[0]).not.toHaveProperty('mergedIntoPlayerId');
  });

  it('materializes a survivor absent from the snapshot without adding invented statistics', () => {
    const sourceOnly = {
      ...original,
      players: original.players.slice(0, 1),
      memberships: original.memberships.slice(0, 1),
      playerSeasonStats: original.playerSeasonStats.slice(0, 1),
      goalieSeasonStats: original.goalieSeasonStats.slice(0, 1),
      playerGameStats: original.playerGameStats.slice(0, 1),
    };
    const result = applyPublicPlayerDetails(sourceOnly, metadata);
    expect(result.players).toHaveLength(2);
    expect(publicPlayerProfileSnapshot(result, 'ycbhl-player-1').primaryPlayer).toMatchObject({ id: 'cloud-correct', displayName: 'Correct Name' });
    expect(publicPlayerProfileSnapshot(result, 'cloud-correct').careerField).toMatchObject({ gamesPlayed: 2, goals: 3, assists: 4 });
    expect(playerRosterCandidates(result, { includeHistory: true })[0].id).toBe('cloud-correct');
    expect(result.playerSeasonStats).toBe(sourceOnly.playerSeasonStats);
  });

  it('carries missing source metadata into an existing survivor and prefers the survivor avatar', () => {
    const targetOnly = { ...original, players: original.players.slice(1) };
    const result = applyPublicPlayerDetails(targetOnly, metadata.map((row) => row.player_id === 'cloud-correct'
      ? { ...row, avatar_url: 'https://example.com/correct-avatar.jpg' }
      : row));
    expect(result.players).toHaveLength(2);
    expect(result.players.every((player) => player.avatarUrl === 'https://example.com/correct-avatar.jpg')).toBe(true);
  });

  it('uses an existing snapshot survivor when only inline target metadata is returned', () => {
    const result = applyPublicPlayerDetails(original, metadata.slice(0, 1));
    expect(result.players).toHaveLength(2);
    expect(publicPlayerProfileSnapshot(result, 'cloud-correct').primaryPlayer.id).toBe('ycbhl-player-99');
    expect(statsSnapshot(result, 'season', 'team').fieldPlayers).toHaveLength(1);
  });

  it('retains directed merges when resolving the admin directory metadata', () => {
    const result = resolvePlayerNumberAssignments([
      { id: 'wrong', displayName: 'Typo', mergedIntoPlayerId: 'correct', avatarUrl: 'https://example.com/source.jpg' },
      { id: 'correct', displayName: 'Correct', canonicalDisplayName: 'Chosen', jerseyNumber: '7', jerseyNumberUpdatedAt: '2026-09-23T12:00:00Z' },
    ]);
    expect(result[0]).toMatchObject({ mergedIntoPlayerId: 'correct', jerseyNumber: '7' });
    expect(result[1]).toMatchObject({ canonicalDisplayName: 'Chosen', avatarUrl: 'https://example.com/source.jpg' });
  });
});
