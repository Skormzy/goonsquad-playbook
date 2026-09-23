import { buildPlayerIdentityIndex, canonicalPlayerIdentityId } from './playerIdentity.js';
import { normalizePlayerNumber } from './playerNumber.js';
import { normalizePlayerPosition } from './playerPosition.js';

export function resolvePlayerNumberAssignments(players) {
  return applyPublicPlayerDetails({ players }, players.map((player) => ({
    player_id: player.id,
    external_id: player.externalId,
    jersey_number: player.jerseyNumber,
    jersey_number_updated_at: player.jerseyNumberUpdatedAt,
    primary_position: player.primaryPosition,
    primary_position_updated_at: player.primaryPositionUpdatedAt,
  }))).players;
}

export function applyPublicPlayerDetails(dataset, rows) {
  const byPlayerId = new Map();
  const byExternalId = new Map();
  rows.forEach((row) => {
    if (row.player_id) byPlayerId.set(String(row.player_id), row);
    if (row.external_id) byExternalId.set(String(row.external_id), row);
  });
  const identityIndex = buildPlayerIdentityIndex(dataset.players);
  const numbersByIdentity = new Map();
  const positionsByIdentity = new Map();
  const detailsByPlayer = new Map();
  dataset.players.forEach((player) => {
    const details = byPlayerId.get(String(player.id))
      || (player.externalId && byExternalId.get(String(player.externalId)));
    if (!details) return;
    detailsByPlayer.set(player.id, details);
    const number = normalizePlayerNumber(details.jersey_number);
    const updatedAt = Date.parse(details.jersey_number_updated_at || '');
    // Legacy nonempty profile numbers remain usable. Only an explicit edit
    // timestamp makes a null number override a historical roster number.
    const identityId = canonicalPlayerIdentityId(identityIndex, player.id);
    const current = numbersByIdentity.get(identityId);
    const priority = Number.isFinite(updatedAt) ? updatedAt : Number.NEGATIVE_INFINITY;
    if ((number !== null || Number.isFinite(updatedAt))
      && (!current || priority > current.priority
        || (priority === current.priority && player.id === identityId))) {
      numbersByIdentity.set(identityId, {
        priority,
        jerseyNumber: number,
        jerseyNumberUpdatedAt: details.jersey_number_updated_at || null,
        jerseyNumberAuthoritative: true,
      });
    }
    const positionUpdatedAt = Date.parse(details.primary_position_updated_at || '');
    const currentPosition = positionsByIdentity.get(identityId);
    if (Number.isFinite(positionUpdatedAt)
      && (!currentPosition || positionUpdatedAt > currentPosition.priority
        || (positionUpdatedAt === currentPosition.priority && player.id === identityId))) {
      positionsByIdentity.set(identityId, {
        priority: positionUpdatedAt,
        primaryPosition: normalizePlayerPosition(details.primary_position),
        primaryPositionUpdatedAt: details.primary_position_updated_at,
      });
    }
  });
  return {
    ...dataset,
    players: dataset.players.map((player) => {
      const details = detailsByPlayer.get(player.id);
      const number = numbersByIdentity.get(canonicalPlayerIdentityId(identityIndex, player.id));
      const position = positionsByIdentity.get(canonicalPlayerIdentityId(identityIndex, player.id));
      return {
        ...player,
        jerseyNumber: normalizePlayerNumber(player.jerseyNumber),
        ...(number ? {
          jerseyNumber: number.jerseyNumber,
          jerseyNumberUpdatedAt: number.jerseyNumberUpdatedAt,
          jerseyNumberAuthoritative: true,
        } : {}),
        avatarUrl: details?.avatar_url || player.avatarUrl || null,
        primaryPosition: details?.primary_position || player.primaryPosition || null,
        ...(position ? {
          primaryPosition: position.primaryPosition,
          primaryPositionUpdatedAt: position.primaryPositionUpdatedAt,
          primaryPositionAuthoritative: true,
        } : {}),
      };
    }),
  };
}
