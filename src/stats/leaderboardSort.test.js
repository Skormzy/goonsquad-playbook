import { describe, expect, it } from 'vitest';
import {
  DEFAULT_LEADERBOARD_SORT,
  nextLeaderboardSort,
  sortLeaderboard,
} from './leaderboardSort';

const players = [
  { playerId: 'a', displayName: 'Alex', goals: 2, assists: 5, points: 7 },
  { playerId: 'b', displayName: 'Blair', goals: 4, assists: 1, points: 5 },
  { playerId: 'c', displayName: 'Casey', goals: 1, assists: 6, points: 7 },
];

describe('statistics leaderboard sorting', () => {
  it('defaults to points with goals as the first tie-breaker', () => {
    expect(sortLeaderboard(players).map((player) => player.playerId)).toEqual(['a', 'c', 'b']);
  });

  it('sorts every visible scoring metric in either direction', () => {
    expect(sortLeaderboard(players, { key: 'goals', direction: 'desc' }).map((player) => player.playerId))
      .toEqual(['b', 'a', 'c']);
    expect(sortLeaderboard(players, { key: 'assists', direction: 'asc' }).map((player) => player.playerId))
      .toEqual(['b', 'a', 'c']);
  });

  it('opens a new metric descending and toggles the active metric', () => {
    expect(nextLeaderboardSort(DEFAULT_LEADERBOARD_SORT, 'goals'))
      .toEqual({ key: 'goals', direction: 'desc' });
    expect(nextLeaderboardSort({ key: 'goals', direction: 'desc' }, 'goals'))
      .toEqual({ key: 'goals', direction: 'asc' });
  });
});
