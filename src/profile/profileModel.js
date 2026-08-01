import { nextUpcomingGame } from '../stats/scheduleFreshness';
import {
  formatLeagueName,
  formatLeagueScheduleName,
} from '../stats/statsModel';
import {
  buildPlayerIdentityIndex,
  canonicalPlayerIdentityId,
  expandPlayerIdentityIds,
  normalizePlayerIdentityName,
  playerIdentitySource,
  playerIdentitySourceLabel,
} from '../stats/playerIdentity';

function value(number) {
  const parsed = Number(number);
  return Number.isFinite(parsed) ? parsed : 0;
}

function seasonSortValue(season, fallbackIndex = 0) {
  const date = Date.parse(season?.startDate || season?.endDate || '');
  return Number.isFinite(date) ? date : -fallbackIndex;
}

function playerIdsForClaims(dataset, claims) {
  const directIds = new Set(claims.map((claim) => claim.playerId).filter(Boolean));
  const externalIds = new Set(claims.map((claim) => claim.player?.externalId).filter(Boolean));
  const matchedIds = new Set(dataset.players
    .filter((player) => directIds.has(player.id) || externalIds.has(player.externalId))
    .map((player) => player.id));
  return expandPlayerIdentityIds(buildPlayerIdentityIndex(dataset.players), matchedIds);
}

function resolvedPlayers(dataset, claims) {
  const ids = playerIdsForClaims(dataset, claims);
  return dataset.players.filter((player) => ids.has(player.id));
}

