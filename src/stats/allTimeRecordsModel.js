import { playerRosterCandidates } from '../profile/profileModel';
import {
  aggregateGoalieSeasonStats,
  aggregatePlayerSeasonStats,
} from './statsModel';
import {
  buildPlayerIdentityIndex,
  canonicalPlayerIdentityId,
  normalizePlayerIdentityName,
} from './playerIdentity';
import {
  availableCompetitionScopes,
  COMPETITION_SCOPE_META,
} from './competitionScopeModel';

function number(value, fallback = 0) {
  return Number.isFinite(value) ? value : fallback;
}

function stageOf(line) {
  return line?.stage || 'regular';
}

function seasonIdByTeam(dataset) {
  return new Map(dataset.teams.map((team) => [team.id, team.seasonId]));
}

function eventKeysByPlayer(dataset, lines, prefix = 'season') {
  const teamSeason = seasonIdByTeam(dataset);
  const events = new Map();
  lines.forEach((line) => {
    const seasonId = teamSeason.get(line.seasonTeamId);
    if (!seasonId) return;
    const playerEvents = events.get(line.playerId) ?? new Set();
    playerEvents.add(`${prefix}:${seasonId}`);
    events.set(line.playerId, playerEvents);
  });
  return events;
}

function profileMetadata(dataset, identityIndex) {
  const metadata = new Map();
  playerRosterCandidates(dataset, { includeHistory: true }).forEach((player) => {
    const canonicalId = canonicalPlayerIdentityId(identityIndex, player.id);
    const existing = metadata.get(canonicalId);
    if (!existing || (player.current && !existing.current)) {
      metadata.set(canonicalId, player);
    }
  });
  return metadata;
}

function decorate(lines, metadata, events, extraMetadata = new Map()) {
  return lines.map((line) => {
    const player = metadata.get(line.playerId) ?? extraMetadata.get(line.playerId);
    const eventIds = [...(events.get(line.playerId) ?? [])];
    return {
      ...line,
      displayName: line.displayName || player?.displayName || 'Goonsquad player',
      avatarUrl: player?.avatarUrl ?? null,
      jerseyNumber: line.jerseyNumber ?? player?.jerseyNumber ?? null,
      position: line.position ?? player?.position ?? null,
      profilePlayerId: player?.id && !String(player.id).startsWith('tournament-player:')
        ? line.playerId
        : null,
      eventIds,
      seasonsPlayed: eventIds.length,
    };
  });
}

function buildLeagueScope(dataset, stage, identityIndex, metadata, canonicalPlayers) {
  const remapPlayerId = (line) => ({
    ...line,
    playerId: canonicalPlayerIdentityId(identityIndex, line.playerId),
  });
  const includesStage = (line) => stage === 'all' || stageOf(line) === stage;
  const skaterLines = (dataset.playerSeasonStats ?? []).filter(includesStage).map(remapPlayerId);
  const goalieLines = (dataset.goalieSeasonStats ?? []).filter(includesStage).map(remapPlayerId);
  const skaterEvents = eventKeysByPlayer(dataset, skaterLines, stage === 'all' ? 'league' : stage);
  const goalieEvents = eventKeysByPlayer(dataset, goalieLines, stage === 'all' ? 'league' : stage);

  const skaters = decorate(
    aggregatePlayerSeasonStats(skaterLines, canonicalPlayers),
    metadata,
    skaterEvents,
  ).filter((line) => number(line.gamesPlayed) > 0);

  const goalies = decorate(
    aggregateGoalieSeasonStats(goalieLines, canonicalPlayers),
    metadata,
    goalieEvents,
  ).filter((line) => number(line.gamesPlayed) > 0).map((line) => ({
    ...line,
    rateSource: 'league-raw',
  }));

  return { skaters, goalies };
}

function safeTournamentPlayerId(name) {
  const normalized = normalizePlayerIdentityName(name) || 'unknown';
  return `tournament-player:${normalized.replace(/[^a-z0-9]+/gu, '-')}`;
}

function tournamentIdentityResolver(dataset, identityIndex) {
  const canonicalByName = new Map();
  dataset.players.forEach((player) => {
    const name = normalizePlayerIdentityName(player.displayName);
    if (!name) return;
    const canonicalId = canonicalPlayerIdentityId(identityIndex, player.id);
    if (!canonicalByName.has(name) || player.id === canonicalId) {
      canonicalByName.set(name, canonicalId);
    }
  });
  return (name) => canonicalByName.get(normalizePlayerIdentityName(name)) || safeTournamentPlayerId(name);
}

