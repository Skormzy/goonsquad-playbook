import { getPlaymakerCloudClient } from '../playmaker/playmakerCloud';

function requireCloud() {
  const cloud = getPlaymakerCloudClient();
  if (!cloud) throw new Error('Game availability is not connected.');
  return cloud;
}

function isMissingAvailabilityTable(error) {
  const message = String(error?.message || error || '');
  return error?.code === '42P01'
    || error?.code === 'PGRST205'
    || /team_game_availability.*(?:not found|does not exist)/iu.test(message);
}

function isMissingAttendanceAccessTable(error) {
  const message = String(error?.message || error || '');
  return error?.code === '42P01'
    || error?.code === 'PGRST205'
    || /team_game_attendance_access.*(?:not found|does not exist)/iu.test(message);
}

function mapAvailability(row) {
  return {
    fixtureId: row.fixture_id,
    userId: row.user_id,
    response: row.response,
    note: row.note || '',
    updatedAt: row.updated_at,
  };
}

function mapAttendanceAccess(row) {
  return {
    scopeType: row.scope_type,
    scopeId: row.scope_id,
    userId: row.user_id,
    assignedBy: row.assigned_by || '',
    createdAt: row.created_at || '',
  };
}

export async function loadAttendanceAccess() {
  const cloud = requireCloud();
  const { data, error } = await cloud
    .from('team_game_attendance_access')
    .select('scope_type, scope_id, user_id, assigned_by, created_at')
    .order('created_at', { ascending: true });
  if (error && isMissingAttendanceAccessTable(error)) {
    return { configured: false, grants: [] };
  }
  if (error) throw error;
  return { configured: true, grants: (data || []).map(mapAttendanceAccess) };
}

export async function grantAttendanceAccess({
  scopeType,
  scopeId,
  userId,
  assignedBy,
}) {
  if (!scopeId || !userId || !assignedBy) throw new Error('Choose a member and game before granting attendance access.');
  const cloud = requireCloud();
  const { error } = await cloud
    .from('team_game_attendance_access')
    .upsert({
      scope_type: scopeType === 'tournament' ? 'tournament' : 'fixture',
      scope_id: scopeId,
      user_id: userId,
      assigned_by: assignedBy,
    }, { onConflict: 'scope_type,scope_id,user_id' });
  if (error && isMissingAttendanceAccessTable(error)) {
    throw new Error('Scoped attendance is finishing setup. Run the latest database migration, then refresh.');
  }
  if (error) throw error;
}

export async function revokeAttendanceAccess({ scopeType, scopeId, userId }) {
  const cloud = requireCloud();
  const { error } = await cloud
    .from('team_game_attendance_access')
    .delete()
    .eq('scope_type', scopeType)
    .eq('scope_id', scopeId)
    .eq('user_id', userId);
  if (error) throw error;
}

export async function loadGameAvailability(fixtureId) {
  if (!fixtureId) return { configured: true, responses: [] };
  const cloud = requireCloud();
  const { data, error } = await cloud
    .from('team_game_availability')
    .select('fixture_id, user_id, response, note, updated_at')
    .eq('fixture_id', fixtureId)
    .order('updated_at', { ascending: false });
  if (error && isMissingAvailabilityTable(error)) {
    return { configured: false, responses: [] };
  }
  if (error) throw error;
  return { configured: true, responses: (data || []).map(mapAvailability) };
}

export async function saveGameAvailability({
  fixtureId,
  userId,
  response,
  note = '',
}) {
  if (!fixtureId || !userId) throw new Error('Choose a published game before setting availability.');
  const cloud = requireCloud();
  const { error } = await cloud
    .from('team_game_availability')
    .upsert({
      fixture_id: fixtureId,
      user_id: userId,
      response,
      note: String(note || '').trim().slice(0, 140) || null,
    }, { onConflict: 'fixture_id,user_id' });
  if (error) throw error;
}