export function playerRosterCandidates(dataset, { includeHistory = false, query = '' } = {}) {
  const currentSeason = dataset.seasons.find((season) => season.current) ?? dataset.seasons[0] ?? null;
  const currentTeamIds = new Set(dataset.teams.filter((team) => team.seasonId === currentSeason?.id).map((team) => team.id));
  const membershipByPlayer = new Map();
  dataset.memberships.forEach((membership) => {
    const entries = membershipByPlayer.get(membership.playerId) ?? [];
    entries.push(membership);
    membershipByPlayer.set(membership.playerId, entries);
  });
  const seasonIndex = new Map(dataset.seasons.map((season, index) => [season.id, index]));
  const teamsById = new Map(dataset.teams.map((team) => [team.id, team]));
  const gamesById = new Map((dataset.games ?? []).map((game) => [game.id, game]));
  const normalizedQuery = String(query || '').trim().toLowerCase();
  const normalizedIdentityQuery = normalizePlayerIdentityName(query);

  const identityIndex = buildPlayerIdentityIndex(dataset.players);
  const candidates = dataset.players
    .map((player) => {
      const memberships = membershipByPlayer.get(player.id) ?? [];
      const currentMemberships = memberships.filter((membership) => currentTeamIds.has(membership.seasonTeamId) && membership.active !== false);
      const statisticalTeamIds = new Set([
        ...(dataset.playerSeasonStats ?? []).filter((line) => line.playerId === player.id).map((line) => line.seasonTeamId),
        ...(dataset.goalieSeasonStats ?? []).filter((line) => line.playerId === player.id).map((line) => line.seasonTeamId),
        ...(dataset.playerGameStats ?? []).filter((line) => line.playerId === player.id).map((line) => gamesById.get(line.gameId)?.seasonTeamId),
        ...(dataset.goalieGameStats ?? []).filter((line) => line.playerId === player.id).map((line) => gamesById.get(line.gameId)?.seasonTeamId),
      ].filter(Boolean));
      const historicalTeamIds = new Set([
        ...memberships.map((membership) => membership.seasonTeamId),
        ...statisticalTeamIds,
      ]);
      if (!includeHistory && !currentMemberships.length) return null;
      if (includeHistory && !historicalTeamIds.size) return null;

      const membershipDetails = memberships.map((membership) => {
        const team = teamsById.get(membership.seasonTeamId) ?? null;
        const season = dataset.seasons.find((item) => item.id === team?.seasonId) ?? null;
        return { membership, team, season };
      }).sort((a, b) => (seasonIndex.get(a.season?.id) ?? 999) - (seasonIndex.get(b.season?.id) ?? 999));
      const teamDetails = [...historicalTeamIds].map((teamId) => {
        const team = teamsById.get(teamId) ?? null;
        const season = dataset.seasons.find((item) => item.id === team?.seasonId) ?? null;
        return { team, season };
      }).sort((a, b) => (seasonIndex.get(a.season?.id) ?? 999) - (seasonIndex.get(b.season?.id) ?? 999));
      const latestMembership = membershipDetails[0] ?? null;
      const latestTeam = teamDetails[0] ?? null;
      const seasons = [...new Map(teamDetails.filter((item) => item.season).map((item) => [item.season.id, item.season])).values()];
      const schedules = [...new Set(teamDetails.filter((item) => item.team).map((item) => formatLeagueScheduleName(item.team)))];
      const position = currentMemberships.find((membership) => membership.position)?.position
        || latestMembership?.membership.position
        || player.primaryPosition
        || null;
      const jerseyNumber = currentMemberships.find((membership) => membership.jerseyNumber)?.jerseyNumber
        || latestMembership?.membership.jerseyNumber
        || player.jerseyNumber
        || null;
      const searchText = [player.displayName, position, jerseyNumber, ...schedules, ...seasons.map((season) => season.name)].filter(Boolean).join(' ').toLowerCase();
      return {
        id: player.id,
        cloudPlayerId: player.persisted === false ? null : player.id,
        externalId: player.externalId,
        displayName: player.displayName,
        avatarUrl: player.avatarUrl || null,
        sourceUrl: player.sourceUrl,
        position,
        jerseyNumber,
        current: currentMemberships.length > 0,
        active: player.active !== false,
        latestSeason: latestTeam?.season?.name ?? 'Team history',
        schedules,
        seasonIds: seasons.map((season) => season.id),
        seasonCount: seasons.length,
        searchText,
        identitySearchText: normalizePlayerIdentityName(player.displayName),
      };
    })
    .filter(Boolean);

  const combinedCandidates = new Map();
  candidates.forEach((candidate) => {
    const canonicalId = canonicalPlayerIdentityId(identityIndex, candidate.id);
    const canonicalPlayer = dataset.players.find((player) => player.id === canonicalId) ?? null;
    const existing = combinedCandidates.get(canonicalId);
    if (!existing) {
      combinedCandidates.set(canonicalId, {
        ...candidate,
        id: canonicalId,
        displayName: canonicalPlayer?.displayName ?? candidate.displayName,
        identityPlayerIds: [...(identityIndex.playerIdsByCanonicalId.get(canonicalId) ?? [candidate.id])],
      });
      return;
    }

    const preferred = candidate.current && !existing.current ? candidate : existing;
    combinedCandidates.set(canonicalId, {
      ...preferred,
      id: canonicalId,
      displayName: canonicalPlayer?.displayName ?? preferred.displayName,
      cloudPlayerId: existing.cloudPlayerId || candidate.cloudPlayerId || null,
      current: existing.current || candidate.current,
      active: existing.active || candidate.active,
      schedules: [...new Set([...existing.schedules, ...candidate.schedules])],
      seasonIds: [...new Set([...existing.seasonIds, ...candidate.seasonIds])],
      seasonCount: new Set([...existing.seasonIds, ...candidate.seasonIds]).size,
      searchText: `${existing.searchText} ${candidate.searchText}`,
      identitySearchText: `${existing.identitySearchText} ${candidate.identitySearchText}`,
      identityPlayerIds: [...(identityIndex.playerIdsByCanonicalId.get(canonicalId) ?? [candidate.id])],
    });
  });

  return [...combinedCandidates.values()]
    .filter((candidate) => (
      !normalizedQuery
      || candidate.searchText.includes(normalizedQuery)
      || (normalizedIdentityQuery && candidate.identitySearchText.includes(normalizedIdentityQuery))
    ))
    .sort((a, b) => Number(b.current) - Number(a.current) || a.displayName.localeCompare(b.displayName) || String(a.externalId).localeCompare(String(b.externalId)));
}

function officialProfilesForPlayers(players, primaryPlayer) {
  const profilesBySource = new Map();
  [primaryPlayer, ...players].filter(Boolean).forEach((player) => {
    if (!player.sourceUrl) return;
    const source = playerIdentitySource(player) || player.sourceUrl;
    if (profilesBySource.has(source)) return;
    profilesBySource.set(source, {
      playerId: player.id,
      label: playerIdentitySourceLabel(player),
      url: player.sourceUrl,
    });
  });
  return [...profilesBySource.values()];
}

