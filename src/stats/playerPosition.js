export function normalizePlayerPosition(value) {
  if (value === null || value === undefined) return null;
  return String(value).trim().toUpperCase() || null;
}

// An administrator's assignment, including a clear, takes precedence over
// imported roster positions. Unedited players retain the existing fallbacks.
export function resolvePlayerPosition(player, ...fallbacks) {
  const position = normalizePlayerPosition(player?.primaryPosition);
  if (player?.primaryPositionAuthoritative
    || Number.isFinite(Date.parse(player?.primaryPositionUpdatedAt || ''))) return position;
  return [...fallbacks.map(normalizePlayerPosition), position]
    .find((value) => value !== null) ?? null;
}
