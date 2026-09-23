const textId = (value) => String(value ?? '').trim();

export function resolvePlayerAdminProfileId(player, dataset) {
  const players = dataset?.players || [];
  const uniqueMatch = (field, value) => {
    const identifier = textId(value);
    if (!identifier) return null;
    const matches = players.filter((candidate) => textId(candidate[field]) === identifier);
    return matches.length === 1 ? matches[0].id : null;
  };

  const canonicalId = uniqueMatch('id', player?.id);
  if (canonicalId) return canonicalId;

  // Grouped rows contain display-only combined identifiers. Resolve their
  // original records instead, preferring IDs already in the public dataset.
  const sources = Array.isArray(player?.sourcePlayers) ? player.sourcePlayers : [player];
  for (const source of sources) {
    const sourceId = uniqueMatch('id', source?.id);
    if (sourceId) return sourceId;
  }

  // Admin records use cloud UUIDs; the public archive can use source IDs.
  // Match the imported external ID against the dataset actually being shown.
  for (const source of sources) {
    const sourceId = uniqueMatch('externalId', source?.externalId);
    if (sourceId) return sourceId;
  }
  return null;
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