function emptySeasonLine(season) {
  return {
    season,
    schedules: new Set(),
    stages: new Set(),
    field: {
      gamesPlayed: 0,
      goals: 0,
      assists: 0,
      points: 0,
      penaltyMinutes: 0,
      powerPlayGoals: 0,
      shortHandedGoals: 0,
      emptyNetGoals: 0,
    },
    goalie: {
      gamesPlayed: 0,
      wins: 0,
      losses: 0,
      ties: 0,
      shutouts: 0,
      shotsAgainst: 0,
      goalsAgainst: 0,
      minutesPlayed: 0,
    },
  };
}

function addFieldLine(target, line) {
  for (const key of Object.keys(target)) target[key] += value(line[key]);
}

function addGoalieLine(target, line) {
  for (const key of Object.keys(target)) target[key] += value(line[key]);
}

function finalizeGoalie(line) {
  const saves = Math.max(0, line.shotsAgainst - line.goalsAgainst);
  return {
    ...line,
    saves,
    savePercentage: line.shotsAgainst ? saves / line.shotsAgainst : 0,
    goalsAgainstAverage: line.minutesPlayed ? (line.goalsAgainst * 30) / line.minutesPlayed : 0,
  };
}

function gameResult(game) {
  if (game.status !== 'final') return 'Scheduled';
  if (value(game.goalsFor) > value(game.goalsAgainst)) return 'W';
  if (value(game.goalsFor) < value(game.goalsAgainst)) return 'L';
  return 'T';
}

