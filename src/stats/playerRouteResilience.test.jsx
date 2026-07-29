import { describe, expect, it } from 'vitest';
import PlayerSpotlightErrorBoundary from './PlayerSpotlightErrorBoundary';
import {
  applyStatsDetailParams,
  resolvePlayerDetailState,
} from './StatsWorkspace';

const dataset = {
  seasons: [{ id: 'summer-2026', name: 'Summer 2026', current: true }],
  teams: [],
  players: [{ id: 'player-19', displayName: 'Sam Member', active: true }],
  memberships: [],
  playerSeasonStats: [],
  goalieSeasonStats: [],
  games: [],
  playerGameStats: [],
  goalieGameStats: [],
};

describe('public player route resilience', () => {
  it('keeps an unresolved deep link in loading state until statistics hydrate', () => {
    expect(resolvePlayerDetailState(null, 'player-19')).toEqual({
      status: 'loading',
      profile: null,
    });
    expect(resolvePlayerDetailState(dataset, 'player-19')).toMatchObject({
      status: 'found',
      profile: {
        primaryPlayer: { id: 'player-19', displayName: 'Sam Member' },
      },
    });
  });

  it('turns an unknown player id into a durable not-found state', () => {
    expect(resolvePlayerDetailState(dataset, 'missing-player')).toEqual({
      status: 'not-found',
      profile: null,
    });
    const url = applyStatsDetailParams(
      new URL('https://goonsquad.app/?content=stats&game=old-game'),
      { playerId: 'missing-player' },
    );
    expect(url.searchParams.get('player')).toBe('missing-player');
    expect(url.searchParams.get('game')).toBeNull();
  });

  it('contains a failed 3D spotlight without replacing its surrounding profile', () => {
    expect(PlayerSpotlightErrorBoundary.getDerivedStateFromError()).toEqual({
      failed: true,
    });
    const boundary = new PlayerSpotlightErrorBoundary({
      children: 'profile content',
      fallback: '3D unavailable',
    });
    expect(boundary.render()).toBe('profile content');
    boundary.state = { failed: true };
    expect(boundary.render()).toBe('3D unavailable');
  });
});