function addTournamentField(target, line) {
  target.gamesPlayed += number(line.gamesPlayed);
  target.goals += number(line.goals);
  target.assists += number(line.assists);
  target.points += Number.isFinite(line.points)
    ? line.points
    : number(line.goals) + number(line.assists);
  target.penaltyMinutes += number(line.penaltyMinutes);
  target.powerPlayGoals += number(line.powerPlayGoals);
  target.shortHandedGoals += number(line.shortHandedGoals);
  target.emptyNetGoals += number(line.emptyNetGoals);
  target.gameWinningGoals += number(line.gameWinningGoals);
}

function addTournamentGoalie(target, line) {
  const minutes = number(line.minutes ?? line.minutesPlayed);
  target.gamesPlayed += number(line.gamesPlayed);
  target.gamesStarted += number(line.gamesStarted);
  target.wins += number(line.wins);
  target.losses += number(line.losses);
  target.ties += number(line.ties);
  target.shutouts += number(line.shutouts);
  target.goalsAgainst += number(line.goalsAgainst);
  target.minutesPlayed += minutes;
  target.assists += number(line.assists);
  if (Number.isFinite(line.savePercentage) && minutes > 0) {
    target.saveRateWeight += minutes;
    target.saveRateTotal += line.savePercentage * minutes;
  }
}

function buildTournamentScope(dataset, tournaments, identityIndex, metadata) {
  const resolvePlayerId = tournamentIdentityResolver(dataset, identityIndex);
  const skaterTotals = new Map();
  const goalieTotals = new Map();
  const skaterEvents = new Map();
  const goalieEvents = new Map();
  const extraMetadata = new Map();

  (tournaments ?? []).forEach((tournament) => {
    const eventId = `tournament:${tournament.id}`;
    (tournament.playerStats ?? []).forEach((line) => {
      const playerId = resolvePlayerId(line.name);
      const total = skaterTotals.get(playerId) ?? {
        playerId,
        displayName: line.name,
        jerseyNumber: line.number ?? null,
        gamesPlayed: 0,
        goals: 0,
        assists: 0,
        points: 0,
        penaltyMinutes: 0,
        powerPlayGoals: 0,
        shortHandedGoals: 0,
        emptyNetGoals: 0,
        gameWinningGoals: 0,
      };
      addTournamentField(total, line);
      skaterTotals.set(playerId, total);
      const events = skaterEvents.get(playerId) ?? new Set();
      events.add(eventId);
      skaterEvents.set(playerId, events);
      if (!metadata.has(playerId)) {
        extraMetadata.set(playerId, {
          id: playerId,
          displayName: line.name,
          jerseyNumber: line.number ?? null,
          position: null,
        });
      }
    });

    (tournament.goalieStats ?? []).forEach((line) => {
      const playerId = resolvePlayerId(line.name);
      const total = goalieTotals.get(playerId) ?? {
        playerId,
        displayName: line.name,
        jerseyNumber: line.number ?? null,
        gamesPlayed: 0,
        gamesStarted: 0,
        wins: 0,
        losses: 0,
        ties: 0,
        shutouts: 0,
        goalsAgainst: 0,
        minutesPlayed: 0,
        assists: 0,
        saveRateWeight: 0,
        saveRateTotal: 0,
      };
      addTournamentGoalie(total, line);
      goalieTotals.set(playerId, total);
      const events = goalieEvents.get(playerId) ?? new Set();
      events.add(eventId);
      goalieEvents.set(playerId, events);
      if (!metadata.has(playerId)) {
        extraMetadata.set(playerId, {
          id: playerId,
          displayName: line.name,
          jerseyNumber: line.number ?? null,
          position: 'G',
        });
      }
    });
  });

  const skaters = decorate([...skaterTotals.values()], metadata, skaterEvents, extraMetadata)
    .filter((line) => number(line.gamesPlayed) > 0)
    .map((line) => ({
      ...line,
      pointsPerGame: line.gamesPlayed ? line.points / line.gamesPlayed : 0,
    }));
  const goalies = decorate([...goalieTotals.values()].map((line) => ({
    ...line,
    saves: null,
    shotsAgainst: null,
    savePercentage: line.saveRateWeight ? line.saveRateTotal / line.saveRateWeight : null,
    goalsAgainstAverage: line.minutesPlayed ? (line.goalsAgainst * 30) / line.minutesPlayed : null,
    rateSource: 'tournament-published',
  })), metadata, goalieEvents, extraMetadata).filter((line) => number(line.gamesPlayed) > 0);

  return { skaters, goalies };
}

