import { playerRosterCandidates } from '../profile/profileModel';
import {
  aggregateGoalieSeasonStats,
  aggregatePlayerSeasonStats,
} from './statsModel';

function number(value, fallback = 0) {
  return Number.isFinite(value) ? value : fallback;
}

function seasonsByPlayer(dataset, lines) {
  const teamSeason = new Map(
    dataset.teams.map((team) => [team.id, team.seasonId]),
  );
  const seasons = new Map();
  lines.forEach((line) => {
    const seasonId = teamSeason.get(line.seasonTeamId);
    if (!seasonId) return;
    const playerSeasons = seasons.get(line.playerId) ?? new Set();
    playerSeasons.add(seasonId);
    seasons.set(line.playerId, playerSeasons);
  });
  return seasons;
}

function profileMetadata(dataset) {
  return new Map(
    playerRosterCandidates(dataset, { includeHistory: true })
      .map((player) => [player.id, player]),
  );
}

function decorate(lines, metadata, seasons) {
  return lines.map((line) => {
    const player = metadata.get(line.playerId);
    return {
      ...line,
      avatarUrl: player?.avatarUrl ?? null,
      jerseyNumber: player?.jerseyNumber ?? null,
      position: player?.position ?? null,
      seasonsPlayed: seasons.get(line.playerId)?.size ?? 0,
    };
  });
}

export function buildAllTimeRecords(dataset) {
  const metadata = profileMetadata(dataset);
  const skaterLines = dataset.playerSeasonStats ?? [];
  const goalieLines = dataset.goalieSeasonStats ?? [];
  const skaterSeasons = seasonsByPlayer(dataset, skaterLines);
  const goalieSeasons = seasonsByPlayer(dataset, goalieLines);

  const skaters = decorate(
    aggregatePlayerSeasonStats(skaterLines, dataset.players),
    metadata,
    skaterSeasons,
  ).filter((line) => number(line.gamesPlayed) > 0);

  const goalies = decorate(
    aggregateGoalieSeasonStats(goalieLines, dataset.players),
    metadata,
    goalieSeasons,
  ).filter((line) => number(line.gamesPlayed) > 0);

  return {
    skaters,
    goalies,
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
