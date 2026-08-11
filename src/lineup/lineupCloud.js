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

function isMissingEpManagement(error) {
  const message = String(error?.message || error || '');
  return error?.code === '42P01'
    || error?.code === 'PGRST202'
    || error?.code === 'PGRST205'
    || /(?:team_game_ep_roster|list_game_ep_roster|manage_game_ep).*(?:not found|does not exist)/iu.test(message);
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

function mapGameEp(row) {
  return {
    id: `ep:${row.player_id}`,
    playerId: row.player_id,
    playerExternalId: row.external_id || '',
    displayName: row.display_name,
    jerseyNumber: row.jersey_number || '',
    position: row.primary_position || '',
    sourceUrl: row.source_url || '',
    response: row.response,
    note: row.note || '',
    entrySource: row.entry_source || 'league',
    updatedAt: row.updated_at || '',
    attendanceRole: 'EP',
    trackingOnly: true,
  };
}

function fixtureDetails(fixtureOrId) {
  if (typeof fixtureOrId === 'string') return { id: fixtureOrId };
  return fixtureOrId || {};
}

export async function ensureGameAttendanceFixture(fixtureOrId) {
  const fixture = fixtureDetails(fixtureOrId);
  if (!fixture.id || (!fixture.seasonTeamId && !fixture.tournamentId)) return;
  const cloud = requireCloud();
  const { error } = await cloud.rpc('register_game_attendance_fixture', {
    p_fixture_id: fixture.id,
    p_season_team_id: fixture.seasonTeamId || null,
    p_tournament_id: fixture.tournamentId || null,
    p_scheduled_at: fixture.scheduledAt || null,
    p_opponent: fixture.opponent || null,
  });
  if (error?.code === 'PGRST202') {
    throw new Error('Attendance is finishing a live update. Refresh in a moment.');
  }
  if (error) throw error;
}

function epPayload({
  action,
  fixtureId,
  playerId = null,
  playerExternalId = '',
  displayName = '',
  jerseyNumber = '',
  position = '',
  sourceUrl = '',
  entrySource = 'league',
  response = 'in',
  note = '',
}) {
  return {
    p_action: action,
    p_fixture_id: fixtureId,
    p_player_id: playerId,
    p_player_external_id: playerExternalId || null,
    p_display_name: displayName || null,
    p_jersey_number: jerseyNumber || null,
    p_primary_position: position || null,
    p_source_url: sourceUrl || null,
    p_entry_source: entrySource,
    p_response: response,
    p_note: note || null,
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

export async function loadGameEpRoster(fixtureOrId) {
  const fixture = fixtureDetails(fixtureOrId);
  const fixtureId = fixture.id;
  if (!fixtureId) return { configured: true, players: [] };
  await ensureGameAttendanceFixture(fixture);
  const cloud = requireCloud();
  const { data, error } = await cloud.rpc('list_game_ep_roster', {
    p_fixture_id: fixtureId,
  });
  if (error && isMissingEpManagement(error)) {
    return { configured: false, players: [] };
  }
  if (error) throw error;
  return { configured: true, players: (data || []).map(mapGameEp) };
}

export async function addGameEp(details) {
  const cloud = requireCloud();
  const { error } = await cloud.rpc('manage_game_ep', epPayload({
    ...details,
    action: 'add',
  }));
  if (error && isMissingEpManagement(error)) {
    throw new Error('EP management is finishing setup. Run the latest database migration, then refresh.');
  }
  if (error) throw error;
}

export async function updateGameEp({ fixtureId, playerId, response, note = '' }) {
  const cloud = requireCloud();
  const { error } = await cloud.rpc('manage_game_ep', epPayload({
    action: 'update',
    fixtureId,
    playerId,
    response,
    note,
  }));
  if (error) throw error;
}

export async function removeGameEp({ fixtureId, playerId }) {
  const cloud = requireCloud();
  const { error } = await cloud.rpc('manage_game_ep', epPayload({
    action: 'remove',
    fixtureId,
    playerId,
  }));
  if (error) throw error;
}

export async function loadGameAvailability(fixtureOrId) {
  const fixture = fixtureDetails(fixtureOrId);
  const fixtureId = fixture.id;
  if (!fixtureId) return { configured: true, responses: [] };
  await ensureGameAttendanceFixture(fixture);
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
  fixture = null,
  fixtureId,
  userId,
  response,
  note = '',
}) {
  const attendanceFixture = fixture || { id: fixtureId };
  const resolvedFixtureId = attendanceFixture.id || fixtureId;
  if (!resolvedFixtureId || !userId) throw new Error('Choose a published game before setting availability.');
  const cloud = requireCloud();
  const { data, error } = await cloud.rpc('set_my_game_availability', {
    p_fixture_id: resolvedFixtureId,
    p_season_team_id: attendanceFixture.seasonTeamId || null,
    p_tournament_id: attendanceFixture.tournamentId || null,
    p_scheduled_at: attendanceFixture.scheduledAt || null,
    p_opponent: attendanceFixture.opponent || null,
    p_response: response,
    p_note: String(note || '').trim().slice(0, 140) || null,
  });
  if (error?.code === 'PGRST202') {
    throw new Error('Attendance is finishing a live update. Refresh in a moment.');
  }
  if (error) throw error;
  const saved = Array.isArray(data) ? data[0] : data;
  if (!saved
    || saved.fixture_id !== resolvedFixtureId
    || saved.user_id !== userId
    || saved.response !== response) {
    throw new Error('The server did not confirm your attendance response.');
  }
  return mapAvailability(saved);
}
