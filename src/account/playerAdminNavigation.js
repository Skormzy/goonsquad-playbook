const textId = (value) => String(value ?? '').trim();

export function resolvePlayerAdminProfileId(player, dataset) {
  const players = dataset?.players || [];
  const playerId = textId(player?.id);
  const directMatch = playerId && players.find((candidate) => textId(candidate.id) === playerId);
  if (directMatch) return directMatch.id;

  // Admin records use cloud UUIDs; the public archive can use source IDs.
  // Match the imported external ID against the dataset actually being shown.
  const externalId = textId(player?.externalId);
  if (!externalId) return null;
  const matches = players.filter((candidate) => textId(candidate.externalId) === externalId);
  return matches.length === 1 ? matches[0].id : null;
}

export function playerAdminProfileUrl(currentUrl, player, dataset) {
  const playerId = resolvePlayerAdminProfileId(player, dataset);
  if (!playerId) return null;
  const url = new URL(currentUrl);
  url.searchParams.set('content', 'stats');
  url.searchParams.set('mode', '2d');
  url.searchParams.set('player', playerId);
  for (const key of ['panel', 'auth', 'game', 'opponent', 'fixture', 'competition', 'tournament', 'tournamentGame', 'season', 'team', 'stage']) {
    url.searchParams.delete(key);
  }
  return url;
}
