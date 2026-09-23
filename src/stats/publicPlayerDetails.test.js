import { describe, expect, it } from 'vitest';
import { playerRosterCandidates, publicPlayerProfileSnapshot } from '../profile/profileModel';
import { buildAllTimeRecords } from './allTimeRecordsModel';
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
