import { buildPlayerIdentityIndex, canonicalPlayerIdentityId, playerIdentitySource } from './playerIdentity.js';
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
    display_name: player.displayName,
    source_url: player.sourceUrl,
    avatar_url: player.avatarUrl,
    canonical_display_name: player.canonicalDisplayName,
    merged_into_player_id: player.mergedIntoPlayerId,
    merged_into_external_id: player.mergedIntoExternalId,
    merged_into_display_name: player.mergedIntoDisplayName,
    merged_into_source_url: player.mergedIntoSourceUrl,
  }))).players;
}

export function applyPublicPlayerDetails(dataset, rows) {
  const detailsByPlayer = new Map();
  const localIdByCloudId = new Map();
  const players = dataset.players.map((player) => ({ ...player }));
  const unmatched = [];
  rows.forEach((row) => {
    let player = players.find((candidate) => candidate.id === row.player_id);
    if (!player && row.external_id) {
      const source = playerIdentitySource({ externalId: row.external_id, sourceUrl: row.source_url });
      const matches = players.filter((candidate) => (
        String(candidate.externalId) === String(row.external_id)
        && (!source || playerIdentitySource(candidate) === source)
      ));
      if (matches.length === 1) [player] = matches;
    }
    if (!player) {
      unmatched.push(row);
      return;
    }
    detailsByPlayer.set(player.id, row);
    if (row.player_id) localIdByCloudId.set(row.player_id, player.id);
  });

  // A survivor can be newer than the bundled statistics snapshot. Include the
  // public metadata record, without fabricating a membership or statistics, so
  // existing aliases can still lead to the selected profile and its details.
  let connectedRowsAdded = true;
  while (connectedRowsAdded) {
    connectedRowsAdded = false;
    const referencedTargets = new Set([...detailsByPlayer.values()].map((row) => row.merged_into_player_id).filter(Boolean));
    unmatched.forEach((row) => {
      if (!row.player_id || !row.display_name || localIdByCloudId.has(row.player_id)) return;
      if (!referencedTargets.has(row.player_id) && !localIdByCloudId.has(row.merged_into_player_id)) return;
      const player = {
        id: row.player_id,
        displayName: row.display_name,
        externalId: row.external_id || null,
        sourceUrl: row.source_url || null,
        persisted: true,
      };
      players.push(player);
      detailsByPlayer.set(player.id, row);
      localIdByCloudId.set(row.player_id, player.id);
      connectedRowsAdded = true;
    });
    [...detailsByPlayer.values()].forEach((row) => {
      const targetId = row.merged_into_player_id;
      if (!targetId || localIdByCloudId.has(targetId) || !row.merged_into_display_name) return;
      // Older RPC deployments may provide the target inline without a row.
      // Do not create a second record when the full row is still available.
      if (unmatched.some((candidate) => candidate.player_id === targetId && candidate.display_name)) return;
      const targetSource = playerIdentitySource({ externalId: row.merged_into_external_id, sourceUrl: row.merged_into_source_url });
      const existingTargets = row.merged_into_external_id ? players.filter((candidate) => (
        String(candidate.externalId) === String(row.merged_into_external_id)
        && (!targetSource || playerIdentitySource(candidate) === targetSource)
      )) : [];
      if (existingTargets.length === 1) {
        localIdByCloudId.set(targetId, existingTargets[0].id);
        existingTargets[0].cloudPlayerId = targetId;
        connectedRowsAdded = true;
        return;
      }
      if (existingTargets.length > 1) return;
      players.push({
        id: targetId,
        displayName: row.merged_into_display_name,
        externalId: row.merged_into_external_id || null,
        sourceUrl: row.merged_into_source_url || null,
        persisted: true,
      });
      localIdByCloudId.set(targetId, targetId);
      connectedRowsAdded = true;
    });
  }

  players.forEach((player) => {
    const details = detailsByPlayer.get(player.id);
    if (!details) return;
    if (details.player_id) player.cloudPlayerId = details.player_id;
    if (Object.hasOwn(details, 'canonical_display_name')) player.canonicalDisplayName = details.canonical_display_name || null;
    if (Object.hasOwn(details, 'merged_into_player_id')) {
      player.mergedIntoPlayerId = localIdByCloudId.get(details.merged_into_player_id) || details.merged_into_player_id || null;
      player.mergedIntoExternalId = details.merged_into_external_id || null;
      player.mergedIntoDisplayName = details.merged_into_display_name || null;
      player.mergedIntoSourceUrl = details.merged_into_source_url || null;
    }
  });
  const identityIndex = buildPlayerIdentityIndex(players);
  const numbersByIdentity = new Map();
  const positionsByIdentity = new Map();
  const avatarsByIdentity = new Map();
  players.forEach((player) => {
    const identityId = canonicalPlayerIdentityId(identityIndex, player.id);
    const details = detailsByPlayer.get(player.id);
    const avatar = details?.avatar_url || player.avatarUrl;
    if (avatar && (!avatarsByIdentity.has(identityId) || player.id === identityId)) avatarsByIdentity.set(identityId, avatar);
    if (!details) return;
    const number = normalizePlayerNumber(details.jersey_number);
    const updatedAt = Date.parse(details.jersey_number_updated_at || '');
    // Legacy nonempty profile numbers remain usable. Only an explicit edit
    // timestamp makes a null number override a historical roster number.
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
    players: players.map((player) => {
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
        avatarUrl: avatarsByIdentity.get(canonicalPlayerIdentityId(identityIndex, player.id)) || null,
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
