import { describe, expect, it } from 'vitest';
import {
  buildPlayerIdentityIndex,
  canonicalPlayerIdentityId,
  expandPlayerIdentityIds,
  playerIdentityDisplayName,
  REVIEWED_PLAYER_IDENTITY_GROUPS,
} from './playerIdentity';
import { OFFICIAL_STATS_DATASET } from './statsSeed';

function player(id, displayName, sourceUrl) {
  return { id, displayName, sourceUrl };
}

describe('verified cross-league player identity', () => {
  it('keeps the explicitly selected survivor and its spelling across both existing identity groups', () => {
    const players = [
      { id: 'ycbhl-player-1', displayName: 'Incorrect Name', mergedIntoPlayerId: 'gtbhl-player-99' },
      { id: 'gtbhl-player-2', displayName: 'Incorrect Name', mergedIntoPlayerId: 'gtbhl-player-99' },
      { id: 'ycbhl-player-3', displayName: 'Correct Name', mergedIntoPlayerId: 'gtbhl-player-99' },
      { id: 'gtbhl-player-99', displayName: 'Correct Name', canonicalDisplayName: 'Chosen Correct Name' },
      { id: 'local-other', displayName: 'Incorrect Name' },
    ];
    const index = buildPlayerIdentityIndex(players);
    expect([...expandPlayerIdentityIds(index, new Set(['ycbhl-player-1']))].sort()).toEqual(players.slice(0, 4).map(({ id }) => id).sort());
    players.slice(0, 4).forEach(({ id }) => {
      expect(canonicalPlayerIdentityId(index, id)).toBe('gtbhl-player-99');
      expect(playerIdentityDisplayName(index, id)).toBe('Chosen Correct Name');
    });
    expect(canonicalPlayerIdentityId(index, 'local-other')).toBe('local-other');
  });

  it('resolves manual chains and prefers their terminal record over reviewed spellings', () => {
    const index = buildPlayerIdentityIndex([
      { id: 'ycbhl-player-25962', displayName: 'Abraham Saodzi', mergedIntoPlayerId: 'middle' },
      { id: 'middle', displayName: 'Middle', mergedIntoPlayerId: 'correct' },
      { id: 'correct', displayName: 'Administrator Selected Name' },
    ]);
    expect(canonicalPlayerIdentityId(index, 'ycbhl-player-25962')).toBe('correct');
    expect(playerIdentityDisplayName(index, 'middle')).toBe('Administrator Selected Name');
  });

  it.each([
    [{ id: 'a', mergedIntoPlayerId: 'b' }, { id: 'b', mergedIntoPlayerId: 'a' }],
    [{ id: 'a', mergedIntoPlayerId: 'a' }, { id: 'b' }],
    [{ id: 'a', mergedIntoPlayerId: 'missing' }, { id: 'b' }],
    [{ id: 'a', mergedIntoPlayerId: 'b' }, { id: 'b', mergedIntoPlayerId: 'missing' }],
  ].map((players) => [players]))('fails closed for cyclic and missing manual destinations (%j)', (players) => {
    const index = buildPlayerIdentityIndex(players);
    players.forEach(({ id }) => expect(canonicalPlayerIdentityId(index, id)).toBe(id));
  });

  it('fails closed for conflicting destinations inside an existing identity group', () => {
    const players = [
      { id: 'ycbhl-player-1', displayName: 'Same Person', mergedIntoPlayerId: 'a' },
      { id: 'gtbhl-player-2', displayName: 'Same Person', mergedIntoPlayerId: 'b' },
      { id: 'a' },
      { id: 'b' },
    ];
    const index = buildPlayerIdentityIndex(players);
    expect(canonicalPlayerIdentityId(index, 'gtbhl-player-2')).toBe('ycbhl-player-1');
    expect(canonicalPlayerIdentityId(index, 'a')).toBe('a');
    expect(canonicalPlayerIdentityId(index, 'b')).toBe('b');
  });

  it('can resolve an exact unique public external destination without a cloud UUID match', () => {
    const index = buildPlayerIdentityIndex([
      { id: 'ycbhl-player-1', externalId: '1', mergedIntoPlayerId: 'cloud-target', mergedIntoExternalId: 'gtbhl:99' },
      { id: 'gtbhl-player-99', externalId: 'gtbhl:99', displayName: 'Correct' },
    ]);
    expect(canonicalPlayerIdentityId(index, 'ycbhl-player-1')).toBe('gtbhl-player-99');
  });

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
        [...OFFICIAL_STATS_DATASET.playerGameStats, ...OFFICIAL_STATS_DATASET.goalieGameStats]
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

  it('uses the reviewed spelling for each alias, including an alias-only cloud dataset', () => {
    const player = {
      id: 'cloud-old-spelling',
      externalId: '25962',
      displayName: 'Abraham Saodzi',
      sourceUrl: 'https://www.yorkcentralbhl.com/player/7117-goonsquad/25962-abraham-saodzi',
    };
    const index = buildPlayerIdentityIndex([player]);
    expect(playerIdentityDisplayName(index, player.id, player.displayName)).toBe('Abraham Sadozi');
    expect(player.displayName).toBe('Abraham Saodzi');
    expect(playerIdentityDisplayName(index, 'unknown', 'Another player')).toBe('Another player');
  });

  it('keeps unconfirmed similar names and known separate teammates distinct', () => {
    const index = buildPlayerIdentityIndex(OFFICIAL_STATS_DATASET.players);
    [
      ['25980', '8079', '26108'], // Tyler Flach / Flack / Glach: unconfirmed.
      ['26132', '26364'], // John / Johnathan Gianopoulos: unconfirmed.
      ['26362', '26386'], // Matt / Matteo Crossley: unconfirmed.
      ['25314', '25244'], // Lee / Lorry Brown played together.
      ['24599', '24598'], // Al-Rahim / Amyn Gangani played together.
      ['26330', '26380'], // Saif / Sajjad Jaffery played together.
    ].forEach((ids) => {
      const canonicalIds = ids.map((id) => canonicalPlayerIdentityId(index, `ycbhl-player-${id}`));
      expect(new Set(canonicalIds)).toHaveLength(ids.length);
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
