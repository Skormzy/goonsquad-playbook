function publishedNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function number(value) {
  return publishedNumber(value) ?? 0;
}

function addPublished(total, value) {
  const parsed = publishedNumber(value);
  if (total === null || parsed === null) return null;
  return total + parsed;
}

function publishedRate(numerator, denominator, zeroValue = 0) {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator)) return null;
  return denominator ? numerator / denominator : zeroValue;
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
  const disambiguatingTier = String(team?.name || '').match(/\bTier\s+([^\s]+)/i)?.[1] || '';
  const tierLabel = disambiguatingTier ? ` Tier ${disambiguatingTier}` : '';
  const dayTokens = source.toUpperCase().match(/\b(?:MON(?:DAY)?|TUE(?:SDAY)?|WED(?:NESDAY)?|THU(?:RSDAY)?|FRI(?:DAY)?|SAT(?:URDAY)?|SUN(?:DAY)?)\b/g) || [];
  const days = [...new Set(dayTokens.map((day) => SCHEDULE_DAY_NAMES[day] || day))];
  if (days.includes('Monday') && !days.includes('Sunday')) {
    return `Monday${tierLabel} League`;
  }
  if (days.length) return `${days.join(' / ')}${tierLabel} League`;
  return `${source.toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase())} League`;
}

export function formatLeagueName(item) {
  const name = String(item?.leagueName || '').trim();
  const sourceUrl = String(item?.sourceUrl || '');
  if (/York Central/i.test(name) || item?.leagueKey === 'york-central' || /yorkcentralbhl\.com/i.test(sourceUrl)) return 'YCBHL';
  if (/Greater Toronto/i.test(name) || item?.leagueKey === 'greater-toronto' || /greatertorontobhl\.com/i.test(sourceUrl)) return 'Greater Toronto Ball Hockey League';
  return name || 'League archive';
}

export function formatLeagueScheduleName(item) {
  const league = formatLeagueName(item);
  const schedule = formatScheduleName(item);
  if (league === 'League archive') return schedule;
  if (schedule === 'League schedule') return league;
  return `${league} · ${schedule}`;
}

