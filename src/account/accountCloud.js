import { getPlaymakerCloudClient } from '../playmaker/playmakerCloud';
import { normalizeUsername, usernameValidationMessage } from './username';

const PROFILE_FIELDS = 'id, username, display_name, avatar_url, role, created_at, updated_at';
const LEGACY_PROFILE_FIELDS = 'id, display_name, avatar_url, role, created_at, updated_at';

function requireCloud() {
  const cloud = getPlaymakerCloudClient();
  if (!cloud) throw new Error('Team accounts are not configured for this deployment.');
  return cloud;
}

export async function loadAccountProfile(userId) {
  if (!userId) return null;
  const cloud = requireCloud();
  const result = await cloud
    .from('profiles')
    .select(PROFILE_FIELDS)
    .eq('id', userId)
    .maybeSingle();
  if (!result.error) return result.data;
  if (!String(result.error.message || '').toLowerCase().includes('username')) throw result.error;

  const legacy = await cloud
    .from('profiles')
    .select(LEGACY_PROFILE_FIELDS)
    .eq('id', userId)
    .maybeSingle();
  if (legacy.error) throw legacy.error;
  return legacy.data ? { ...legacy.data, username: null } : null;
}

export async function updateAccountProfile(userId, updates) {
  if (!userId) throw new Error('Sign in before updating your profile.');
  const cloud = requireCloud();
  const displayName = String(updates.displayName || '').trim().slice(0, 80);
  const username = normalizeUsername(updates.username);
  if (!displayName) throw new Error('Display name is required.');
  const usernameError = usernameValidationMessage(username);
  if (usernameError) throw new Error(usernameError);

  const { error } = await cloud.rpc('update_my_member_profile', {
    p_display_name: displayName,
    p_username: username,
  });
  if (error) throw error;
  return loadAccountProfile(userId);
}

export async function checkAccountUsernameAvailability(value) {
  const username = normalizeUsername(value);
  const validationError = usernameValidationMessage(username);
  if (validationError) return { available: false, username, validationError };

  const cloud = requireCloud();
  const { data, error } = await cloud.rpc('check_username_available', {
    p_username: username,
  });
  if (error) throw error;
  return { available: Boolean(data), username, validationError: '' };
}

function mapPlayerClaim(row, player) {
  return {
    userId: row.user_id,
    playerId: row.player_id,
    status: 'linked',
    primary: Boolean(row.is_primary),
    linkedAt: row.linked_at,
    player: player ? {
      id: player.id,
      externalId: player.external_id,
      displayName: player.display_name,
      jerseyNumber: player.jersey_number,
      primaryPosition: player.primary_position,
      active: Boolean(player.active),
      sourceUrl: player.source_url,
    } : null,
  };
}

async function playersForClaimRows(cloud, rows) {
  const playerIds = [...new Set(rows.map((row) => row.player_id).filter(Boolean))];
  if (!playerIds.length) return new Map();
  const { data, error } = await cloud
    .from('players')
    .select('id, external_id, display_name, jersey_number, primary_position, active, source_url')
    .in('id', playerIds);
  if (error) throw error;
  return new Map((data ?? []).map((player) => [player.id, player]));
}

export async function loadMemberPlayerClaims(userId) {
  if (!userId) return [];
  const cloud = requireCloud();
  const { data, error } = await cloud
    .from('member_player_claims')
    .select('user_id, player_id, is_primary, linked_at')
    .eq('user_id', userId)
    .order('is_primary', { ascending: false })
    .order('linked_at', { ascending: true });
  if (error) throw error;
  const rows = data ?? [];
  const players = await playersForClaimRows(cloud, rows);
  return rows.map((row) => mapPlayerClaim(row, players.get(row.player_id)));
}

export async function requestMemberPlayerClaim({ playerId = null, externalId = null }) {
  const cloud = requireCloud();
  const { error } = await cloud.rpc('request_member_player_claim', {
    p_player_external_id: externalId || null,
    p_player_id: playerId || null,
  });
  if (error) throw error;
}

export async function releaseMemberPlayerClaim(playerId) {
  const cloud = requireCloud();
  const { error } = await cloud.rpc('release_member_player_claim', { p_player_id: playerId });
  if (error) throw error;
}

export async function loadFavoritePlayIds(userId) {
  if (!userId) return [];
  const cloud = requireCloud();
  const { data, error } = await cloud
    .from('user_favorite_plays')
    .select('play_id')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []).map((row) => row.play_id);
}

export async function mergeFavoritePlayIds(userId, playIds) {
  if (!userId || !playIds.length) return;
  const cloud = requireCloud();
  const rows = [...new Set(playIds)].map((playId) => ({
    user_id: userId,
    play_id: playId,
  }));
  const { error } = await cloud
    .from('user_favorite_plays')
    .upsert(rows, { onConflict: 'user_id,play_id', ignoreDuplicates: true });
  if (error) throw error;
}

export async function setFavoritePlayState(userId, playId, favorited) {
  if (!userId) return;
  const cloud = requireCloud();
  if (favorited) {
    const { error } = await cloud
      .from('user_favorite_plays')
      .upsert({ user_id: userId, play_id: playId }, { onConflict: 'user_id,play_id' });
    if (error) throw error;
    return;
  }
  const { error } = await cloud
    .from('user_favorite_plays')
    .delete()
    .eq('user_id', userId)
    .eq('play_id', playId);
  if (error) throw error;
}
