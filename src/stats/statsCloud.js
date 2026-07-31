import { getPlaymakerCloudClient, playmakerCloudConfigured } from '../playmaker/playmakerCloud';

export const PUBLIC_STATISTICS_QUERIES = Object.freeze({
  seasons: Object.freeze({
    relation: 'public_stats_seasons',
    columns: 'id,slug,name,start_date,end_date,status,is_current,source,external_id,source_url',
  }),
  teams: Object.freeze({
    relation: 'public_stats_teams',
    columns: 'id,season_id,name,schedule_label,division,source,external_id,source_url',
  }),
  players: Object.freeze({
    relation: 'public_stats_players',
    columns: 'id,display_name,jersey_number,primary_position,source,external_id,source_url',
  }),
  memberships: Object.freeze({
    relation: 'public_stats_memberships',
    columns: 'id,season_team_id,player_id,jersey_number,position,active',
  }),
  games: Object.freeze({
    relation: 'public_stats_games',
    columns: 'id,season_team_id,stage,scheduled_at,opponent,venue,location,status,goals_for,goals_against,overtime,source,external_id,source_url,verified_at',
  }),
  teamGameStats: Object.freeze({
    relation: 'public_stats_team_game_stats',
    columns: 'game_id,shots_for,shots_against,power_play_goals,power_play_opportunities,penalty_kill_goals_against,times_shorthanded,faceoff_wins,faceoff_attempts,blocks,takeaways,turnovers,source',
  }),
  playerGameStats: Object.freeze({
    relation: 'public_stats_player_game_stats',
    columns: 'id,game_id,player_id,games_played,goals,assists,shots,penalty_minutes,plus_minus,blocks,takeaways,turnovers,power_play_goals,short_handed_goals,empty_net_goals,source',
  }),
  goalieGameStats: Object.freeze({
    relation: 'public_stats_goalie_game_stats',
    columns: 'id,game_id,player_id,games_played,wins,losses,ties,goals_against,shots_against,saves,shutouts,minutes_played,source',
  }),
  gameEvents: Object.freeze({
    relation: 'public_stats_game_events',
    columns: 'id,game_id,period,clock_seconds,event_type,team_side,primary_player_id,secondary_player_id,detail,source',
  }),
  teamSeasonSummaries: Object.freeze({
    relation: 'public_stats_team_season_summaries',
    columns: 'season_team_id,games_played,wins,losses,ties,points,source,source_url',
  }),
  playerSeasonStats: Object.freeze({
    relation: 'public_stats_player_season_stats',
    columns: 'id,season_team_id,stage,player_id,games_played,goals,assists,points,penalty_minutes,power_play_goals,short_handed_goals,empty_net_goals,source',
  }),
  goalieSeasonStats: Object.freeze({
    relation: 'public_stats_goalie_season_stats',
    columns: 'id,season_team_id,stage,player_id,games_played,wins,losses,ties,shutouts,shots_against,goals_against,minutes_played,goals_against_average,save_percentage,goals,assists,penalty_minutes,source',
  }),
});

export const PUBLIC_STATISTICS_PROJECTION_ENABLED = (
  import.meta.env.VITE_PUBLIC_STATS_PROJECTION_ENABLED === 'true'
);

async function loadBundledStatisticsDataset() {
  const { OFFICIAL_STATS_DATASET } = await import('./statsSeed');
  return OFFICIAL_STATS_DATASET;
}

function mapSeason(row) {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    startDate: row.start_date,
    endDate: row.end_date,
    status: row.status,
    current: Boolean(row.is_current),
    source: row.source || 'team',
    sourceUrl: row.source_url || null,
    externalId: row.external_id || null,
  };
}

function mapTeam(row) {
  return {
    id: row.id,
    seasonId: row.season_id,
    name: row.name,
    scheduleLabel: row.schedule_label,
    division: row.division || '',
    source: row.source || 'team',
    sourceUrl: row.source_url || null,
    externalId: row.external_id || null,
  };
}

