export const DEFAULT_LEADERBOARD_SORT = Object.freeze({
  key: 'points',
  direction: 'desc',
});

const SORTABLE_KEYS = new Set(['goals', 'assists', 'points']);

export function nextLeaderboardSort(currentSort, key) {
  const nextKey = SORTABLE_KEYS.has(key) ? key : DEFAULT_LEADERBOARD_SORT.key;
  if (currentSort?.key !== nextKey) return { key: nextKey, direction: 'desc' };
  return {
    key: nextKey,
    direction: currentSort.direction === 'desc' ? 'asc' : 'desc',
  };
}

export function sortLeaderboard(rows, sort = DEFAULT_LEADERBOARD_SORT) {
  const key = SORTABLE_KEYS.has(sort?.key) ? sort.key : DEFAULT_LEADERBOARD_SORT.key;
  const direction = sort?.direction === 'asc' ? 'asc' : 'desc';
  const directionMultiplier = direction === 'asc' ? 1 : -1;

  return [...rows].sort((left, right) => {
    const metricDifference = (Number(left[key]) - Number(right[key])) * directionMultiplier;
    if (metricDifference) return metricDifference;

    for (const tieBreaker of ['points', 'goals', 'assists']) {
      if (tieBreaker === key) continue;
      const difference = Number(right[tieBreaker]) - Number(left[tieBreaker]);
      if (difference) return difference;
    }

    return left.displayName.localeCompare(right.displayName);
  });
}
