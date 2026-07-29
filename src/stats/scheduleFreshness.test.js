import { describe, expect, it } from 'vitest';
import {
  isUpcomingGame,
  nextUpcomingGame,
  upcomingGames,
} from './scheduleFreshness';

const NOW = '2026-07-29T10:00:00-04:00';

describe('schedule freshness', () => {
  it('never treats an unresolved past fixture as an upcoming game', () => {
    expect(isUpcomingGame({
      status: 'scheduled',
      scheduledAt: '2026-07-26T19:00:00-04:00',
    }, NOW)).toBe(false);
  });

  it('selects the nearest future fixture instead of an older unresolved fixture', () => {
    const games = [
      { id: 'past', status: 'scheduled', scheduledAt: '2026-07-26T19:00:00-04:00' },
      { id: 'later', status: 'scheduled', scheduledAt: '2026-08-03T20:00:00-04:00' },
      { id: 'next', status: 'scheduled', scheduledAt: '2026-07-30T21:00:00-04:00' },
    ];

    expect(nextUpcomingGame(games, NOW)?.id).toBe('next');
    expect(upcomingGames(games, NOW).map((game) => game.id)).toEqual(['next', 'later']);
  });

  it('excludes final games even when their date is in the future', () => {
    expect(isUpcomingGame({
      status: 'final',
      scheduledAt: '2026-07-30T21:00:00-04:00',
    }, NOW)).toBe(false);
  });
});