function mapPlayer(row) {
  return {
    id: row.id,
    displayName: row.display_name,
    jerseyNumber: row.jersey_number,
    primaryPosition: row.primary_position,
    source: row.source || 'team',
    externalId: row.external_id || null,
    sourceUrl: row.source_url || null,
    persisted: true,
  };
}

async function enrichPublicPlayerAvatars(dataset, cloud) {
  if (!cloud || typeof cloud.rpc !== 'function') return dataset;
  try {
    const { data, error } = await cloud.rpc('list_public_player_avatars');
    if (error || !Array.isArray(data) || !data.length) return dataset;
    const byPlayerId = new Map();
    const byExternalId = new Map();
    data.forEach((row) => {
      const details = {
        avatarUrl: row.avatar_url || null,
        jerseyNumber: row.jersey_number || null,
        primaryPosition: row.primary_position || null,
      };
      if (row.player_id) byPlayerId.set(String(row.player_id), details);
      if (row.external_id) byExternalId.set(String(row.external_id), details);
    });
    return {
      ...dataset,
      players: dataset.players.map((player) => {
        const details = byPlayerId.get(String(player.id))
          || byExternalId.get(String(player.externalId))
          || {};
        return {
          ...player,
          avatarUrl: details.avatarUrl || player.avatarUrl || null,
          jerseyNumber: details.jerseyNumber || player.jerseyNumber || null,
          primaryPosition: details.primaryPosition || player.primaryPosition || null,
        };
      }),
    };
  } catch {
    return dataset;
  }
}

function mapMembership(row) {
  return {
    id: row.id,
    seasonTeamId: row.season_team_id,
    playerId: row.player_id,
    jerseyNumber: row.jersey_number,
    position: row.position,
    active: row.active,
    persisted: true,
  };
}

function mapGame(row) {
  return {
    id: row.id,
    seasonTeamId: row.season_team_id,
    stage: row.stage || 'regular',
    scheduledAt: row.scheduled_at,
    opponent: row.opponent,
    venue: row.venue,
    location: row.location || '',
    status: row.status,
    goalsFor: row.goals_for,
    goalsAgainst: row.goals_against,
    overtime: Boolean(row.overtime),
    externalId: row.external_id || null,
    sourceUrl: row.source_url || null,
    source: row.source || 'team',
    persisted: true,
    verified: Boolean(row.verified_at),
    verifiedAt: row.verified_at || null,
  };
}

function mapTeamSeasonSummary(row) {
  return {
    seasonTeamId: row.season_team_id,
    gamesPlayed: row.games_played,
    wins: row.wins,
    losses: row.losses,
    ties: row.ties,
    points: row.points,
    source: row.source || 'team',
    sourceUrl: row.source_url || null,
  };
}

function mapPlayerSeasonLine(row) {
  return {
    id: row.id,
    seasonTeamId: row.season_team_id,
    stage: row.stage || 'regular',
    playerId: row.player_id,
    gamesPlayed: row.games_played,
    goals: row.goals,
    assists: row.assists,
    points: row.points,
    penaltyMinutes: row.penalty_minutes,
    powerPlayGoals: row.power_play_goals,
    shortHandedGoals: row.short_handed_goals,
    emptyNetGoals: row.empty_net_goals,
    source: row.source || 'team',
  };
}

function mapGoalieSeasonLine(row) {
  return {
    id: row.id,
    seasonTeamId: row.season_team_id,
    stage: row.stage || 'regular',
    playerId: row.player_id,
    gamesPlayed: row.games_played,
    wins: row.wins,
    losses: row.losses,
    ties: row.ties,
    shutouts: row.shutouts,
    shotsAgainst: row.shots_against,
    goalsAgainst: row.goals_against,
    minutesPlayed: row.minutes_played,
    goalsAgainstAverage: row.goals_against_average,
    savePercentage: row.save_percentage,
    goals: row.goals,
    assists: row.assists,
    penaltyMinutes: row.penalty_minutes,
    source: row.source || 'team',
  };
}

