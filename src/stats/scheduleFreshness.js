export const STATS_REFRESH_INTERVAL_MS = 30 * 60 * 1000;

function timestamp(value) {
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : null;
}

export function isUpcomingGame(game, now = Date.now()) {
  if (!game || game.status === 'final') return false;
  const scheduledAt = timestamp(game.scheduledAt);
  const currentTime = typeof now === 'number' ? now : timestamp(now);
  return scheduledAt !== null && currentTime !== null && scheduledAt > currentTime;
}

export function upcomingGames(games, now = Date.now()) {
  return games
    .filter((game) => isUpcomingGame(game, now))
    .sort((a, b) => timestamp(a.scheduledAt) - timestamp(b.scheduledAt));
}

export function nextUpcomingGame(games, now = Date.now()) {
  return upcomingGames(games, now)[0] ?? null;
}
