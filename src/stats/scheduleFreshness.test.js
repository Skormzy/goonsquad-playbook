import { describe, expect, it } from 'vitest';
import {
  isAwaitingResult,
  isUpcomingGame,
  nextUpcomingGame,
  scheduleSections,
  upcomingGames,
} from './scheduleFreshness';

const NOW = '2026-07-29T10:00:00-04:00';

describe('schedule freshness', () => {
  it('never treats an unresolved past fixture as an upcoming game', () => {
    const game = {
      status: 'scheduled',
      scheduledAt: '2026-07-26T19:00:00-04:00',
    };
    expect(isUpcomingGame(game, NOW)).toBe(false);
    expect(isAwaitingResult(game, NOW)).toBe(true);
  });

  it('does not call a future fixture played or a final result pending', () => {
    expect(isAwaitingResult({
      status: 'scheduled',
      scheduledAt: '2026-07-30T19:00:00-04:00',
    }, NOW)).toBe(false);
    expect(isAwaitingResult({
      status: 'final',
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

  it('builds chronological schedule sections without mixing final and pending games', () => {
    const games = [
      { id: 'later', status: 'scheduled', scheduledAt: '2026-08-03T20:00:00-04:00' },
      { id: 'final-old', status: 'final', scheduledAt: '2026-07-01T20:00:00-04:00' },
      { id: 'pending', status: 'scheduled', scheduledAt: '2026-07-28T20:00:00-04:00' },
      { id: 'next', status: 'scheduled', scheduledAt: '2026-07-30T20:00:00-04:00' },
      { id: 'final-new', status: 'final', scheduledAt: '2026-07-10T20:00:00-04:00' },
    ];

    const sections = scheduleSections(games, NOW);

    expect(sections.upcoming.map((game) => game.id)).toEqual(['next', 'later']);
    expect(sections.awaiting.map((game) => game.id)).toEqual(['pending']);
    expect(sections.completed.map((game) => game.id)).toEqual(['final-new', 'final-old']);
  });
});
