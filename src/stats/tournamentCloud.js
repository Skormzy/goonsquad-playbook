import { getPlaymakerCloudClient } from '../playmaker/playmakerCloud';
import { mergeTournamentRecords, tournamentForPersistence } from './tournamentModel';

function requireCloud() {
  const cloud = getPlaymakerCloudClient();
  if (!cloud) throw new Error('Tournament management is not connected.');
  return cloud;
}

export function isMissingTournamentControlRoom(error) {
  const message = String(error?.message || error || '');
  return error?.code === '42P01'
    || error?.code === '42883'
    || error?.code === 'PGRST202'
    || error?.code === 'PGRST205'
    || /team_tournaments|list_public_team_tournaments/iu.test(message)
      && /not found|does not exist|schema cache/iu.test(message);
}

function mapRecord(row) {
  return {
    id: row.id,
    payload: row.payload || null,
    isPublished: Boolean(row.is_published),
    updatedAt: row.updated_at || '',
  };
}

export async function loadTournamentArchive(seedTournaments, { includeDrafts = false } = {}) {
  const cloud = getPlaymakerCloudClient();
  if (!cloud) {
    return {
      configured: false,
      tournaments: mergeTournamentRecords(seedTournaments),
      records: [],
    };
  }

  const request = includeDrafts
    ? cloud
      .from('team_tournaments')
      .select('id, payload, is_published, updated_at')
      .order('updated_at', { ascending: false })
    : cloud.rpc('list_public_team_tournaments');
  const { data, error } = await request;
  if (error && isMissingTournamentControlRoom(error)) {
    return {
      configured: false,
      tournaments: mergeTournamentRecords(seedTournaments),
      records: [],
    };
  }
  if (error) throw error;
  const records = (data || []).map(mapRecord);
  return {
    configured: true,
    tournaments: mergeTournamentRecords(seedTournaments, records, { includeDrafts }),
    records,
  };
}

export async function saveTournament(tournament, { isPublished = true, userId } = {}) {
  if (!userId) throw new Error('Sign in as an admin before saving a tournament.');
  const cloud = requireCloud();
  const payload = tournamentForPersistence(tournament);
  const { data, error } = await cloud
    .from('team_tournaments')
    .upsert({
      id: payload.id,
      payload,
      is_published: Boolean(isPublished),
      created_by: userId,
      updated_by: userId,
    }, { onConflict: 'id' })
    .select('id, payload, is_published, updated_at')
    .single();
  if (error) throw error;
  return mapRecord(data);
}

export async function deleteTournamentOverride(tournamentId) {
  const cloud = requireCloud();
  const { error } = await cloud.from('team_tournaments').delete().eq('id', tournamentId);
  if (error) throw error;
}