function mergeBy(items, additions, key) {
  const merged = new Map(items.map((item) => [key(item), item]));
  additions.forEach((item) => merged.set(key(item), item));
  return [...merged.values()];
}

export function mergeStatisticsDatasets(base, additions) {
  const leaguePlayerIds = new Set(additions.players.filter((player) => player.source === 'league').map((player) => player.id));
  const importedLeagueGames = additions.games.filter((game) => game.source === 'league');
  const importedLeaguePlayerTotals = additions.playerSeasonStats.filter((line) => line.source === 'league');
  const importedLeagueGoalieTotals = additions.goalieSeasonStats.filter((line) => line.source === 'league');
  const importedLeagueTeamGameStats = additions.teamGameStats.filter((line) => line.source === 'league');
  const importedLeaguePlayerGameStats = additions.playerGameStats.filter((line) => line.source === 'league');
  const importedLeagueGoalieGameStats = additions.goalieGameStats.filter((line) => line.source === 'league');
  const importedLeagueEvents = (additions.gameEvents || []).filter((event) => event.source === 'league');
  const baseCapturedAt = Date.parse(base.capturedAt || '');
  const latestLeagueVerification = importedLeagueGames.reduce((latest, game) => {
    const verifiedAt = Date.parse(game.verifiedAt || '');
    return Number.isFinite(verifiedAt) ? Math.max(latest, verifiedAt) : latest;
  }, Number.NEGATIVE_INFINITY);
  const leagueImportFresh = !Number.isFinite(baseCapturedAt) || latestLeagueVerification >= baseCapturedAt;
  const completeLeagueImport = leagueImportFresh
    && importedLeagueGames.length >= base.games.length
    && importedLeaguePlayerTotals.length >= base.playerSeasonStats.length
    && importedLeagueGoalieTotals.length >= base.goalieSeasonStats.length
    && importedLeagueTeamGameStats.length >= base.teamGameStats.length
    && importedLeaguePlayerGameStats.length >= base.playerGameStats.length
    && importedLeagueGoalieGameStats.length >= base.goalieGameStats.length
    && importedLeagueEvents.length >= (base.gameEvents || []).length;
  const cloudPlayers = completeLeagueImport ? additions.players : additions.players.filter((player) => player.source !== 'league');
  const cloudMemberships = completeLeagueImport ? additions.memberships : additions.memberships.filter((membership) => !leaguePlayerIds.has(membership.playerId));
  const cloudGames = completeLeagueImport ? additions.games : additions.games.filter((game) => game.source !== 'league');
  const cloudTeamSummaries = completeLeagueImport ? additions.teamSeasonSummaries : additions.teamSeasonSummaries.filter((summary) => summary.source !== 'league');
  const cloudPlayerTotals = completeLeagueImport ? additions.playerSeasonStats : additions.playerSeasonStats.filter((line) => line.source !== 'league');
  const cloudGoalieTotals = completeLeagueImport ? additions.goalieSeasonStats : additions.goalieSeasonStats.filter((line) => line.source !== 'league');
  const cloudTeamGameStats = completeLeagueImport ? additions.teamGameStats : additions.teamGameStats.filter((line) => line.source !== 'league');
  const cloudPlayerGameStats = completeLeagueImport ? additions.playerGameStats : additions.playerGameStats.filter((line) => line.source !== 'league');
  const cloudGoalieGameStats = completeLeagueImport ? additions.goalieGameStats : additions.goalieGameStats.filter((line) => line.source !== 'league');
  const cloudGameEvents = completeLeagueImport ? (additions.gameEvents || []) : (additions.gameEvents || []).filter((event) => event.source !== 'league');
  return {
    ...base,
    source: additions.source === 'cloud' ? 'league-and-team' : base.source,
    seasons: mergeBy(base.seasons, additions.seasons, (item) => item.id),
    teams: mergeBy(base.teams, additions.teams, (item) => item.id),
    players: completeLeagueImport ? cloudPlayers : mergeBy(base.players, cloudPlayers, (item) => item.id),
    memberships: completeLeagueImport ? cloudMemberships : mergeBy(base.memberships, cloudMemberships, (item) => item.id),
    games: completeLeagueImport ? cloudGames : mergeBy(base.games, cloudGames, (item) => item.id),
    teamGameStats: completeLeagueImport ? cloudTeamGameStats : mergeBy(base.teamGameStats, cloudTeamGameStats, (item) => item.game_id ?? item.gameId),
    playerGameStats: completeLeagueImport ? cloudPlayerGameStats : mergeBy(base.playerGameStats, cloudPlayerGameStats, (item) => item.id),
    goalieGameStats: completeLeagueImport ? cloudGoalieGameStats : mergeBy(base.goalieGameStats, cloudGoalieGameStats, (item) => item.id),
    gameEvents: completeLeagueImport ? cloudGameEvents : mergeBy(base.gameEvents || [], cloudGameEvents, (item) => item.id),
    teamSeasonSummaries: completeLeagueImport ? cloudTeamSummaries : mergeBy(base.teamSeasonSummaries, cloudTeamSummaries, (item) => item.seasonTeamId),
    playerSeasonStats: completeLeagueImport ? cloudPlayerTotals : mergeBy(base.playerSeasonStats, cloudPlayerTotals, (item) => item.id),
    goalieSeasonStats: completeLeagueImport ? cloudGoalieTotals : mergeBy(base.goalieSeasonStats, cloudGoalieTotals, (item) => item.id),
    leagueImportComplete: completeLeagueImport,
    leagueImportFresh,
  };
}

