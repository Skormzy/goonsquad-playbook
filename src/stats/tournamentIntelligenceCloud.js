import { getPlaymakerCloudClient } from '../playmaker/playmakerCloud';

function isMissingIntelligenceTable(error) {
  const message = String(error?.message || error || '');
  return error?.code === '42P01'
    || error?.code === 'PGRST205'
    || /tournament_opponent_intelligence/iu.test(message)
      && /not found|does not exist|schema cache/iu.test(message);
}

function mapIntelligenceRecord(row) {
  return {
    tournamentId: row.tournament_id,
    teamId: row.team_id,
    teamName: row.team_name,
    poolName: row.pool_name || '',
    priority: Number(row.priority) || 99,
    updatedAt: row.updated_at || '',
    ...(row.payload || {}),
  };
}

export async function loadTournamentOpponentIntelligence(tournamentId) {
  const cloud = getPlaymakerCloudClient();
  if (!cloud || !tournamentId) return { configured: false, records: [] };

  const { data, error } = await cloud
    .from('tournament_opponent_intelligence')
    .select('tournament_id, team_id, team_name, pool_name, priority, payload, updated_at')
    .eq('tournament_id', tournamentId)
    .order('priority', { ascending: true })
    .order('team_name', { ascending: true });

  if (error && isMissingIntelligenceTable(error)) {
    return { configured: false, records: [] };
  }
  if (error) throw error;

  return {
    configured: true,
    records: (data || []).map(mapIntelligenceRecord),
  };
}

export { isMissingIntelligenceTable };
