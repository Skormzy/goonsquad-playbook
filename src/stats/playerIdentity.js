const VERIFIED_SOURCE_ORDER = Object.freeze(['ycbhl', 'gtbhl']);

const REVIEWED_NAME_ALIASES = new Map([
  ['matt grenier', 'mathew grenier'],
  ['matthew grenier', 'mathew grenier'],
]);

export function normalizePlayerIdentityName(name) {
  const normalized = String(name || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
  return REVIEWED_NAME_ALIASES.get(normalized) || normalized;
}

export function playerIdentitySource(player) {
  const id = String(player?.id || '').toLowerCase();
  const externalId = String(player?.externalId || '').toLowerCase();
  const sourceUrl = String(player?.sourceUrl || '').toLowerCase();
  if (id.startsWith('ycbhl-') || externalId.startsWith('ycbhl:') || sourceUrl.includes('yorkcentralbhl.com')) {
    return 'ycbhl';
  }
  if (id.startsWith('gtbhl-') || externalId.startsWith('gtbhl:') || sourceUrl.includes('greatertorontobhl.com')) {
    return 'gtbhl';
  }
  return null;
}

export function playerIdentitySourceLabel(player) {
  const source = playerIdentitySource(player);
  if (source === 'ycbhl') return 'YCBHL';
  if (source === 'gtbhl') return 'Greater Toronto Ball Hockey League';
  return 'Official league';
}

function canonicalPlayer(players) {
  return players.slice().sort((a, b) => {
    const aRank = VERIFIED_SOURCE_ORDER.indexOf(playerIdentitySource(a));
    const bRank = VERIFIED_SOURCE_ORDER.indexOf(playerIdentitySource(b));
    return aRank - bRank || String(a.id).localeCompare(String(b.id));
  })[0];
}

export function buildPlayerIdentityIndex(players = []) {
  const canonicalIdByPlayerId = new Map();
  const playerIdsByCanonicalId = new Map();
  const groupedByName = new Map();

  players.forEach((player) => {
    if (!player?.id) return;
    canonicalIdByPlayerId.set(player.id, player.id);
    playerIdsByCanonicalId.set(player.id, [player.id]);

    const source = playerIdentitySource(player);
    const nameKey = normalizePlayerIdentityName(player.displayName);
    if (!source || !nameKey) return;
    const sourceMap = groupedByName.get(nameKey) ?? new Map();
    const sourcePlayers = sourceMap.get(source) ?? [];
    sourcePlayers.push(player);
    sourceMap.set(source, sourcePlayers);
    groupedByName.set(nameKey, sourceMap);
  });

  groupedByName.forEach((sourceMap) => {
    if (sourceMap.size < 2) return;
    if ([...sourceMap.values()].some((sourcePlayers) => sourcePlayers.length !== 1)) return;

    const identityPlayers = [...sourceMap.values()].flat();
    const canonical = canonicalPlayer(identityPlayers);
    const playerIds = identityPlayers.map((player) => player.id);
    identityPlayers.forEach((player) => {
      canonicalIdByPlayerId.set(player.id, canonical.id);
      if (player.id !== canonical.id) playerIdsByCanonicalId.delete(player.id);
    });
    playerIdsByCanonicalId.set(canonical.id, playerIds);
  });

  return {
    canonicalIdByPlayerId,
    playerIdsByCanonicalId,
  };
}

export function canonicalPlayerIdentityId(identityIndex, playerId) {
  return identityIndex.canonicalIdByPlayerId.get(playerId) ?? playerId;
}

export function playerIdsForIdentity(identityIndex, playerId) {
  const canonicalId = canonicalPlayerIdentityId(identityIndex, playerId);
  return identityIndex.playerIdsByCanonicalId.get(canonicalId) ?? [playerId];
}

export function expandPlayerIdentityIds(identityIndex, playerIds) {
  const expanded = new Set();
  playerIds.forEach((playerId) => {
    playerIdsForIdentity(identityIndex, playerId).forEach((identityPlayerId) => {
      expanded.add(identityPlayerId);
    });
  });
  return expanded;
}