function mapPlayerLine(row) {
  return {
    id: row.id,
    gameId: row.game_id,
    playerId: row.player_id,
    gamesPlayed: row.games_played,
    goals: row.goals,
    assists: row.assists,
    shots: row.shots,
    penaltyMinutes: row.penalty_minutes,
    plusMinus: row.plus_minus,
    blocks: row.blocks,
    takeaways: row.takeaways,
    turnovers: row.turnovers,
    powerPlayGoals: row.power_play_goals,
    shortHandedGoals: row.short_handed_goals,
    emptyNetGoals: row.empty_net_goals,
    source: row.source || 'team',
  };
}

function mapGoalieLine(row) {
  return {
    id: row.id,
    gameId: row.game_id,
    playerId: row.player_id,
    gamesPlayed: row.games_played,
    wins: row.wins,
    losses: row.losses,
    ties: row.ties,
    goalsAgainst: row.goals_against,
    shotsAgainst: row.shots_against,
    saves: row.saves,
    shutouts: row.shutouts,
    minutesPlayed: row.minutes_played,
    source: row.source || 'team',
  };
}

function mapTeamGameLine(row) {
  return {
    gameId: row.game_id,
    shotsFor: row.shots_for,
    shotsAgainst: row.shots_against,
    powerPlayGoals: row.power_play_goals,
    powerPlayOpportunities: row.power_play_opportunities,
    penaltyKillGoalsAgainst: row.penalty_kill_goals_against,
    timesShorthanded: row.times_shorthanded,
    faceoffWins: row.faceoff_wins,
    faceoffAttempts: row.faceoff_attempts,
    blocks: row.blocks,
    takeaways: row.takeaways,
    turnovers: row.turnovers,
    source: row.source || 'team',
  };
}

function mapGameEvent(row) {
  return {
    id: row.id,
    gameId: row.game_id,
    period: row.period,
    clockSeconds: row.clock_seconds,
    eventType: row.event_type,
    teamSide: row.team_side,
    primaryPlayerId: row.primary_player_id,
    secondaryPlayerId: row.secondary_player_id,
    detail: row.detail || {},
    source: row.source || 'team',
  };
}

