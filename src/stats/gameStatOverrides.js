const PLAYER_FIELDS = Object.freeze([
  'gamesPlayed',
  'goals',
  'assists',
  'shots',
  'penaltyMinutes',
  'plusMinus',
  'blocks',
  'takeaways',
  'turnovers',
  'powerPlayGoals',
  'shortHandedGoals',
  'emptyNetGoals',
]);

const PLAYER_SEASON_FIELDS = Object.freeze([
  'gamesPlayed',
  'goals',
  'assists',
  'penaltyMinutes',
  'powerPlayGoals',
  'shortHandedGoals',
  'emptyNetGoals',
]);

const GOALIE_FIELDS = Object.freeze([
  'gamesPlayed',
  'wins',
  'losses',
  'ties',
  'goalsAgainst',
  'shotsAgainst',
  'saves',
  'shutouts',
  'minutesPlayed',
]);

const TEAM_FIELDS = Object.freeze([
  'shotsFor',
  'shotsAgainst',
  'powerPlayGoals',
  'powerPlayOpportunities',
  'penaltyKillGoalsAgainst',
  'timesShorthanded',
  'faceoffWins',
  'faceoffAttempts',
  'blocks',
  'takeaways',
  'turnovers',
]);

function own(value, key) {
  return Object.prototype.hasOwnProperty.call(value || {}, key);
}