function mergeScopeLines(scopes, type) {
  const totals = new Map();
  const statKeys = type === 'goalies'
    ? ['gamesPlayed', 'gamesStarted', 'wins', 'losses', 'ties', 'shutouts', 'shotsAgainst', 'goalsAgainst', 'minutesPlayed', 'assists']
    : ['gamesPlayed', 'goals', 'assists', 'points', 'penaltyMinutes', 'powerPlayGoals', 'shortHandedGoals', 'emptyNetGoals', 'gameWinningGoals'];

  scopes.flatMap((scope) => scope[type]).forEach((line) => {
    const total = totals.get(line.playerId) ?? {
      ...line,
      ...Object.fromEntries(statKeys.map((key) => [key, 0])),
      eventIds: [],
      seasonsPlayed: 0,
      hasPublishedTournamentRate: false,
    };
    statKeys.forEach((key) => {
      total[key] = number(total[key]) + number(line[key]);
    });
    total.eventIds = [...new Set([...(total.eventIds || []), ...(line.eventIds || [])])];
    total.seasonsPlayed = total.eventIds.length;
    total.profilePlayerId = total.profilePlayerId || line.profilePlayerId || null;
    total.hasPublishedTournamentRate = total.hasPublishedTournamentRate
      || line.rateSource === 'tournament-published';
    totals.set(line.playerId, total);
  });

  return [...totals.values()].map((line) => {
    if (type === 'skaters') {
      return {
        ...line,
        pointsPerGame: line.gamesPlayed ? line.points / line.gamesPlayed : 0,
      };
    }
    const saves = Number.isFinite(line.shotsAgainst) && Number.isFinite(line.goalsAgainst)
      ? Math.max(0, line.shotsAgainst - line.goalsAgainst)
      : null;
    return {
      ...line,
      saves: line.hasPublishedTournamentRate ? null : saves,
      savePercentage: line.hasPublishedTournamentRate || !line.shotsAgainst
        ? null
        : saves / line.shotsAgainst,
      goalsAgainstAverage: line.minutesPlayed
        ? (line.goalsAgainst * 30) / line.minutesPlayed
        : null,
      rateSource: line.hasPublishedTournamentRate ? 'mixed-incomplete' : 'league-raw',
    };
  });
}

function scopeWithMeta(id, lines) {
  return {
    id,
    ...COMPETITION_SCOPE_META[id],
    ...lines,
    available: lines.skaters.length > 0 || lines.goalies.length > 0,
  };
}

export function buildAllTimeRecords(dataset, tournaments = []) {
  const identityIndex = buildPlayerIdentityIndex(dataset.players);
  const metadata = profileMetadata(dataset, identityIndex);
  const canonicalPlayers = dataset.players.filter((player) => (
    canonicalPlayerIdentityId(identityIndex, player.id) === player.id
  ));
  const regular = scopeWithMeta(
    'regular',
    buildLeagueScope(dataset, 'regular', identityIndex, metadata, canonicalPlayers),
  );
  const playoffs = scopeWithMeta(
    'playoffs',
    buildLeagueScope(dataset, 'playoffs', identityIndex, metadata, canonicalPlayers),
  );
  const tournamentScope = scopeWithMeta(
    'tournaments',
    buildTournamentScope(dataset, tournaments, identityIndex, metadata),
  );
  const all = scopeWithMeta('all', {
    skaters: mergeScopeLines([regular, playoffs, tournamentScope], 'skaters'),
    goalies: mergeScopeLines([regular, playoffs, tournamentScope], 'goalies'),
  });
  const leagueCombined = buildLeagueScope(dataset, 'all', identityIndex, metadata, canonicalPlayers);
  const scopes = {
    regular,
    playoffs,
    tournaments: tournamentScope,
    all,
  };

  return {
    // Kept for callers that predate competition scopes. The UI always uses scopes.
    skaters: leagueCombined.skaters,
    goalies: leagueCombined.goalies,
    scopes,
    availableScopes: availableCompetitionScopes(scopes),
    capturedAt: dataset.capturedAt ?? null,
  };
}

export const ALL_TIME_SKATER_COLUMNS = Object.freeze([
  { key: 'gamesPlayed', label: 'GP' },
  { key: 'goals', label: 'Goals' },
  { key: 'assists', label: 'Assists' },
  { key: 'points', label: 'Points' },
  { key: 'penaltyMinutes', label: 'PIM' },
]);

export const ALL_TIME_GOALIE_COLUMNS = Object.freeze([
  { key: 'gamesPlayed', label: 'GP' },
  { key: 'wins', label: 'Wins' },
  { key: 'savePercentage', label: 'SV%' },
  { key: 'goalsAgainstAverage', label: 'GAA', lowerIsBetter: true },
  { key: 'shutouts', label: 'SO' },
  { key: 'saves', label: 'Saves' },
]);

export function sortAllTimeRecords(lines, sort) {
  const direction = sort.direction === 'asc' ? 1 : -1;
  return [...lines].sort((a, b) => {
    const aValue = number(a[sort.key], Number.NEGATIVE_INFINITY);
    const bValue = number(b[sort.key], Number.NEGATIVE_INFINITY);
    return (aValue - bValue) * direction
      || number(b.gamesPlayed) - number(a.gamesPlayed)
      || a.displayName.localeCompare(b.displayName);
  });
}