export function formatSeasonSelectorLabel(season, teams = []) {
  const match = String(season?.name || '').match(/^(Fall|Summer|Spring|Winter)\s+(.+)$/i);
  const years = match?.[2]?.replace(/^(\d{4})-(\d{2})(\d{2})$/, '$1-$3');
  const seasonLabel = match ? `${years} ${match[1][0].toUpperCase()}${match[1].slice(1).toLowerCase()}` : season?.name || 'Season';
  const scopedTeams = teams.filter((team) => team.seasonId === season?.id);
  const leagueNames = [...new Set((scopedTeams.length ? scopedTeams : [season]).map(formatLeagueName))];
  const dayNames = [...new Set(scopedTeams.map((team) => formatScheduleName(team).replace(/\s+League$/, '')))];
  return [seasonLabel, leagueNames.join(' + '), dayNames.join(' + ')].filter(Boolean).join(' · ');
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
    current.gamesPlayed += publishedNumber(line.gamesPlayed) ?? 1;
    current.goals = addPublished(current.goals, line.goals);
    current.assists = addPublished(current.assists, line.assists);
    current.points = Number.isFinite(current.goals) && Number.isFinite(current.assists)
      ? current.goals + current.assists
      : null;
    current.shots = addPublished(current.shots, line.shots);
    current.penaltyMinutes = addPublished(current.penaltyMinutes, line.penaltyMinutes);
    current.plusMinus = addPublished(current.plusMinus, line.plusMinus);
    aggregate.set(line.playerId, current);
  });
  return [...aggregate.values()]
    .map((line) => ({
      ...line,
      pointsPerGame: publishedRate(line.points, line.gamesPlayed),
      shootingPercentage: publishedRate(line.goals, line.shots),
    }))
    .sort((a, b) => number(b.points) - number(a.points) || number(b.goals) - number(a.goals) || a.displayName.localeCompare(b.displayName));
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
    current.gamesPlayed += publishedNumber(line.gamesPlayed) ?? 1;
    current.wins = addPublished(current.wins, line.wins);
    current.losses = addPublished(current.losses, line.losses);
    current.ties = addPublished(current.ties, line.ties);
    current.goalsAgainst = addPublished(current.goalsAgainst, line.goalsAgainst);
    current.shotsAgainst = addPublished(current.shotsAgainst, line.shotsAgainst);
    current.saves = addPublished(current.saves, line.saves);
    current.shutouts = addPublished(current.shutouts, line.shutouts);
    current.minutesPlayed = addPublished(current.minutesPlayed, line.minutesPlayed);
    aggregate.set(line.playerId, current);
  });
  return [...aggregate.values()]
    .map((line) => ({
      ...line,
      savePercentage: publishedRate(line.saves, line.shotsAgainst),
      goalsAgainstAverage: publishedRate(Number.isFinite(line.goalsAgainst) ? line.goalsAgainst * 30 : null, line.minutesPlayed),
    }))
    .sort((a, b) => number(b.savePercentage) - number(a.savePercentage) || number(b.wins) - number(a.wins));
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
    const lineGoals = publishedNumber(line.goals);
    const lineAssists = publishedNumber(line.assists);
    const linePoints = publishedNumber(line.points)
      ?? (lineGoals !== null && lineAssists !== null ? lineGoals + lineAssists : null);
    current.gamesPlayed = addPublished(current.gamesPlayed, line.gamesPlayed);
    current.goals = addPublished(current.goals, line.goals);
    current.assists = addPublished(current.assists, line.assists);
    current.points = addPublished(current.points, linePoints);
    current.penaltyMinutes = addPublished(current.penaltyMinutes, line.penaltyMinutes);
    current.powerPlayGoals = addPublished(current.powerPlayGoals, line.powerPlayGoals);
    current.shortHandedGoals = addPublished(current.shortHandedGoals, line.shortHandedGoals);
    current.emptyNetGoals = addPublished(current.emptyNetGoals, line.emptyNetGoals);
    aggregate.set(line.playerId, current);
  });
  return [...aggregate.values()]
    .map((line) => ({
      ...line,
      pointsPerGame: publishedRate(line.points, line.gamesPlayed),
      shots: null,
      shootingPercentage: null,
      plusMinus: null,
    }))
    .sort((a, b) => number(b.points) - number(a.points) || number(b.goals) - number(a.goals) || a.displayName.localeCompare(b.displayName));
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
    current.gamesPlayed = addPublished(current.gamesPlayed, line.gamesPlayed);
    current.wins = addPublished(current.wins, line.wins);
    current.losses = addPublished(current.losses, line.losses);
    current.ties = addPublished(current.ties, line.ties);
    current.shutouts = addPublished(current.shutouts, line.shutouts);
    current.shotsAgainst = addPublished(current.shotsAgainst, line.shotsAgainst);
    current.goalsAgainst = addPublished(current.goalsAgainst, line.goalsAgainst);
    current.minutesPlayed = addPublished(current.minutesPlayed, line.minutesPlayed);
    aggregate.set(line.playerId, current);
  });
  return [...aggregate.values()]
    .map((line) => {
      const saves = Number.isFinite(line.shotsAgainst) && Number.isFinite(line.goalsAgainst)
        ? Math.max(0, line.shotsAgainst - line.goalsAgainst)
        : null;
      return {
        ...line,
        saves,
        savePercentage: publishedRate(saves, line.shotsAgainst),
        goalsAgainstAverage: publishedRate(Number.isFinite(line.goalsAgainst) ? line.goalsAgainst * 30 : null, line.minutesPlayed),
      };
    })
    .sort((a, b) => number(b.savePercentage) - number(a.savePercentage) || number(b.wins) - number(a.wins) || a.displayName.localeCompare(b.displayName));
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
      label: formatLeagueScheduleName(seasonTeam),
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
        points: publishedNumber(line.goals) !== null && publishedNumber(line.assists) !== null
          ? publishedNumber(line.goals) + publishedNumber(line.assists)
          : null,
      })),
      goalies: goalieLines.filter((line) => line.gameId === game.id).map((line) => ({
        ...line,
        displayName: playerName(dataset.players, line.playerId),
        savePercentage: publishedRate(publishedNumber(line.saves), publishedNumber(line.shotsAgainst)),
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