function number(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function nullableNumber(value) {
  if (value === '' || value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function lineMap(lines) {
  return new Map(lines.map((line) => [String(line.playerId), line]));
}

function recordContribution(game) {
  if (!game || game.status !== 'final') {
    return { gamesPlayed: 0, wins: 0, losses: 0, ties: 0, points: 0 };
  }
  const goalsFor = number(game.goalsFor);
  const goalsAgainst = number(game.goalsAgainst);
  if (goalsFor > goalsAgainst) return { gamesPlayed: 1, wins: 1, losses: 0, ties: 0, points: 2 };
  if (goalsFor < goalsAgainst) return { gamesPlayed: 1, wins: 0, losses: 1, ties: 0, points: 0 };
  return { gamesPlayed: 1, wins: 0, losses: 0, ties: 1, points: 1 };
}

function normalizePlayerLine(line, gameId) {
  const normalized = {
    id: line.id || `admin-${gameId}-${line.playerId}-field`,
    gameId,
    playerId: String(line.playerId),
    source: 'admin',
  };
  PLAYER_FIELDS.forEach((field) => {
    normalized[field] = field === 'shots' || field === 'plusMinus' || field === 'blocks'
      || field === 'takeaways' || field === 'turnovers'
      ? nullableNumber(line[field])
      : number(line[field]);
  });
  return normalized;
}

function normalizeGoalieLine(line, gameId) {
  const normalized = {
    id: line.id || `admin-${gameId}-${line.playerId}-goalie`,
    gameId,
    playerId: String(line.playerId),
    source: 'admin',
  };
  GOALIE_FIELDS.forEach((field) => { normalized[field] = number(line[field]); });
  return normalized;
}

function normalizeEvent(event, gameId, index) {
  return {
    ...event,
    id: event.id || `admin-${gameId}-event-${index + 1}`,
    gameId,
    period: Math.max(1, number(event.period, 1)),
    clockSeconds: nullableNumber(event.clockSeconds),
    source: 'admin',
    detail: event.detail && typeof event.detail === 'object' ? event.detail : {},
  };
}

function findGame(dataset, record) {
  const keys = new Set([
    record.gameKey,
    record.game_key,
    record.gameExternalId,
    record.game_external_id,
  ].filter(Boolean).map(String));
  return dataset.games.find((game) => (
    keys.has(String(game.id)) || (game.externalId && keys.has(String(game.externalId)))
  ));
}

function updatePlayerSeasonTotals(lines, originalLines, correctedLines, game) {
  const original = lineMap(originalLines);
  const corrected = lineMap(correctedLines);
  const playerIds = new Set([...original.keys(), ...corrected.keys()]);
  const next = [...lines];

  playerIds.forEach((playerId) => {
    const before = original.get(playerId) || {};
    const after = corrected.get(playerId) || {};
    const deltas = Object.fromEntries(PLAYER_SEASON_FIELDS.map((field) => [
      field,
      number(after[field]) - number(before[field]),
    ]));
    if (PLAYER_SEASON_FIELDS.every((field) => deltas[field] === 0)) return;

    const index = next.findIndex((line) => (
      String(line.playerId) === playerId
      && line.seasonTeamId === game.seasonTeamId
      && (line.stage || 'regular') === (game.stage || 'regular')
    ));
    const current = index >= 0 ? next[index] : {
      id: `admin-${game.seasonTeamId}-${game.stage || 'regular'}-${playerId}-field`,
      seasonTeamId: game.seasonTeamId,
      stage: game.stage || 'regular',
      playerId,
      gamesPlayed: 0,
      goals: 0,
      assists: 0,
      points: 0,
      penaltyMinutes: 0,
      powerPlayGoals: 0,
      shortHandedGoals: 0,
      emptyNetGoals: 0,
      source: 'admin',
    };
    const updated = { ...current, correctionSource: 'admin' };
    PLAYER_SEASON_FIELDS.forEach((field) => {
      updated[field] = Math.max(0, number(current[field]) + deltas[field]);
    });
    updated.points = Math.max(
      0,
      number(current.points) + deltas.goals + deltas.assists,
    );
    if (index >= 0) next[index] = updated;
    else next.push(updated);
  });
  return next;
}

function updateGoalieSeasonTotals(lines, originalLines, correctedLines, game) {
  const original = lineMap(originalLines);
  const corrected = lineMap(correctedLines);
  const playerIds = new Set([...original.keys(), ...corrected.keys()]);
  const next = [...lines];

  playerIds.forEach((playerId) => {
    const before = original.get(playerId) || {};
    const after = corrected.get(playerId) || {};
    const deltas = Object.fromEntries(GOALIE_FIELDS.map((field) => [
      field,
      number(after[field]) - number(before[field]),
    ]));
    if (GOALIE_FIELDS.every((field) => deltas[field] === 0)) return;

    const index = next.findIndex((line) => (
      String(line.playerId) === playerId
      && line.seasonTeamId === game.seasonTeamId
      && (line.stage || 'regular') === (game.stage || 'regular')
    ));
    const current = index >= 0 ? next[index] : {
      id: `admin-${game.seasonTeamId}-${game.stage || 'regular'}-${playerId}-goalie`,
      seasonTeamId: game.seasonTeamId,
      stage: game.stage || 'regular',
      playerId,
      gamesPlayed: 0,
      wins: 0,
      losses: 0,
      ties: 0,
      shutouts: 0,
      shotsAgainst: 0,
      goalsAgainst: 0,
      minutesPlayed: 0,
      goals: 0,
      assists: 0,
      penaltyMinutes: 0,
      source: 'admin',
    };
    const updated = { ...current, correctionSource: 'admin' };
    GOALIE_FIELDS.forEach((field) => {
      updated[field] = Math.max(0, number(current[field]) + deltas[field]);
    });
    updated.saves = Math.max(0, number(updated.shotsAgainst) - number(updated.goalsAgainst));
    updated.savePercentage = updated.shotsAgainst ? updated.saves / updated.shotsAgainst : 0;
    updated.goalsAgainstAverage = updated.minutesPlayed
      ? (updated.goalsAgainst * 30) / updated.minutesPlayed
      : 0;
    if (index >= 0) next[index] = updated;
    else next.push(updated);
  });
  return next;
}

function updateTeamSeasonSummary(lines, originalGame, correctedGame) {
  const before = recordContribution(originalGame);
  const after = recordContribution(correctedGame);
  if (Object.keys(before).every((field) => before[field] === after[field])) return lines;
  const next = [...lines];
  const index = next.findIndex((line) => line.seasonTeamId === correctedGame.seasonTeamId);
  if (index < 0) return next;
  const updated = { ...next[index], correctionSource: 'admin' };
  Object.keys(before).forEach((field) => {
    updated[field] = Math.max(0, number(updated[field]) + after[field] - before[field]);
  });
  next[index] = updated;
  return next;
}

function replaceGameItems(items, gameId, replacements) {
  return [
    ...items.filter((item) => String(item.gameId ?? item.game_id) !== String(gameId)),
    ...replacements,
  ];
}

export function mapGameStatOverrideRow(row) {
  return {
    gameKey: row.game_key ?? row.gameKey,
    gameExternalId: row.game_external_id ?? row.gameExternalId ?? null,
    seasonTeamId: row.season_team_id ?? row.seasonTeamId ?? null,
    payload: row.payload && typeof row.payload === 'object' ? row.payload : {},
    note: row.note || '',
    updatedAt: row.updated_at ?? row.updatedAt ?? null,
  };
}

export function applyGameStatOverrides(dataset, rows = []) {
  if (!dataset || !Array.isArray(rows) || rows.length === 0) return dataset;
  let next = {
    ...dataset,
    games: [...dataset.games],
    teamGameStats: [...(dataset.teamGameStats || [])],
    playerGameStats: [...(dataset.playerGameStats || [])],
    goalieGameStats: [...(dataset.goalieGameStats || [])],
    gameEvents: [...(dataset.gameEvents || [])],
    playerSeasonStats: [...(dataset.playerSeasonStats || [])],
    goalieSeasonStats: [...(dataset.goalieSeasonStats || [])],
    teamSeasonSummaries: [...(dataset.teamSeasonSummaries || [])],
    gameStatOverrides: [],
  };

  rows.map(mapGameStatOverrideRow).forEach((record) => {
    const game = findGame(next, record);
    const payload = record.payload || {};
    if (!game || !payload || typeof payload !== 'object') return;
    const gameId = game.id;
    const originalGame = { ...game };
    const correctedGame = {
      ...game,
      ...(payload.game && typeof payload.game === 'object' ? payload.game : {}),
      adminCorrection: {
        gameKey: record.gameKey,
        note: record.note,
        updatedAt: record.updatedAt,
      },
    };
    next.games = next.games.map((item) => item.id === gameId ? correctedGame : item);

    const originalPlayerLines = next.playerGameStats.filter((line) => String(line.gameId) === String(gameId));
    if (own(payload, 'playerLines') && Array.isArray(payload.playerLines)) {
      const correctedPlayerLines = payload.playerLines
        .filter((line) => line?.playerId)
        .map((line) => normalizePlayerLine(line, gameId));
      next.playerGameStats = replaceGameItems(next.playerGameStats, gameId, correctedPlayerLines);
      next.playerSeasonStats = updatePlayerSeasonTotals(
        next.playerSeasonStats,
        originalPlayerLines,
        correctedPlayerLines,
        correctedGame,
      );
    }

    const originalGoalieLines = next.goalieGameStats.filter((line) => String(line.gameId) === String(gameId));
    if (own(payload, 'goalieLines') && Array.isArray(payload.goalieLines)) {
      const correctedGoalieLines = payload.goalieLines
        .filter((line) => line?.playerId)
        .map((line) => normalizeGoalieLine(line, gameId));
      next.goalieGameStats = replaceGameItems(next.goalieGameStats, gameId, correctedGoalieLines);
      next.goalieSeasonStats = updateGoalieSeasonTotals(
        next.goalieSeasonStats,
        originalGoalieLines,
        correctedGoalieLines,
        correctedGame,
      );
    }

    if (own(payload, 'events') && Array.isArray(payload.events)) {
      next.gameEvents = replaceGameItems(
        next.gameEvents,
        gameId,
        payload.events.map((event, index) => normalizeEvent(event, gameId, index)),
      );
    }

    if (own(payload, 'teamStats')) {
      const existing = next.teamGameStats.find((line) => String(line.gameId ?? line.game_id) === String(gameId)) || {};
      const corrected = { ...existing, gameId, source: 'admin' };
      TEAM_FIELDS.forEach((field) => {
        corrected[field] = nullableNumber(payload.teamStats?.[field]);
      });
      next.teamGameStats = replaceGameItems(next.teamGameStats, gameId, [corrected]);
    }

    next.teamSeasonSummaries = updateTeamSeasonSummary(
      next.teamSeasonSummaries,
      originalGame,
      correctedGame,
    );
    next.gameStatOverrides.push(record);
  });

  return next;
}

export function effectiveGameKey(game) {
  return String(game?.id || game?.externalId || '').trim();
}

export const GAME_CORRECTION_FIELDS = Object.freeze({
  player: PLAYER_FIELDS,
  goalie: GOALIE_FIELDS,
  team: TEAM_FIELDS,
});
