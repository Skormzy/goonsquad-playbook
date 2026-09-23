import { describe, expect, it } from 'vitest';
import {
  aggregateGoalieStats,
  aggregateGoalieSeasonStats,
  aggregatePlayerStats,
  aggregatePlayerSeasonStats,
  ALL_SEASON_TEAMS_ID,
  calculateTeamRecord,
  formatLeagueTierSummary,
  formatScheduleName,
  formatTierName,
  statsSnapshot,
  teamSummary,
} from './statsModel';

describe('statistics model', () => {
  const games = [
    { id: 'g1', seasonTeamId: 't1', status: 'final', goalsFor: 5, goalsAgainst: 2, scheduledAt: '2026-07-01' },
    { id: 'g2', seasonTeamId: 't1', status: 'final', goalsFor: 3, goalsAgainst: 3, scheduledAt: '2026-07-08' },
    { id: 'g3', seasonTeamId: 't1', status: 'scheduled', goalsFor: null, goalsAgainst: null, scheduledAt: '2026-07-15' },
  ];

  it('uses final games only for the official record', () => {
    expect(calculateTeamRecord(games)).toEqual({
      gamesPlayed: 2,
      wins: 1,
      losses: 0,
      ties: 1,
      goalsFor: 8,
      goalsAgainst: 5,
    });
    expect(teamSummary(games)).toMatchObject({ points: 3, goalDifference: 3, winPercentage: 0.5 });
  });

  it('aggregates field-player and goalie lines without inventing missing values', () => {
    const players = [{ id: 'p1', displayName: 'Alex' }, { id: 'g1', displayName: 'Sam' }];
    expect(aggregatePlayerStats([
      { playerId: 'p1', goals: 2, assists: 1, shots: 5 },
      { playerId: 'p1', goals: 0, assists: 2, shots: 3 },
    ], players)[0]).toMatchObject({ gamesPlayed: 2, goals: 2, assists: 3, points: 5, shots: 8 });
    expect(aggregateGoalieStats([
      { playerId: 'g1', wins: 1, goalsAgainst: 2, shotsAgainst: 20, saves: 18, minutesPlayed: 30 },
    ], players)[0]).toMatchObject({ gamesPlayed: 1, wins: 1, savePercentage: 0.9, goalsAgainstAverage: 2 });
  });

  it.each([0, '00', '42', null])('carries number %s through every player and goalie aggregation', (jerseyNumber) => {
    const players = [{ id: 'p1', displayName: 'Alex', jerseyNumber }];
    const lines = [{ playerId: 'p1', gamesPlayed: 1 }];
    const expectedNumber = jerseyNumber === null ? null : String(jerseyNumber);
    [aggregatePlayerStats, aggregateGoalieStats, aggregatePlayerSeasonStats, aggregateGoalieSeasonStats].forEach((aggregate) => {
      expect(aggregate(lines, players)[0]).toMatchObject({ displayName: 'Alex', jerseyNumber: expectedNumber });
    });
  });

  it.each([aggregatePlayerStats, aggregatePlayerSeasonStats])('combines reviewed field-player aliases in %s without losing unknown statistics', (aggregate) => {
    const players = [
      { id: 'ycbhl-player-25650', displayName: 'Mathew Grenier', jerseyNumber: '7' },
      { id: 'gtbhl-player-88577', displayName: 'Matt Grenier', jerseyNumber: '7' },
      { id: 'unreviewed-matt', displayName: 'Matt Grenier' },
    ];
    const rows = aggregate([
      { playerId: 'ycbhl-player-25650', gamesPlayed: 2, goals: 2, assists: 1, points: 3, shots: 6, penaltyMinutes: 0 },
      { playerId: 'gtbhl-player-88577', gamesPlayed: 1, goals: 1, assists: 3, points: 4, shots: null, penaltyMinutes: null },
      { playerId: 'unreviewed-matt', gamesPlayed: 1, goals: 0, assists: 0, points: 0 },
    ], players);

    expect(rows).toHaveLength(2);
    expect(rows.find((row) => row.playerId === 'ycbhl-player-25650')).toMatchObject({
      displayName: 'Mathew Grenier', jerseyNumber: '7', gamesPlayed: 3,
      goals: 3, assists: 4, points: 7, penaltyMinutes: null, shots: null,
      pointsPerGame: 7 / 3,
    });
    expect(rows.find((row) => row.playerId === 'unreviewed-matt').gamesPlayed).toBe(1);
  });

  it.each([aggregateGoalieStats, aggregateGoalieSeasonStats])('combines misspelled goalie aliases in %s and recalculates rates from their totals', (aggregate) => {
    const players = [
      { id: 'ycbhl-player-25735', displayName: 'Abraham Sadozi', jerseyNumber: '30' },
      { id: 'ycbhl-player-25962', displayName: 'Abraham Saodzi', jerseyNumber: '30' },
    ];
    const rows = aggregate([
      { playerId: 'ycbhl-player-25735', gamesPlayed: 2, wins: 2, losses: 0, ties: 0, goalsAgainst: 6, shotsAgainst: 32, saves: 26, minutesPlayed: 60, shutouts: 0, savePercentage: 0.813 },
      { playerId: 'ycbhl-player-25962', gamesPlayed: 1, wins: 0, losses: 1, ties: 0, goalsAgainst: 7, shotsAgainst: 24, saves: 17, minutesPlayed: 30, shutouts: 0, savePercentage: 0.708 },
    ], players);

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      playerId: 'ycbhl-player-25735', displayName: 'Abraham Sadozi', jerseyNumber: '30',
      gamesPlayed: 3, wins: 2, losses: 1, ties: 0, goalsAgainst: 13,
      shotsAgainst: 56, saves: 43, minutesPlayed: 90, shutouts: 0,
    });
    expect(rows[0].savePercentage).toBeCloseTo(43 / 56);
    expect(rows[0].goalsAgainstAverage).toBeCloseTo(13 / 3);
  });

  it('uses the reviewed name in season and game views while preserving the source game-line identity', () => {
    const misspelledId = 'ycbhl-player-25962';
    const snapshot = statsSnapshot({
      seasons: [{ id: 's1', name: 'Summer 2025' }],
      teams: [{ id: 't1', seasonId: 's1', name: 'Sunday Team' }],
      players: [
        { id: 'ycbhl-player-25735', displayName: 'Abraham Sadozi' },
        { id: misspelledId, displayName: 'Abraham Saodzi' },
      ],
      memberships: [{ playerId: misspelledId, seasonTeamId: 't1', jerseyNumber: '30' }],
      games: [games[0]],
      teamGameStats: [],
      playerGameStats: [{ id: 'original-field-line', gameId: 'g1', playerId: misspelledId, gamesPlayed: 1, goals: 0, assists: 0 }],
      goalieGameStats: [{ id: 'original-goalie-line', gameId: 'g1', playerId: misspelledId, gamesPlayed: 1, goalsAgainst: 7, shotsAgainst: 24, saves: 17, minutesPlayed: 30 }],
    }, 's1', 't1');

    expect(snapshot.fieldPlayers[0]).toMatchObject({ playerId: 'ycbhl-player-25735', displayName: 'Abraham Sadozi', jerseyNumber: '30' });
    expect(snapshot.goalies[0]).toMatchObject({ playerId: 'ycbhl-player-25735', displayName: 'Abraham Sadozi', jerseyNumber: '30' });
    expect(snapshot.gameDetails.g1.players[0]).toMatchObject({ id: 'original-field-line', playerId: misspelledId, displayName: 'Abraham Sadozi' });
    expect(snapshot.gameDetails.g1.goalies[0]).toMatchObject({ id: 'original-goalie-line', playerId: misspelledId, displayName: 'Abraham Sadozi' });
  });

  it('preserves an explicit number clear when combining aliases with historical numbers', () => {
    const rows = aggregateGoalieStats([
      { playerId: 'ycbhl-player-25962', gamesPlayed: 1 },
    ], [
      { id: 'ycbhl-player-25735', displayName: 'Abraham Sadozi', jerseyNumber: null, jerseyNumberAuthoritative: true },
      { id: 'ycbhl-player-25962', displayName: 'Abraham Saodzi', jerseyNumber: '30' },
    ]);
    expect(rows[0].jerseyNumber).toBeNull();
  });

  it('keeps unavailable game-line statistics null while preserving published zeroes', () => {
    const players = [
      { id: 'unknown', displayName: 'Unknown totals' },
      { id: 'zero', displayName: 'Published zero' },
      { id: 'goalie', displayName: 'Goalie' },
    ];
    const fieldPlayers = aggregatePlayerStats([
      { playerId: 'unknown', goals: null, assists: null, shots: null, penaltyMinutes: null, plusMinus: null },
      { playerId: 'zero', goals: 0, assists: 0, shots: 0, penaltyMinutes: 0, plusMinus: 0 },
    ], players);
    const unknown = fieldPlayers.find((line) => line.playerId === 'unknown');
    const zero = fieldPlayers.find((line) => line.playerId === 'zero');

    expect(unknown).toMatchObject({
      goals: null,
      assists: null,
      points: null,
      shots: null,
      shootingPercentage: null,
    });
    expect(zero).toMatchObject({
      goals: 0,
      assists: 0,
      points: 0,
      shots: 0,
      shootingPercentage: 0,
    });

    expect(aggregateGoalieStats([
      { playerId: 'goalie', goalsAgainst: null, shotsAgainst: null, saves: null, minutesPlayed: null },
    ], players)[0]).toMatchObject({
      goalsAgainst: null,
      shotsAgainst: null,
      saves: null,
      savePercentage: null,
      goalsAgainstAverage: null,
    });
  });

  it('uses published season totals and keeps regular-season and playoff stages separate', () => {
    const players = [{ id: 'p1', displayName: 'Alex' }, { id: 'g1', displayName: 'Sam' }];
    expect(aggregatePlayerSeasonStats([
      { playerId: 'p1', gamesPlayed: 8, goals: 3, assists: 4, points: 7, penaltyMinutes: 2, source: 'league' },
    ], players)[0]).toMatchObject({ gamesPlayed: 8, points: 7, pointsPerGame: 0.875, shots: null });
    expect(aggregateGoalieSeasonStats([
      { playerId: 'g1', gamesPlayed: 2, wins: 1, losses: 1, shotsAgainst: 40, goalsAgainst: 4, minutesPlayed: 60 },
    ], players)[0]).toMatchObject({ savePercentage: 0.9, goalsAgainstAverage: 2 });

    const dataset = {
      seasons: [{ id: 's1', name: 'Summer 2026' }],
      teams: [{ id: 't1', seasonId: 's1', name: 'Sunday Team' }],
      players,
      memberships: [],
      games: [
        { ...games[0], stage: 'regular' },
        { id: 'p1', seasonTeamId: 't1', stage: 'playoffs', status: 'final', goalsFor: 2, goalsAgainst: 1, scheduledAt: '2026-08-01' },
      ],
      teamGameStats: [], playerGameStats: [], goalieGameStats: [],
      teamSeasonSummaries: [{ seasonTeamId: 't1', gamesPlayed: 10, wins: 3, losses: 6, ties: 1, points: 7 }],
      playerSeasonStats: [{ id: 'l1', seasonTeamId: 't1', stage: 'regular', playerId: 'p1', gamesPlayed: 8, goals: 3, assists: 4, points: 7 }],
      goalieSeasonStats: [],
    };
    const regular = statsSnapshot(dataset, 's1', 't1', 'regular');
    const playoffs = statsSnapshot(dataset, 's1', 't1', 'playoffs');
    expect(regular.summary).toMatchObject({ gamesPlayed: 10, wins: 3, losses: 6, ties: 1, points: 7 });
    expect(regular.fieldPlayers[0]).toMatchObject({ displayName: 'Alex', points: 7 });
    expect(playoffs.games.map((game) => game.id)).toEqual(['p1']);
    expect(playoffs.summary).toMatchObject({ gamesPlayed: 1, wins: 1 });
    expect(playoffs.availableStages).toEqual(['regular', 'playoffs', 'all']);
  });

  it('does not derive official season totals from unavailable source fields', () => {
    const players = [{ id: 'p1', displayName: 'Alex' }, { id: 'g1', displayName: 'Sam' }];
    expect(aggregatePlayerSeasonStats([
      {
        playerId: 'p1',
        gamesPlayed: 8,
        goals: null,
        assists: null,
        points: null,
        penaltyMinutes: null,
        powerPlayGoals: null,
        shortHandedGoals: null,
        emptyNetGoals: null,
      },
    ], players)[0]).toMatchObject({
      gamesPlayed: 8,
      goals: null,
      assists: null,
      points: null,
      pointsPerGame: null,
      penaltyMinutes: null,
    });

    expect(aggregateGoalieSeasonStats([
      {
        playerId: 'g1',
        gamesPlayed: 2,
        wins: null,
        losses: null,
        ties: null,
        shotsAgainst: null,
        goalsAgainst: null,
        minutesPlayed: null,
      },
    ], players)[0]).toMatchObject({
      gamesPlayed: 2,
      wins: null,
      saves: null,
      savePercentage: null,
      goalsAgainstAverage: null,
    });
  });

  it('selects a season and team while preserving an honest empty state', () => {
    const snapshot = statsSnapshot({
      source: 'structure',
      seasons: [{ id: 's1', name: 'Summer 2026' }],
      teams: [{ id: 't1', seasonId: 's1', name: 'Monday Team' }],
      players: [], memberships: [], games: [], teamGameStats: [], playerGameStats: [], goalieGameStats: [],
    }, 's1', 't1');
    expect(snapshot.team.name).toBe('Monday Team');
    expect(snapshot.summary.gamesPlayed).toBe(0);
    expect(snapshot.fieldPlayers).toEqual([]);
  });

  it('keeps Sunday and weekday schedules distinct while building one deduplicated season view', () => {
    const dataset = {
      seasons: [{ id: 's1', name: 'Summer 2026' }],
      teams: [
        { id: 'monday', seasonId: 's1', name: 'Goonsquad', scheduleLabel: 'MON/THU', division: 'MON/THU TIER 5', leagueKey: 'york-central', leagueName: 'York Central Ball Hockey League' },
        { id: 'sunday', seasonId: 's1', name: 'Goonsquad', scheduleLabel: 'SUNDAY', division: 'SUNDAY TIER 5', leagueKey: 'york-central', leagueName: 'York Central Ball Hockey League' },
      ],
      players: [{ id: 'shared-player', displayName: 'Alex' }],
      memberships: [],
      games: [
        { id: 'm1', seasonTeamId: 'monday', stage: 'regular', status: 'final', goalsFor: 4, goalsAgainst: 2, scheduledAt: '2026-07-20' },
        { id: 's1', seasonTeamId: 'sunday', stage: 'regular', status: 'final', goalsFor: 1, goalsAgainst: 3, scheduledAt: '2026-07-19' },
      ],
      teamGameStats: [], playerGameStats: [], goalieGameStats: [], gameEvents: [],
      teamSeasonSummaries: [
        { seasonTeamId: 'monday', gamesPlayed: 1, wins: 1, losses: 0, ties: 0, points: 2 },
        { seasonTeamId: 'sunday', gamesPlayed: 1, wins: 0, losses: 1, ties: 0, points: 0 },
      ],
      playerSeasonStats: [
        { id: 'ml', seasonTeamId: 'monday', stage: 'regular', playerId: 'shared-player', gamesPlayed: 1, goals: 2, assists: 0, points: 2 },
        { id: 'sl', seasonTeamId: 'sunday', stage: 'regular', playerId: 'shared-player', gamesPlayed: 1, goals: 0, assists: 1, points: 1 },
      ],
      goalieSeasonStats: [],
    };

    const snapshot = statsSnapshot(dataset, 's1', ALL_SEASON_TEAMS_ID);
    expect(snapshot.isSeasonAggregate).toBe(true);
    expect(snapshot.seasonSchedules.map((schedule) => schedule.label)).toEqual(['YCBHL · Monday Tier 5 League', 'YCBHL · Sunday Tier 5 League']);
    expect(snapshot.games.map((game) => game.id)).toEqual(['m1', 's1']);
    expect(snapshot.summary).toMatchObject({ gamesPlayed: 2, wins: 1, losses: 1, points: 2, goalsFor: 5, goalsAgainst: 5 });
    expect(snapshot.fieldPlayers[0]).toMatchObject({ playerId: 'shared-player', gamesPlayed: 2, goals: 2, assists: 1, points: 3 });
    expect(snapshot.gameDetails.m1.schedule.id).toBe('monday');
    expect(statsSnapshot(dataset, 's1', '').team.id).toBe(ALL_SEASON_TEAMS_ID);
    expect(statsSnapshot(dataset, 's1', 'sunday').games.map((game) => game.id)).toEqual(['s1']);
  });

  it('expands official schedule abbreviations without changing source identity', () => {
    expect(formatScheduleName({ scheduleLabel: 'MON/THU' })).toBe('Monday League');
    expect(formatScheduleName({ scheduleLabel: 'THURSDAY / MONDAY' })).toBe('Monday League');
    expect(formatScheduleName({ scheduleLabel: 'MON/WED' })).toBe('Monday League');
    expect(formatScheduleName({ scheduleLabel: 'SUNDAY' })).toBe('Sunday League');
    expect(formatScheduleName({ scheduleLabel: 'SUNDAY', name: 'Sunday Tier 4 Team' })).toBe('Sunday Tier 4 League');
    expect(formatScheduleName({ scheduleLabel: 'SUNDAY', name: 'Sunday Tier 5 Team' })).toBe('Sunday Tier 5 League');
    expect(formatScheduleName({ scheduleLabel: 'MON/WED', name: 'Monday Team', division: 'MON/WED TIER 5' })).toBe('Monday Tier 5 League');
    expect(formatScheduleName({ scheduleLabel: 'SUNDAY', division: 'SUNDAY TIER 5B WEST (D)' })).toBe('Sunday Tier 5B West League');
    expect(formatTierName({ division: 'WEDNESDAY TIER 4/5 WEST (D/E)' })).toBe('Tier 4/5 West');
    expect(formatLeagueTierSummary([
      { leagueKey: 'york-central', division: 'SUNDAY TIER 4' },
      { leagueKey: 'york-central', division: 'SUNDAY TIER 5' },
      { leagueKey: 'york-central', division: 'MON/WED TIER 5' },
    ])).toBe('YCBHL · Tiers 4 + 5');
  });
});
