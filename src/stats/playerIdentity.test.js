import { describe, expect, it } from 'vitest';
import {
  buildPlayerIdentityIndex,
  canonicalPlayerIdentityId,
  expandPlayerIdentityIds,
} from './playerIdentity';

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
});
