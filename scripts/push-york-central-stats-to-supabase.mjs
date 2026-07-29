import { readFile } from 'node:fs/promises';
import process from 'node:process';
import { createClient } from '@supabase/supabase-js';
import snapshot from '../src/stats/yorkCentralSnapshot.json' with { type: 'json' };

async function loadLocalEnvironment() {
  try {
    const contents = await readFile(new URL('../.env.local', import.meta.url), 'utf8');
    for (const line of contents.split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (!match || process.env[match[1]]) continue;
      const value = match[2].replace(/^(['"])(.*)\1$/, '$2');
      process.env[match[1]] = value;
    }
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }
}

await loadLocalEnvironment();

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const publishableKey = process.env.VITE_SUPABASE_ANON_KEY;
let bridgeToken = '';

try {
  bridgeToken = (await readFile(new URL('../.goonsquad-statistics-import.local', import.meta.url), 'utf8')).trim();
} catch (error) {
  if (error?.code !== 'ENOENT') throw error;
}

const useImportBridge = !serviceRoleKey;
const apiKey = serviceRoleKey || publishableKey;

if (!supabaseUrl || !apiKey || (useImportBridge && !bridgeToken)) {
  process.stderr.write(
    'Configure .env.local and run npm run supabase:statistics:bridge:build before importing official statistics.\n',
  );
  process.exit(1);
}

const cloud = createClient(supabaseUrl, apiKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function upsert(table, rows, onConflict, { returning = false } = {}) {
  if (!rows.length) return [];
  const output = [];
  for (let index = 0; index < rows.length; index += 100) {
    const chunk = rows.slice(index, index + 100);
    if (useImportBridge) {
      const { data, error } = await cloud.rpc('goonsquad_archive_upsert', {
        p_token: bridgeToken,
        p_table: table,
        p_rows: chunk,
      });
      if (error) throw new Error(`${table}: ${error.message}`);
      if (data !== chunk.length) {
        throw new Error(`${table}: expected ${chunk.length} imported rows but the bridge reported ${data}.`);
      }
      continue;
    }

    let query = cloud.from(table).upsert(chunk, { onConflict });
    if (returning) query = query.select('*');
    const { data, error } = await query;
    if (error) throw new Error(`${table}: ${error.message}`);
    if (data) output.push(...data);
  }
  return output;
}

async function importSnapshot() {
  await upsert('seasons', snapshot.seasons.map((season) => ({
    id: season.id,
    slug: season.slug,
    name: season.name,
    start_date: season.startDate,
    end_date: season.endDate,
    status: season.status,
    is_current: season.current,
    is_visible: true,
    source: 'league',
    source_url: snapshot.sourceUrl,
  })), 'id');

  await upsert('season_teams', snapshot.teams.map((team) => ({
    id: team.id,
    season_id: team.seasonId,
    name: team.name,
    schedule_label: team.scheduleLabel,
    division: team.division,
    source: 'league',
    external_id: team.externalId,
    source_url: team.sourceUrl,
  })), 'id');

  const leaguePlayers = snapshot.players.filter((player) => player.externalId);
  await upsert('players', leaguePlayers.map((player) => ({
    display_name: player.displayName,
    primary_position: player.primaryPosition,
    active: player.active,
    source: 'league',
    external_id: player.externalId,
    source_url: player.sourceUrl,
  })), 'source,external_id');

  const { data: playerRows, error: playerError } = await cloud
    .from('players')
    .select('id,external_id')
    .eq('source', 'league');
  if (playerError) throw new Error(`players: ${playerError.message}`);
  const playerIdByExternalId = new Map(playerRows.map((player) => [player.external_id, player.id]));
  const sourcePlayerById = new Map(snapshot.players.map((player) => [player.id, player]));
  const playerUuid = (sourcePlayerId) => {
    const sourcePlayer = sourcePlayerById.get(sourcePlayerId);
    const id = playerIdByExternalId.get(sourcePlayer?.externalId);
    if (!id) throw new Error(`No cloud player ID resolved for ${sourcePlayerId}.`);
    return id;
  };

  await upsert('roster_memberships', snapshot.memberships.map((membership) => ({
    season_team_id: membership.seasonTeamId,
    player_id: playerUuid(membership.playerId),
    jersey_number: membership.jerseyNumber,
    position: membership.position,
    active: membership.active,
    notes: membership.notes || '',
  })), 'season_team_id,player_id');

  await upsert('games', snapshot.games.filter((game) => game.externalId).map((game) => ({
    season_team_id: game.seasonTeamId,
    stage: game.stage,
    scheduled_at: game.scheduledAt,
    opponent: game.opponent,
    venue: game.venue,
    location: game.location,
    status: game.status,
    goals_for: game.goalsFor,
    goals_against: game.goalsAgainst,
    overtime: game.overtime,
    notes: game.notes,
    source: 'league',
    external_id: game.externalId,
    source_url: game.sourceUrl,
    verified_at: snapshot.capturedAt,
  })), 'source,external_id');

  const { data: gameRows, error: gameError } = await cloud
    .from('games')
    .select('id,external_id')
    .eq('source', 'league');
  if (gameError) throw new Error(`games: ${gameError.message}`);
  const gameIdByExternalId = new Map(gameRows.map((game) => [game.external_id, game.id]));
  const sourceGameById = new Map(snapshot.games.map((game) => [game.id, game]));
  const gameUuid = (sourceGameId) => {
    const sourceGame = sourceGameById.get(sourceGameId);
    const id = gameIdByExternalId.get(sourceGame?.externalId);
    if (!id) throw new Error(`No cloud game ID resolved for ${sourceGameId}.`);
    return id;
  };

  await upsert('team_game_stats', snapshot.teamGameStats.map((line) => ({
    game_id: gameUuid(line.gameId),
    shots_for: line.shotsFor,
    shots_against: line.shotsAgainst,
    power_play_goals: line.powerPlayGoals,
    power_play_opportunities: line.powerPlayOpportunities,
    penalty_kill_goals_against: line.penaltyKillGoalsAgainst,
    times_shorthanded: line.timesShorthanded,
    faceoff_wins: line.faceoffWins,
    faceoff_attempts: line.faceoffAttempts,
    blocks: line.blocks,
    takeaways: line.takeaways,
    turnovers: line.turnovers,
    source: 'league',
  })), 'game_id');

  await upsert('player_game_stats', snapshot.playerGameStats.map((line) => ({
    game_id: gameUuid(line.gameId),
    player_id: playerUuid(line.playerId),
    games_played: line.gamesPlayed,
    goals: line.goals,
    assists: line.assists,
    shots: line.shots,
    penalty_minutes: line.penaltyMinutes,
    plus_minus: line.plusMinus,
    blocks: line.blocks,
    takeaways: line.takeaways,
    turnovers: line.turnovers,
    power_play_goals: line.powerPlayGoals,
    short_handed_goals: line.shortHandedGoals,
    empty_net_goals: line.emptyNetGoals,
    source: 'league',
  })), 'game_id,player_id');

  await upsert('goalie_game_stats', snapshot.goalieGameStats.map((line) => ({
    game_id: gameUuid(line.gameId),
    player_id: playerUuid(line.playerId),
    games_played: line.gamesPlayed,
    wins: line.wins,
    losses: line.losses,
    ties: line.ties,
    goals_against: line.goalsAgainst,
    shots_against: line.shotsAgainst,
    saves: line.saves,
    shutouts: line.shutouts,
    minutes_played: line.minutesPlayed,
    source: 'league',
  })), 'game_id,player_id');

  await upsert('game_events', snapshot.gameEvents.map((event) => ({
    game_id: gameUuid(event.gameId),
    period: event.period,
    clock_seconds: event.clockSeconds,
    event_type: event.eventType,
    team_side: event.teamSide,
    primary_player_id: event.primaryPlayerId ? playerUuid(event.primaryPlayerId) : null,
    secondary_player_id: event.secondaryPlayerId ? playerUuid(event.secondaryPlayerId) : null,
    detail: event.detail,
    source: 'league',
    external_id: event.id,
    source_url: sourceGameById.get(event.gameId)?.sourceUrl || null,
  })), 'source,external_id');

  await upsert('team_season_summaries', snapshot.teamSeasonSummaries.map((summary) => ({
    season_team_id: summary.seasonTeamId,
    games_played: summary.gamesPlayed,
    wins: summary.wins,
    losses: summary.losses,
    ties: summary.ties,
    points: summary.points,
    source: 'league',
    source_url: summary.sourceUrl,
  })), 'season_team_id');

  await upsert('player_season_stats', snapshot.playerSeasonStats.map((line) => ({
    season_team_id: line.seasonTeamId,
    stage: line.stage,
    player_id: playerUuid(line.playerId),
    games_played: line.gamesPlayed,
    goals: line.goals,
    assists: line.assists,
    points: line.points,
    penalty_minutes: line.penaltyMinutes,
    power_play_goals: line.powerPlayGoals,
    short_handed_goals: line.shortHandedGoals,
    empty_net_goals: line.emptyNetGoals,
    source: 'league',
  })), 'season_team_id,stage,player_id');

  await upsert('goalie_season_stats', snapshot.goalieSeasonStats.map((line) => ({
    season_team_id: line.seasonTeamId,
    stage: line.stage,
    player_id: playerUuid(line.playerId),
    games_played: line.gamesPlayed,
    wins: line.wins,
    losses: line.losses,
    ties: line.ties,
    shutouts: line.shutouts,
    shots_against: line.shotsAgainst,
    goals_against: line.goalsAgainst,
    minutes_played: line.minutesPlayed,
    goals_against_average: line.goalsAgainstAverage,
    save_percentage: line.savePercentage,
    goals: line.goals,
    assists: line.assists,
    penalty_minutes: line.penaltyMinutes,
    source: 'league',
  })), 'season_team_id,stage,player_id');

  if (useImportBridge) {
    const { data, error } = await cloud.rpc('goonsquad_archive_finalize', {
      p_token: bridgeToken,
    });
    if (error) throw new Error(`finalize: ${error.message}`);
    process.stdout.write(`Verified live totals: ${JSON.stringify(data)}\n`);
  }

  process.stdout.write(
    `Imported ${snapshot.seasons.length} seasons, ${snapshot.teams.length} teams, ${snapshot.games.length} games, ${leaguePlayers.length} players, ${snapshot.playerSeasonStats.length} field-player totals, ${snapshot.goalieSeasonStats.length} goaltender totals, ${snapshot.playerGameStats.length} player game lines, ${snapshot.goalieGameStats.length} goaltender game lines, and ${snapshot.gameEvents.length} verified game events.\n`,
  );
}

importSnapshot().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : error}\n`);
  process.exitCode = 1;
});
