import { describe, expect, it } from 'vitest';
import {
  buildPlayerIdentityIndex,
  canonicalPlayerIdentityId,
  expandPlayerIdentityIds,
  REVIEWED_PLAYER_IDENTITY_GROUPS,
} from './playerIdentity';
import { OFFICIAL_STATS_DATASET } from './statsSeed';

function player(id, displayName, sourceUrl) {
  return { id, displayName, sourceUrl };
}

describe('verified cross-league player identity', () => {
  it('links a unique exact name across YCBHL and Greater Toronto', () => {
    const players = [
      player('ycbhl-player-1', 'Alex Member', 'https://www.yorkcentralbhl.com/player/1'),
      player('gtbhl-player-2', 'Alex Member', 'https://www.greatertorontobhl.com/player/2'),
    ];
    const index = buildPlayerIdentityIndex(players);

    expect(canonicalPlayerIdentityId(index, 'gtbhl-player-2')).toBe('ycbhl-player-1');
    expect([...expandPlayerIdentityIds(index, new Set(['ycbhl-player-1']))]).toEqual([
      'ycbhl-player-1',
      'gtbhl-player-2',
    ]);
  });

  it('supports a reviewed spelling alias without fuzzy matching unrelated names', () => {
    const players = [
      player('ycbhl-player-1', 'Mathew Grenier', 'https://www.yorkcentralbhl.com/player/1'),
      player('gtbhl-player-2', 'Matthew Grenier', 'https://www.greatertorontobhl.com/player/2'),
    ];
    const index = buildPlayerIdentityIndex(players);

    expect(canonicalPlayerIdentityId(index, 'gtbhl-player-2')).toBe('ycbhl-player-1');
  });

  it('fails closed when either league contains duplicate records for the same name', () => {
    const players = [
      player('ycbhl-player-1', 'Ryan Hunt', 'https://www.yorkcentralbhl.com/player/1'),
      player('gtbhl-player-2', 'Ryan Hunt', 'https://www.greatertorontobhl.com/player/2'),
      player('gtbhl-player-3', 'Ryan Hunt', 'https://www.greatertorontobhl.com/player/3'),
    ];
    const index = buildPlayerIdentityIndex(players);

    expect(canonicalPlayerIdentityId(index, 'ycbhl-player-1')).toBe('ycbhl-player-1');
    expect(canonicalPlayerIdentityId(index, 'gtbhl-player-2')).toBe('gtbhl-player-2');
    expect(canonicalPlayerIdentityId(index, 'gtbhl-player-3')).toBe('gtbhl-player-3');
  });

  it('keeps same-name records distinct when their source cannot be verified', () => {
    const players = [
      player('local-1', 'Sam Member', ''),
      player('local-2', 'Sam Member', ''),
    ];
    const index = buildPlayerIdentityIndex(players);

    expect(canonicalPlayerIdentityId(index, 'local-1')).toBe('local-1');
    expect(canonicalPlayerIdentityId(index, 'local-2')).toBe('local-2');
  });

  it('keeps Sajjad Jaffery on the populated source record and links only the reviewed retired ID', () => {
    const populatedId = 'ycbhl-player-26380';
    const retiredId = 'ycbhl-player-26381';
    const unrelatedId = 'ycbhl-player-99999';
    const players = [
      ...OFFICIAL_STATS_DATASET.players.filter(({ id }) => [populatedId, retiredId].includes(id)),
      player(unrelatedId, 'Sajjad Jaffery', 'https://www.yorkcentralbhl.com/player/99999'),
    ];
    const index = buildPlayerIdentityIndex(players);

    expect(players).toHaveLength(3);
    expect(OFFICIAL_STATS_DATASET.memberships.some(({ playerId }) => playerId === populatedId)).toBe(true);
    expect(OFFICIAL_STATS_DATASET.playerGameStats.some(({ playerId }) => playerId === populatedId)).toBe(true);
    expect(OFFICIAL_STATS_DATASET.memberships.some(({ playerId }) => playerId === retiredId)).toBe(false);
    expect(OFFICIAL_STATS_DATASET.playerGameStats.some(({ playerId }) => playerId === retiredId)).toBe(false);
    expect(canonicalPlayerIdentityId(index, retiredId)).toBe(populatedId);
    expect([...expandPlayerIdentityIds(index, new Set([retiredId]))]).toEqual([populatedId, retiredId]);
    expect(canonicalPlayerIdentityId(index, unrelatedId)).toBe(unrelatedId);
  });

  it('keeps the populated Sajjad source canonical after cloud UUID replacement', () => {
    const index = buildPlayerIdentityIndex([
      { id: 'cloud-retired', externalId: '26381', displayName: 'Sajjad Jaffery', sourceUrl: 'https://www.yorkcentralbhl.com/player/7278-goonsquad/26381-sajjad-jaffery' },
      { id: 'cloud-populated', externalId: '26380', displayName: 'Sajjad Jaffery', sourceUrl: 'https://www.yorkcentralbhl.com/player/7278-goonsquad/26380-sajjad-jaffery' },
    ]);

    expect(canonicalPlayerIdentityId(index, 'cloud-retired')).toBe('cloud-populated');
    expect(new Set(expandPlayerIdentityIds(index, new Set(['cloud-populated'])))).toEqual(
      new Set(['cloud-populated', 'cloud-retired']),
    );
  });

  it('consolidates every reviewed historical ID into one player identity', () => {
    const index = buildPlayerIdentityIndex(OFFICIAL_STATS_DATASET.players);

    REVIEWED_PLAYER_IDENTITY_GROUPS.forEach((group) => {
      const canonicalIds = new Set(group.playerIds.map((playerId) => (
        canonicalPlayerIdentityId(index, playerId)
      )));
      expect(canonicalIds, group.displayName).toHaveLength(1);
      expect(new Set(expandPlayerIdentityIds(index, new Set([group.playerIds[0]])))).toEqual(
        new Set(group.playerIds),
      );
    });
  });

  it('resolves reviewed aliases from verified external IDs after cloud UUID replacement', () => {
    const players = [
      { id: 'cloud-a', externalId: '307', displayName: 'Ryan Hunt', sourceUrl: 'https://www.yorkcentralbhl.com/player/307' },
      { id: 'cloud-b', externalId: 'gtbhl:84495', displayName: 'Ryan Hunt' },
      { id: 'cloud-c', externalId: 'gtbhl:87157', displayName: 'Ryan Hunt' },
      { id: 'local', externalId: '307', displayName: 'Unrelated member' },
    ];
    const index = buildPlayerIdentityIndex(players);
    expect(canonicalPlayerIdentityId(index, 'cloud-b')).toBe('cloud-a');
    expect(canonicalPlayerIdentityId(index, 'cloud-c')).toBe('cloud-a');
    expect(canonicalPlayerIdentityId(index, 'local')).toBe('local');
  });

  it('never merges two reviewed IDs that appeared in the same official game', () => {
    REVIEWED_PLAYER_IDENTITY_GROUPS.forEach((group) => {
      const gameIdsByPlayer = group.playerIds.map((playerId) => new Set(
        OFFICIAL_STATS_DATASET.playerGameStats
          .filter((line) => line.playerId === playerId && Number(line.gamesPlayed ?? 1) > 0)
          .map((line) => line.gameId),
      ));

      for (let index = 0; index < gameIdsByPlayer.length; index += 1) {
        for (let comparison = index + 1; comparison < gameIdsByPlayer.length; comparison += 1) {
          const sharedGames = [...gameIdsByPlayer[index]].filter((gameId) => (
            gameIdsByPlayer[comparison].has(gameId)
          ));
          expect(sharedGames, group.displayName).toEqual([]);
        }
      }
    });
  });

  it('leaves no duplicate exact-name identities unresolved in the archive', () => {
    const index = buildPlayerIdentityIndex(OFFICIAL_STATS_DATASET.players);
    const playersByName = new Map();
    OFFICIAL_STATS_DATASET.players.forEach((archivePlayer) => {
      const key = archivePlayer.displayName.toLowerCase().trim();
      const matches = playersByName.get(key) ?? [];
      matches.push(archivePlayer.id);
      playersByName.set(key, matches);
    });

    playersByName.forEach((playerIds, displayName) => {
      if (playerIds.length < 2) return;
      const canonicalIds = new Set(playerIds.map((playerId) => (
        canonicalPlayerIdentityId(index, playerId)
      )));
      expect(canonicalIds, displayName).toHaveLength(1);
    });
  });
});