export function memberProfileSnapshot(dataset, claims, now = Date.now()) {
  const players = resolvedPlayers(dataset, claims);
  const playerIds = new Set(players.map((player) => player.id));
  const primaryClaim = claims.find((claim) => claim.primary) ?? claims[0] ?? null;
  const identityIndex = buildPlayerIdentityIndex(dataset.players);
  const claimedPlayer = dataset.players.find((player) => (
    player.id === primaryClaim?.playerId
    || player.externalId === primaryClaim?.player?.externalId
  )) ?? null;
  const canonicalPrimaryId = claimedPlayer
    ? canonicalPlayerIdentityId(identityIndex, claimedPlayer.id)
    : null;
  const primaryPlayer = players.find((player) => player.id === canonicalPrimaryId)
    ?? players.find((player) => (
      player.id === primaryClaim?.playerId
      || player.externalId === primaryClaim?.player?.externalId
    ))
    ?? players[0]
    ?? null;
  if (!playerIds.size || !primaryPlayer) return null;

  const teamsById = new Map(dataset.teams.map((team) => [team.id, team]));
  const seasonsById = new Map(dataset.seasons.map((season) => [season.id, season]));
  const seasonIndex = new Map(dataset.seasons.map((season, index) => [season.id, index]));
  const history = new Map();
  const ensureSeason = (seasonTeamId) => {
    const team = teamsById.get(seasonTeamId);
    const season = seasonsById.get(team?.seasonId);
    if (!season) return null;
    if (!history.has(season.id)) history.set(season.id, emptySeasonLine(season));
    const row = history.get(season.id);
    if (team) row.schedules.add(formatLeagueScheduleName(team));
    return row;
  };

  dataset.playerSeasonStats.filter((line) => playerIds.has(line.playerId)).forEach((line) => {
    const row = ensureSeason(line.seasonTeamId);
    if (!row) return;
    row.stages.add(line.stage || 'regular');
    addFieldLine(row.field, line);
  });
  dataset.goalieSeasonStats.filter((line) => playerIds.has(line.playerId)).forEach((line) => {
    const row = ensureSeason(line.seasonTeamId);
    if (!row) return;
    row.stages.add(line.stage || 'regular');
    addGoalieLine(row.goalie, line);
  });

  const seasonHistory = [...history.values()]
    .map((row) => ({
      ...row,
      schedules: [...row.schedules],
      stages: [...row.stages],
      field: { ...row.field, pointsPerGame: row.field.gamesPlayed ? row.field.points / row.field.gamesPlayed : 0 },
      goalie: finalizeGoalie(row.goalie),
    }))
    .sort((a, b) => seasonSortValue(b.season, seasonIndex.get(b.season.id)) - seasonSortValue(a.season, seasonIndex.get(a.season.id)));

  const careerField = seasonHistory.reduce((total, row) => {
    addFieldLine(total, row.field);
    return total;
  }, emptySeasonLine(null).field);
  careerField.pointsPerGame = careerField.gamesPlayed ? careerField.points / careerField.gamesPlayed : 0;
  const careerGoalieBase = seasonHistory.reduce((total, row) => {
    addGoalieLine(total, row.goalie);
    return total;
  }, emptySeasonLine(null).goalie);
  const careerGoalie = finalizeGoalie(careerGoalieBase);

  const fieldGameLines = dataset.playerGameStats.filter((line) => playerIds.has(line.playerId));
  const goalieGameLines = dataset.goalieGameStats.filter((line) => playerIds.has(line.playerId));
  const recentGameIds = new Set([...fieldGameLines, ...goalieGameLines].map((line) => line.gameId));
  const recentGames = dataset.games
    .filter((game) => recentGameIds.has(game.id))
    .map((game) => {
      const field = fieldGameLines.find((line) => line.gameId === game.id) ?? null;
      const goalie = goalieGameLines.find((line) => line.gameId === game.id) ?? null;
      const team = teamsById.get(game.seasonTeamId) ?? null;
      const season = seasonsById.get(team?.seasonId) ?? null;
      return {
        game,
        field,
        goalie: goalie ? finalizeGoalie(goalie) : null,
        team,
        season,
        result: gameResult(game),
        points: value(field?.goals) + value(field?.assists),
      };
    })
    .sort((a, b) => String(b.game.scheduledAt).localeCompare(String(a.game.scheduledAt)));

  const memberships = dataset.memberships.filter((membership) => playerIds.has(membership.playerId));
  const currentSeason = dataset.seasons.find((season) => season.current) ?? dataset.seasons[0] ?? null;
  const currentTeamIds = new Set(dataset.teams.filter((team) => team.seasonId === currentSeason?.id).map((team) => team.id));
  const currentMemberships = memberships.filter((membership) => currentTeamIds.has(membership.seasonTeamId));
  const activeTeamIds = new Set(currentMemberships.map((membership) => membership.seasonTeamId));
  const nextGame = nextUpcomingGame(
    dataset.games.filter((game) => activeTeamIds.has(game.seasonTeamId)),
    now,
  );
  const latestMembership = currentMemberships[0] ?? memberships
    .slice()
    .sort((a, b) => (seasonIndex.get(teamsById.get(a.seasonTeamId)?.seasonId) ?? 999) - (seasonIndex.get(teamsById.get(b.seasonTeamId)?.seasonId) ?? 999))[0] ?? null;

  const bestFieldSeason = seasonHistory.slice().sort((a, b) => b.field.points - a.field.points || b.field.goals - a.field.goals)[0] ?? null;

  return {
    players,
    primaryPlayer,
    officialProfiles: officialProfilesForPlayers(players, primaryPlayer),
    linkStatus: 'linked',
    claims,
    seasonsPlayed: seasonHistory.length,
    leagueNames: [...new Set(seasonHistory.map((row) => formatLeagueName(row.season)))],
    seasonHistory,
    currentSeason: seasonHistory.find((row) => row.season.id === currentSeason?.id) ?? seasonHistory[0] ?? null,
    bestFieldSeason,
    careerField,
    careerGoalie,
    recentGames,
    nextGame,
    currentTeams: currentMemberships.map((membership) => teamsById.get(membership.seasonTeamId)).filter(Boolean),
    jerseyNumber: primaryClaim?.player?.jerseyNumber || latestMembership?.jerseyNumber || primaryPlayer.jerseyNumber || null,
    position: primaryClaim?.player?.primaryPosition || latestMembership?.position || primaryPlayer.primaryPosition || null,
  };
}

export function publicPlayerProfileSnapshot(dataset, playerId, now = Date.now()) {
  const player = dataset?.players?.find((candidate) => candidate.id === playerId) ?? null;
  if (!player) return null;
  return memberProfileSnapshot(dataset, [{
    playerId: player.id,
    primary: true,
    player,
  }], now);
}