async function checked(query) {
  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export async function readAllPages(queryFactory, pageSize = 1000) {
  if (typeof queryFactory !== 'function') throw new TypeError('A statistics query factory is required.');
  if (!Number.isInteger(pageSize) || pageSize < 1) throw new RangeError('Statistics page size must be a positive integer.');

  const rows = [];
  for (let from = 0; ; from += pageSize) {
    const page = await checked(queryFactory().range(from, from + pageSize - 1));
    rows.push(...page);
    if (page.length < pageSize) return rows;
  }
}

function isStatisticsDataset(value) {
  return value
    && Array.isArray(value.seasons)
    && Array.isArray(value.teams)
    && Array.isArray(value.games)
    && Array.isArray(value.players);
}

export async function loadRuntimeStatisticsDataset(fetcher = globalThis.fetch) {
  if (typeof fetcher !== 'function') return loadBundledStatisticsDataset();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);
  try {
    const basePath = import.meta.env.BASE_URL || '/';
    const response = await fetcher(`${basePath}data/team-statistics.json?refresh=${Date.now()}`, {
      cache: 'no-store',
      signal: controller.signal,
    });
    if (!response.ok) return loadBundledStatisticsDataset();
    const dataset = await response.json();
    return isStatisticsDataset(dataset) ? dataset : loadBundledStatisticsDataset();
  } catch {
    return loadBundledStatisticsDataset();
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function loadStatisticsDataset({
  useCloudProjection = PUBLIC_STATISTICS_PROJECTION_ENABLED,
} = {}) {
  const runtimeDataset = await loadRuntimeStatisticsDataset();
  const cloud = getPlaymakerCloudClient();
  if (!playmakerCloudConfigured || !cloud) return runtimeDataset;
  if (!useCloudProjection) return enrichPublicPlayerAvatars(runtimeDataset, cloud);
  try {
    const queries = PUBLIC_STATISTICS_QUERIES;
    const [seasons, teams, players, memberships, games, teamGameStats, playerGameStats, goalieGameStats, gameEvents, teamSeasonSummaries, playerSeasonStats, goalieSeasonStats] = await Promise.all([
      readAllPages(() => cloud.from(queries.seasons.relation).select(queries.seasons.columns).order('start_date', { ascending: false }).order('id', { ascending: true })),
      readAllPages(() => cloud.from(queries.teams.relation).select(queries.teams.columns).order('schedule_label', { ascending: true }).order('id', { ascending: true })),
      readAllPages(() => cloud.from(queries.players.relation).select(queries.players.columns).order('display_name', { ascending: true }).order('id', { ascending: true })),
      readAllPages(() => cloud.from(queries.memberships.relation).select(queries.memberships.columns).order('id', { ascending: true })),
      readAllPages(() => cloud.from(queries.games.relation).select(queries.games.columns).order('scheduled_at', { ascending: false }).order('id', { ascending: true })),
      readAllPages(() => cloud.from(queries.teamGameStats.relation).select(queries.teamGameStats.columns).order('game_id', { ascending: true })),
      readAllPages(() => cloud.from(queries.playerGameStats.relation).select(queries.playerGameStats.columns).order('id', { ascending: true })),
      readAllPages(() => cloud.from(queries.goalieGameStats.relation).select(queries.goalieGameStats.columns).order('id', { ascending: true })),
      readAllPages(() => cloud.from(queries.gameEvents.relation).select(queries.gameEvents.columns).order('id', { ascending: true })),
      readAllPages(() => cloud.from(queries.teamSeasonSummaries.relation).select(queries.teamSeasonSummaries.columns).order('season_team_id', { ascending: true })),
      readAllPages(() => cloud.from(queries.playerSeasonStats.relation).select(queries.playerSeasonStats.columns).order('id', { ascending: true })),
      readAllPages(() => cloud.from(queries.goalieSeasonStats.relation).select(queries.goalieSeasonStats.columns).order('id', { ascending: true })),
    ]);
    const merged = mergeStatisticsDatasets(runtimeDataset, {
      source: 'cloud',
      seasons: seasons.map(mapSeason),
      teams: teams.map(mapTeam),
      players: players.map(mapPlayer),
      memberships: memberships.map(mapMembership),
      games: games.map(mapGame),
      teamGameStats: teamGameStats.map(mapTeamGameLine),
      playerGameStats: playerGameStats.map(mapPlayerLine),
      goalieGameStats: goalieGameStats.map(mapGoalieLine),
      gameEvents: gameEvents.map(mapGameEvent),
      teamSeasonSummaries: teamSeasonSummaries.map(mapTeamSeasonSummary),
      playerSeasonStats: playerSeasonStats.map(mapPlayerSeasonLine),
      goalieSeasonStats: goalieSeasonStats.map(mapGoalieSeasonLine),
    });
    return enrichPublicPlayerAvatars(merged, cloud);
  } catch {
    return enrichPublicPlayerAvatars(runtimeDataset, cloud);
  }
}

export async function addRosterPlayer({ seasonTeamId, displayName, jerseyNumber, position }) {
  const cloud = getPlaymakerCloudClient();
  if (!cloud) throw new Error('Team statistics are not connected.');
  const { data, error } = await cloud.rpc('add_roster_player', {
    p_season_team_id: seasonTeamId,
    p_display_name: displayName,
    p_jersey_number: jerseyNumber || null,
    p_position: position || null,
  });
  if (error) throw error;
  return data;
}

export async function recordGameResult({ seasonTeamId, scheduledAt, opponent, venue, goalsFor, goalsAgainst, overtime, notes }) {
  const cloud = getPlaymakerCloudClient();
  if (!cloud) throw new Error('Team statistics are not connected.');
  const { data, error } = await cloud.rpc('record_team_game', {
    p_season_team_id: seasonTeamId,
    p_scheduled_at: scheduledAt,
    p_opponent: opponent,
    p_venue: venue,
    p_goals_for: Number(goalsFor),
    p_goals_against: Number(goalsAgainst),
    p_overtime: Boolean(overtime),
    p_notes: notes || '',
  });
  if (error) throw error;
  return data;
}

export async function savePlayerGameLine({ gameId, playerId, goals, assists, shots, penaltyMinutes, plusMinus, blocks, takeaways, turnovers }) {
  const cloud = getPlaymakerCloudClient();
  if (!cloud) throw new Error('Team statistics are not connected.');
  const { data, error } = await cloud
    .from('player_game_stats')
    .upsert({
      game_id: gameId,
      player_id: playerId,
      games_played: 1,
      goals: Number(goals || 0),
      assists: Number(assists || 0),
      shots: Number(shots || 0),
      penalty_minutes: Number(penaltyMinutes || 0),
      plus_minus: Number(plusMinus || 0),
      blocks: Number(blocks || 0),
      takeaways: Number(takeaways || 0),
      turnovers: Number(turnovers || 0),
    }, { onConflict: 'game_id,player_id' })
    .select('id')
    .single();
  if (error) throw error;
  return data;
}

export async function saveGoalieGameLine({ gameId, playerId, result, goalsAgainst, shotsAgainst, saves, shutout, minutesPlayed }) {
  const cloud = getPlaymakerCloudClient();
  if (!cloud) throw new Error('Team statistics are not connected.');
  const { data, error } = await cloud
    .from('goalie_game_stats')
    .upsert({
      game_id: gameId,
      player_id: playerId,
      games_played: 1,
      wins: result === 'win' ? 1 : 0,
      losses: result === 'loss' ? 1 : 0,
      ties: result === 'tie' ? 1 : 0,
      goals_against: Number(goalsAgainst || 0),
      shots_against: Number(shotsAgainst || 0),
      saves: Number(saves || 0),
      shutouts: shutout ? 1 : 0,
      minutes_played: Number(minutesPlayed || 0),
    }, { onConflict: 'game_id,player_id' })
    .select('id')
    .single();
  if (error) throw error;
  return data;
}
