const VERIFIED_SOURCE_ORDER = Object.freeze(['ycbhl', 'gtbhl']);

const REVIEWED_NAME_ALIASES = new Map([
  ['matt grenier', 'mathew grenier'],
  ['matthew grenier', 'mathew grenier'],
]);

// Official league archives sometimes issue a new player ID when a player
// returns in a later season or uses a nickname. These groups were reviewed
// against the source rosters and game logs; IDs in one group never appear as
// separate players in the same game.
export const REVIEWED_PLAYER_IDENTITY_GROUPS = Object.freeze([
  Object.freeze({
    displayName: 'Adrian Bockner',
    playerIds: Object.freeze([
      'ycbhl-player-25232',
      'ycbhl-player-2768',
      'gtbhl-player-84064',
    ]),
  }),
  Object.freeze({
    displayName: 'Andrew Lorenowicz',
    playerIds: Object.freeze([
      'ycbhl-player-308',
      'gtbhl-player-86263',
      'gtbhl-player-87769',
    ]),
  }),
  Object.freeze({
    displayName: 'Mathew Grenier',
    playerIds: Object.freeze([
      'ycbhl-player-25650',
      'gtbhl-player-88577',
    ]),
  }),
  Object.freeze({
    displayName: 'Matthew Stott',
    playerIds: Object.freeze([
      'ycbhl-player-25348',
      'ycbhl-player-25470',
    ]),
  }),
  Object.freeze({
    displayName: 'Michael Thomas Kerrane',
    playerIds: Object.freeze([
      'ycbhl-player-25741',
      'ycbhl-player-25886',
      'gtbhl-player-87640',
    ]),
  }),
  Object.freeze({
    displayName: 'Michael Woods',
    playerIds: Object.freeze([
      'ycbhl-player-25796',
      'ycbhl-player-25965',
      'gtbhl-player-88685',
    ]),
  }),
  Object.freeze({
    displayName: 'Michael Yen',
    playerIds: Object.freeze([
      'ycbhl-player-26046',
      'gtbhl-player-88698',
    ]),
  }),
  Object.freeze({
    displayName: 'Ryan Hunt',
    playerIds: Object.freeze([
      'ycbhl-player-307',
      'gtbhl-player-84495',
      'gtbhl-player-87157',
    ]),
  }),
  Object.freeze({
    displayName: 'Stephen Macdonald',
    playerIds: Object.freeze([
      'ycbhl-player-25733',
      'ycbhl-player-25951',
      'gtbhl-player-88780',
    ]),
  }),
  Object.freeze({
    displayName: 'Zachary Sher',
    playerIds: Object.freeze([
      'ycbhl-player-25559',
      'ycbhl-player-25931',
      'gtbhl-player-88214',
    ]),
  }),
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

function linkIdentityPlayers(
  identityPlayers,
  playersById,
  canonicalIdByPlayerId,
  playerIdsByCanonicalId,
) {
  if (identityPlayers.length < 2) return;

  const linkedPlayerIds = new Set();
  identityPlayers.forEach((player) => {
    const existingCanonicalId = canonicalIdByPlayerId.get(player.id) ?? player.id;
    const existingPlayerIds = playerIdsByCanonicalId.get(existingCanonicalId) ?? [player.id];
    existingPlayerIds.forEach((playerId) => linkedPlayerIds.add(playerId));
  });

  const linkedPlayers = [...linkedPlayerIds]
    .map((playerId) => playersById.get(playerId))
    .filter(Boolean);
  if (linkedPlayers.length < 2) return;

  const canonical = canonicalPlayer(linkedPlayers);
  const orderedPlayerIds = linkedPlayers
    .slice()
    .sort((a, b) => {
      const aRank = VERIFIED_SOURCE_ORDER.indexOf(playerIdentitySource(a));
      const bRank = VERIFIED_SOURCE_ORDER.indexOf(playerIdentitySource(b));
      return aRank - bRank || String(a.id).localeCompare(String(b.id));
    })
    .map((player) => player.id);

  linkedPlayers.forEach((player) => {
    const previousCanonicalId = canonicalIdByPlayerId.get(player.id) ?? player.id;
    playerIdsByCanonicalId.delete(previousCanonicalId);
    canonicalIdByPlayerId.set(player.id, canonical.id);
  });
  playerIdsByCanonicalId.set(canonical.id, orderedPlayerIds);
}

export function buildPlayerIdentityIndex(players = []) {
  const canonicalIdByPlayerId = new Map();
  const playerIdsByCanonicalId = new Map();
  const groupedByName = new Map();
  const playersById = new Map();

  players.forEach((player) => {
    if (!player?.id) return;
    playersById.set(player.id, player);
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

    linkIdentityPlayers(
      [...sourceMap.values()].flat(),
      playersById,
      canonicalIdByPlayerId,
      playerIdsByCanonicalId,
    );
  });

  REVIEWED_PLAYER_IDENTITY_GROUPS.forEach((group) => {
    linkIdentityPlayers(
      group.playerIds.map((playerId) => playersById.get(playerId)).filter(Boolean),
      playersById,
      canonicalIdByPlayerId,
      playerIdsByCanonicalId,
    );
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
