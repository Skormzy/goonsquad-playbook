function number(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function finalGames(games) {
  return games.filter((game) => game.status === 'final');
}

export const ALL_SEASON_TEAMS_ID = 'all';

const SCHEDULE_DAY_NAMES = Object.freeze({
  MON: 'Monday',
  MONDAY: 'Monday',
  TUE: 'Tuesday',
  TUESDAY: 'Tuesday',
  WED: 'Wednesday',
  WEDNESDAY: 'Wednesday',
  THU: 'Thursday',
  THURSDAY: 'Thursday',
  FRI: 'Friday',
  FRIDAY: 'Friday',
  SAT: 'Saturday',
  SATURDAY: 'Saturday',
  SUN: 'Sunday',
  SUNDAY: 'Sunday',
});

export function formatScheduleName(team) {
  const source = String(team?.scheduleLabel || team?.name || '')
    .replace(/\s+Team$/i, '')
    .trim();
  if (!source) return 'League schedule';
  const days = source.split(/\s*\/\s*/).map((day) => {
    const normalized = day.toUpperCase();
    return SCHEDULE_DAY_NAMES[normalized] || day.toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
  });
  return `${days.join(' / ')} League`;
}

function uniqueById(items) {
  return [...new Map(items.map((item) => [item.id, item])).values()];
}

function combineOfficialRecords(records) {
  if (!records.length) return null;
  return records.reduce((combined, record) => ({
    ...combined,
    gamesPlayed: combined.gamesPlayed + number(record.gamesPlayed),
    wins: combined.wins + number(record.wins),
    losses: combined.losses + number(record.losses),
    ties: combined.ties + number(record.ties),
    points: combined.points + number(record.points),
  }), {
    gamesPlayed: 0,
    wins: 0,
    losses: 0,
    ties: 0,
    points: 0,
  });
}

export function calculateTeamRecord(games) {
  const finals = finalGames(games);
  return finals.reduce((record, game) => {
    const goalsFor = number(game.goalsFor);
    const goalsAgainst = number(game.goalsAgainst);
    record.gamesPlayed += 1;
    record.goalsFor += goalsFor;
    record.goalsAgainst += goalsAgainst;
    if (goalsFor > goalsAgainst) record.wins += 1;
    else if (goalsFor < goalsAgainst) record.losses += 1;
    else record.ties += 1;
    return record;
  }, {
    gamesPlayed: 0,
    wins: 0,
    losses: 0,
    ties: 0,
    goalsFor: 0,
    goalsAgainst: 0,
  });
}

export function teamSummary(games) {
  const record = calculateTeamRecord(games);
  return teamSummaryFromRecord(record);
}

export function teamSummaryFromRecord(record) {
  const goalDifference = record.goalsFor - record.goalsAgainst;
  const points = Number.isFinite(record.points) ? record.points : record.wins * 2 + record.ties;
  return {
    ...record,
    points,
    goalDifference,
    winPercentage: record.gamesPlayed ? record.wins / record.gamesPlayed : 0,
    goalsForPerGame: record.gamesPlayed ? record.goalsFor / record.gamesPlayed : 0,
    goalsAgainstPerGame: record.gamesPlayed ? record.goalsAgainst / record.gamesPlayed : 0,
  };
}

function playerName(players, playerId) {
  return players.find((player) => player.id === playerId)?.displayName ?? 'Unknown player';
}

export function aggregatePlayerStats(lines, players) {
  const aggregate = new Map();
  lines.forEach((line) => {
    const current = aggregate.get(line.playerId) ?? {
      playerId: line.playerId,
      displayName: playerName(players, line.playerId),
      gamesPlayed: 0,
      goals: 0,
      assists: 0,
      points: 0,
      shots: 0,
      penaltyMinutes: 0,
      plusMinus: 0,
    };
    current.gamesPlayed += number(line.gamesPlayed || 1);
    current.goals += number(line.goals);
    current.assists += number(line.assists);
    current.points = current.goals + current.assists;
    current.shots += number(line.shots);
    current.penaltyMinutes += number(line.penaltyMinutes);
    current.plusMinus += number(line.plusMinus);
    aggregate.set(line.playerId, current);
  });
  return [...aggregate.values()]
    .map((line) => ({
      ...line,
      pointsPerGame: line.gamesPlayed ? line.points / line.gamesPlayed : 0,
      shootingPercentage: line.shots ? line.goals / line.shots : 0,
    }))
    .sort((a, b) => b.points - a.points || b.goals - a.goals || a.displayName.localeCompare(b.displayName));
}

export function aggregateGoalieStats(lines, players) {
  const aggregate = new Map();
  lines.forEach((line) => {
    const current = aggregate.get(line.playerId) ?? {
      playerId: line.playerId,
      displayName: playerName(players, line.playerId),
      gamesPlayed: 0,
      wins: 0,
      losses: 0,
      ties: 0,
      goalsAgainst: 0,
      shotsAgainst: 0,
      saves: 0,
      shutouts: 0,
      minutesPlayed: 0,
    };
    current.gamesPlayed += number(line.gamesPlayed || 1);
    current.wins += number(line.wins);
    current.losses += number(line.losses);
    current.ties += number(line.ties);
    current.goalsAgainst += number(line.goalsAgainst);
    current.shotsAgainst += number(line.shotsAgainst);
    current.saves += number(line.saves);
    current.shutouts += number(line.shutouts);
    current.minutesPlayed += number(line.minutesPlayed);
    aggregate.set(line.playerId, current);
  });
  return [...aggregate.values()]
    .map((line) => ({
      ...line,
      savePercentage: line.shotsAgainst ? line.saves / line.shotsAgainst : 0,
      goalsAgainstAverage: line.minutesPlayed ? (line.goalsAgainst * 30) / line.minutesPlayed : 0,
    }))
    .sort((a, b) => b.savePercentage - a.savePercentage || b.wins - a.wins);
}

export function aggregatePlayerSeasonStats(lines, players) {
  const aggregate = new Map();
  lines.forEach((line) => {
    const current = aggregate.get(line.playerId) ?? {
      playerId: line.playerId,
      displayName: playerName(players, line.playerId),
      gamesPlayed: 0,
      goals: 0,
      assists: 0,
      points: 0,
      penaltyMinutes: 0,
      powerPlayGoals: 0,
      shortHandedGoals: 0,
      emptyNetGoals: 0,
      source: line.source || 'league',
    };
    current.gamesPlayed += number(line.gamesPlayed);
    current.goals += number(line.goals);
    current.assists += number(line.assists);
    current.points += Number.isFinite(Number(line.points)) ? number(line.points) : number(line.goals) + number(line.assists);
    current.penaltyMinutes += number(line.penaltyMinutes);
    current.powerPlayGoals += number(line.powerPlayGoals);
    current.shortHandedGoals += number(line.shortHandedGoals);
    current.emptyNetGoals += number(line.emptyNetGoals);
    aggregate.set(line.playerId, current);
  });
  return [...aggregate.values()]
    .map((line) => ({
      ...line,
      pointsPerGame: line.gamesPlayed ? line.points / line.gamesPlayed : 0,
      shots: null,
      shootingPercentage: null,
      plusMinus: null,
    }))
    .sort((a, b) => b.points - a.points || b.goals - a.goals || a.displayName.localeCompare(b.displayName));
}

export function aggregateGoalieSeasonStats(lines, players) {
  const aggregate = new Map();
  lines.forEach((line) => {
    const current = aggregate.get(line.playerId) ?? {
      playerId: line.playerId,
      displayName: playerName(players, line.playerId),
      gamesPlayed: 0,
      wins: 0,
      losses: 0,
      ties: 0,
      shutouts: 0,
      shotsAgainst: 0,
      goalsAgainst: 0,
      minutesPlayed: 0,
      source: line.source || 'league',
    };
    current.gamesPlayed += number(line.gamesPlayed);
    current.wins += number(line.wins);
    current.losses += number(line.losses);
    current.ties += number(line.ties);
    current.shutouts += number(line.shutouts);
    current.shotsAgainst += number(line.shotsAgainst);
    current.goalsAgainst += number(line.goalsAgainst);
    current.minutesPlayed += number(line.minutesPlayed);
    aggregate.set(line.playerId, current);
  });
  return [...aggregate.values()]
    .map((line) => ({
      ...line,
      saves: Math.max(0, line.shotsAgainst - line.goalsAgainst),
      savePercentage: line.shotsAgainst ? (line.shotsAgainst - line.goalsAgainst) / line.shotsAgainst : 0,
      goalsAgainstAverage: line.minutesPlayed ? (line.goalsAgainst * 30) / line.minutesPlayed : 0,
    }))
    .sort((a, b) => b.savePercentage - a.savePercentage || b.wins - a.wins || a.displayName.localeCompare(b.displayName));
}

function includesStage(item, stage) {
  if (stage === 'all') return true;
  return (item.stage || 'regular') === stage;
}

export function statsSnapshot(dataset, seasonId, teamId, stage = 'regular') {
  const season = dataset.seasons.find((item) => item.id === seasonId) ?? dataset.seasons[0] ?? null;
  const seasonTeams = dataset.teams.filter((team) => team.seasonId === season?.id);
  const isSeasonAggregate = seasonTeams.length > 1 && (!teamId || teamId === ALL_SEASON_TEAMS_ID);
  const team = isSeasonAggregate
    ? {
      id: ALL_SEASON_TEAMS_ID,
      seasonId: season?.id,
      name: 'All Goonsquad teams',
      scheduleLabel: 'All schedules',
      division: 'All divisions',
      aggregate: true,
    }
    : seasonTeams.find((item) => item.id === teamId) ?? seasonTeams[0] ?? null;
  const selectedTeams = isSeasonAggregate ? seasonTeams : team ? [team] : [];
  const selectedTeamIds = new Set(selectedTeams.map((item) => item.id));
  const games = uniqueById(dataset.games
    .filter((game) => selectedTeamIds.has(game.seasonTeamId) && includesStage(game, stage)))
    .sort((a, b) => String(b.scheduledAt).localeCompare(String(a.scheduledAt)));
  const gameIds = new Set(games.map((game) => game.id));
  const playerLines = dataset.playerGameStats.filter((line) => gameIds.has(line.gameId));
  const goalieLines = dataset.goalieGameStats.filter((line) => gameIds.has(line.gameId));
  const teamGameLines = dataset.teamGameStats.filter((line) => gameIds.has(line.gameId ?? line.game_id));
  const gameEvents = (dataset.gameEvents || []).filter((event) => gameIds.has(event.gameId));
  const memberships = dataset.memberships.filter((membership) => selectedTeamIds.has(membership.seasonTeamId));
  const seasonPlayerLines = (dataset.playerSeasonStats || []).filter((line) => selectedTeamIds.has(line.seasonTeamId) && includesStage(line, stage));
  const seasonGoalieLines = (dataset.goalieSeasonStats || []).filter((line) => selectedTeamIds.has(line.seasonTeamId) && includesStage(line, stage));
  const teamItems = [
    ...dataset.games.filter((game) => selectedTeamIds.has(game.seasonTeamId)),
    ...(dataset.playerSeasonStats || []).filter((line) => selectedTeamIds.has(line.seasonTeamId)),
    ...(dataset.goalieSeasonStats || []).filter((line) => selectedTeamIds.has(line.seasonTeamId)),
  ];
  const hasPlayoffs = teamItems.some((item) => item.stage === 'playoffs');
  const calculatedRecord = calculateTeamRecord(games);
  const officialRecords = stage === 'regular'
    ? selectedTeams.map((selectedTeam) => (dataset.teamSeasonSummaries || [])
      .find((summary) => summary.seasonTeamId === selectedTeam.id)).filter(Boolean)
    : [];
  const officialRecord = officialRecords.length === selectedTeams.length
    ? combineOfficialRecords(officialRecords)
    : null;
  const summary = teamSummaryFromRecord({
    ...calculatedRecord,
    ...(officialRecord || {}),
    goalsFor: calculatedRecord.goalsFor,
    goalsAgainst: calculatedRecord.goalsAgainst,
  });
  const seasonSchedules = seasonTeams.map((seasonTeam) => {
    const scheduleGames = uniqueById(dataset.games.filter((game) => game.seasonTeamId === seasonTeam.id && includesStage(game, stage)));
    const calculated = calculateTeamRecord(scheduleGames);
    const official = stage === 'regular'
      ? (dataset.teamSeasonSummaries || []).find((item) => item.seasonTeamId === seasonTeam.id) ?? null
      : null;
    return {
      team: seasonTeam,
      label: formatScheduleName(seasonTeam),
      games: scheduleGames,
      summary: teamSummaryFromRecord({
        ...calculated,
        ...(official || {}),
        goalsFor: calculated.goalsFor,
        goalsAgainst: calculated.goalsAgainst,
      }),
      scheduleComplete: !official || official.gamesPlayed === calculated.gamesPlayed,
    };
  });
  return {
    season,
    seasonTeams,
    seasonSchedules,
    team,
    isSeasonAggregate,
    games,
    memberships,
    stage,
    availableStages: hasPlayoffs ? ['regular', 'playoffs', 'all'] : ['regular'],
    summary,
    officialRecord,
    fieldPlayers: seasonPlayerLines.length
      ? aggregatePlayerSeasonStats(seasonPlayerLines, dataset.players)
      : aggregatePlayerStats(playerLines, dataset.players),
    goalies: seasonGoalieLines.length
      ? aggregateGoalieSeasonStats(seasonGoalieLines, dataset.players)
      : aggregateGoalieStats(goalieLines, dataset.players),
    statSource: seasonPlayerLines.length || seasonGoalieLines.length ? 'league' : 'team',
    scheduleComplete: !officialRecord || officialRecord.gamesPlayed === calculatedRecord.gamesPlayed,
    gameDetails: Object.fromEntries(games.map((game) => [game.id, {
      schedule: seasonTeams.find((item) => item.id === game.seasonTeamId) ?? null,
      team: teamGameLines.find((line) => (line.gameId ?? line.game_id) === game.id) ?? null,
      players: playerLines.filter((line) => line.gameId === game.id).map((line) => ({
        ...line,
        displayName: playerName(dataset.players, line.playerId),
        points: number(line.goals) + number(line.assists),
      })),
      goalies: goalieLines.filter((line) => line.gameId === game.id).map((line) => ({
        ...line,
        displayName: playerName(dataset.players, line.playerId),
        savePercentage: number(line.shotsAgainst) ? number(line.saves) / number(line.shotsAgainst) : 0,
      })),
      events: gameEvents.filter((event) => event.gameId === game.id),
    }])),
  };
}

export function formatPercentage(value, { empty = '—' } = {}) {
  if (!Number.isFinite(value)) return empty;
  return `${Math.round(value * 1000) / 10}%`;
}

export function formatGameDate(value) {
  if (!value) return 'Date TBD';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat('en-CA', { month: 'short', day: 'numeric', year: 'numeric' }).format(date);
}
