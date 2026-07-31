import { getPlaymakerCloudClient } from '../playmaker/playmakerCloud';
import { normalizeUsername, usernameValidationMessage } from './username';

const PROFILE_FIELDS = 'id, username, display_name, avatar_url, role, created_at, updated_at';
const LEGACY_PROFILE_FIELDS = 'id, display_name, avatar_url, role, created_at, updated_at';
const AVATAR_BUCKET = 'member-avatars';
const MAX_AVATAR_SOURCE_BYTES = 20 * 1024 * 1024;
const MAX_AVATAR_EDGE = 1600;

function requireCloud() {
  const cloud = getPlaymakerCloudClient();
  if (!cloud) throw new Error('Team accounts are not configured for this deployment.');
  return cloud;
}

export async function bootstrapAccountOwner(accessToken) {
  if (!accessToken) return false;
  const response = await fetch('/api/auth/bootstrap-owner', {
    method: 'POST',
    credentials: 'same-origin',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || 'Owner access could not be configured.');
  return Boolean(payload.promoted);
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

export async function updateLinkedPlayerDetails(playerId, {
  jerseyNumber = '',
  position = '',
} = {}) {
  if (!playerId) throw new Error('Link a player profile before adding roster details.');
  const normalizedNumber = String(jerseyNumber || '').trim();
  const normalizedPosition = String(position || '').trim().toUpperCase();
  if (normalizedNumber && !/^\d{1,3}$/u.test(normalizedNumber)) {
    throw new Error('Use up to three digits for the player number.');
  }
  if (normalizedPosition && !['G', 'D', 'C', 'W'].includes(normalizedPosition)) {
    throw new Error('Choose Goalie, Defence, Center, or Winger.');
  }
  const cloud = requireCloud();
  const { error } = await cloud.rpc('update_linked_player_details', {
    p_jersey_number: normalizedNumber || null,
    p_player_id: playerId,
    p_primary_position: normalizedPosition || null,
  });
  if (error) throw error;
}

function imageElementForFile(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('This picture format could not be read on this device.'));
    };
    image.src = url;
  });
}

function canvasBlob(canvas, type, quality) {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

async function prepareAccountAvatar(file) {
  if (!(file instanceof Blob) || !String(file.type || '').startsWith('image/')) {
    throw new Error('Choose a picture from your device.');
  }
  if (file.size > MAX_AVATAR_SOURCE_BYTES) {
    throw new Error('Choose a picture smaller than 20 MB.');
  }

  const image = await imageElementForFile(file);
  const scale = Math.min(1, MAX_AVATAR_EDGE / Math.max(image.naturalWidth, image.naturalHeight));
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d', { alpha: false });
  if (!context) throw new Error('This device could not prepare the picture.');
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, width, height);
  context.drawImage(image, 0, 0, width, height);
  const blob = await canvasBlob(canvas, 'image/webp', 0.86)
    || await canvasBlob(canvas, 'image/jpeg', 0.9);
  if (!blob) throw new Error('This device could not prepare the picture.');
  return blob;
}

function avatarStoragePath(url, userId) {
  if (!url || !userId) return '';
  try {
    const marker = `/storage/v1/object/public/${AVATAR_BUCKET}/`;
    const path = decodeURIComponent(new URL(url).pathname);
    const markerIndex = path.indexOf(marker);
    const objectPath = markerIndex >= 0 ? path.slice(markerIndex + marker.length) : '';
    return objectPath.startsWith(`${userId}/`) ? objectPath : '';
  } catch {
    return '';
  }
}

export async function uploadAccountAvatar(userId, file) {
  if (!userId) throw new Error('Sign in before adding a player picture.');
  const cloud = requireCloud();
  const current = await loadAccountProfile(userId);
  const avatar = await prepareAccountAvatar(file);
  const path = `${userId}/profile-${Date.now()}.webp`;
  const { error: uploadError } = await cloud.storage
    .from(AVATAR_BUCKET)
    .upload(path, avatar, {
      cacheControl: '3600',
      contentType: avatar.type || 'image/webp',
      upsert: false,
    });
  if (uploadError) throw uploadError;

  const { data } = cloud.storage.from(AVATAR_BUCKET).getPublicUrl(path);
  const publicUrl = data?.publicUrl;
  if (!publicUrl) {
    await cloud.storage.from(AVATAR_BUCKET).remove([path]);
    throw new Error('The player picture URL could not be created.');
  }

  const { error: profileError } = await cloud
    .from('profiles')
    .update({ avatar_url: publicUrl, updated_at: new Date().toISOString() })
    .eq('id', userId);
  if (profileError) {
    await cloud.storage.from(AVATAR_BUCKET).remove([path]);
    throw profileError;
  }

  const oldPath = avatarStoragePath(current?.avatar_url, userId);
  if (oldPath && oldPath !== path) {
    await cloud.storage.from(AVATAR_BUCKET).remove([oldPath]);
  }
  return loadAccountProfile(userId);
}

export async function removeAccountAvatar(userId) {
  if (!userId) throw new Error('Sign in before removing a player picture.');
  const cloud = requireCloud();
  const current = await loadAccountProfile(userId);
  const { error } = await cloud
    .from('profiles')
    .update({ avatar_url: null, updated_at: new Date().toISOString() })
    .eq('id', userId);
  if (error) throw error;
  const oldPath = avatarStoragePath(current?.avatar_url, userId);
  if (oldPath) await cloud.storage.from(AVATAR_BUCKET).remove([oldPath]);
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
  const status = row.status || 'approved';
  return {
    userId: row.user_id,
    playerId: row.player_id,
    status,
    primary: Boolean(row.is_primary),
    linkedAt: row.linked_at,
    requestedAt: row.requested_at || row.linked_at,
    reviewedAt: row.reviewed_at || null,
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
  const result = await cloud
    .from('member_player_claims')
    .select('user_id, player_id, status, is_primary, requested_at, reviewed_at, linked_at')
    .eq('user_id', userId)
    .order('is_primary', { ascending: false })
    .order('requested_at', { ascending: true });

  let rows = result.data ?? [];
  if (result.error) {
    const missingApprovalColumns = /status|requested_at|reviewed_at/iu.test(
      String(result.error.message || ''),
    );
    if (!missingApprovalColumns) throw result.error;
    const legacy = await cloud
      .from('member_player_claims')
      .select('user_id, player_id, is_primary, linked_at')
      .eq('user_id', userId)
      .order('is_primary', { ascending: false })
      .order('linked_at', { ascending: true });
    if (legacy.error) throw legacy.error;
    rows = legacy.data ?? [];
  }

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
