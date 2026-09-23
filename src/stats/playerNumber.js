export function normalizePlayerNumber(value) {
  if (value === null || value === undefined) return null;
  return String(value).trim() || null;
}

// A saved clear is authoritative too: an old roster or tournament number must
// not reappear after an administrator removes the current assignment.
export function resolvePlayerNumber(player, ...fallbacks) {
  const number = normalizePlayerNumber(player?.jerseyNumber);
  if (player?.jerseyNumberAuthoritative || player?.jerseyNumberUpdatedAt) return number;
  return [number, ...fallbacks.map(normalizePlayerNumber)].find((value) => value !== null) ?? null;
}
