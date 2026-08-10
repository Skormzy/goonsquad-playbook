import { describe, expect, it } from 'vitest';
import {
  buildAllTimeRecords,
  sortAllTimeRecords,
} from './allTimeRecordsModel';
import { OFFICIAL_STATS_DATASET } from './statsSeed';

const dataset = {
  capturedAt: '2026-07-31',
  seasons: [{ id: 's1' }, { id: 's2' }],
  teams: [
    { id: 't1', seasonId: 's1' },
    { id: 't2', seasonId: 's2' },
  ],
  players: [
    { id: 'p1', displayName: 'Alpha', jerseyNumber: '7', primaryPosition: 'C' },
    { id: 'p2', displayName: 'Bravo', jerseyNumber: '9', primaryPosition: 'W' },
    { id: 'g1', displayName: 'Goalie', jerseyNumber: '30', primaryPosition: 'G' },
  ],
  memberships: [
    { id: 'm1', playerId: 'p1', seasonTeamId: 't1', jerseyNumber: '7', position: 'C', active: true },
    { id: 'm2', playerId: 'p1', seasonTeamId: 't2', jerseyNumber: '7', position: 'C', active: true },
    { id: 'm3', playerId: 'p2', seasonTeamId: 't2', jerseyNumber: '9', position: 'W', active: true },
    { id: 'm4', playerId: 'g1', seasonTeamId: 't2', jerseyNumber: '30', position: 'G', active: true },
  ],
  playerSeasonStats: [
    { playerId: 'p1', seasonTeamId: 't1', gamesPlayed: 4, goals: 2, assists: 3, points: 5, penaltyMinutes: 6 },
    { playerId: 'p1', seasonTeamId: 't2', gamesPlayed: 5, goals: 1, assists: 4, points: 5, penaltyMinutes: 2 },
    { playerId: 'p2', seasonTeamId: 't2', gamesPlayed: 5, goals: 6, assists: 1, points: 7, penaltyMinutes: 10 },
  ],
  goalieSeasonStats: [
    { playerId: 'g1', seasonTeamId: 't2', gamesPlayed: 5, wins: 3, losses: 2, ties: 0, shutouts: 1, shotsAgainst: 100, goalsAgainst: 15, minutesPlayed: 150 },
  ],
};

describe('all-time records', () => {
  it('aggregates seasons by official player id and preserves profile metadata', () => {
    const records = buildAllTimeRecords(dataset);
    expect(records.skaters.find((line) => line.playerId === 'p1')).toMatchObject({
      gamesPlayed: 9,
      goals: 3,
      assists: 7,
      points: 10,
      penaltyMinutes: 8,
      jerseyNumber: '7',
      position: 'C',
      seasonsPlayed: 2,
    });
    expect(records.goalies[0]).toMatchObject({
      playerId: 'g1',
      wins: 3,
      saves: 85,
      shutouts: 1,
    });
  });

  it('sorts standard columns high-to-low and GAA low-to-high', () => {
    const records = buildAllTimeRecords(dataset);
    expect(sortAllTimeRecords(records.skaters, { key: 'goals', direction: 'desc' })[0].playerId).toBe('p2');
    expect(sortAllTimeRecords([
      { playerId: 'a', displayName: 'A', gamesPlayed: 1, goalsAgainstAverage: 3.2 },
      { playerId: 'b', displayName: 'B', gamesPlayed: 1, goalsAgainstAverage: 2.1 },
    ], { key: 'goalsAgainstAverage', direction: 'asc' })[0].playerId).toBe('b');
  });

  it('builds a unique record book from the complete verified archive', () => {
    const records = buildAllTimeRecords(OFFICIAL_STATS_DATASET);
    expect(records.skaters.length).toBeGreaterThan(100);
    expect(records.goalies.length).toBeGreaterThan(5);
    expect(new Set(records.skaters.map((line) => line.playerId)).size).toBe(records.skaters.length);
    expect(new Set(records.goalies.map((line) => line.playerId)).size).toBe(records.goalies.length);
    expect(records.skaters.every((line) => (
      Number.isFinite(line.goals)
      && Number.isFinite(line.assists)
      && line.points === line.goals + line.assists
      && line.seasonsPlayed > 0
    ))).toBe(true);
  });

  it('keeps regular season, playoffs, and tournaments separate before building combined totals', () => {
    const scopedDataset = {
      ...dataset,
      playerSeasonStats: [
        { playerId: 'p1', seasonTeamId: 't1', stage: 'regular', gamesPlayed: 4, goals: 2, assists: 3, points: 5, penaltyMinutes: 2 },
        { playerId: 'p1', seasonTeamId: 't1', stage: 'playoffs', gamesPlayed: 2, goals: 1, assists: 2, points: 3, penaltyMinutes: 4 },
      ],
      goalieSeasonStats: [
        { playerId: 'g1', seasonTeamId: 't1', stage: 'regular', gamesPlayed: 4, wins: 2, losses: 2, ties: 0, shutouts: 0, shotsAgainst: 80, goalsAgainst: 12, minutesPlayed: 120 },
        { playerId: 'g1', seasonTeamId: 't1', stage: 'playoffs', gamesPlayed: 2, wins: 1, losses: 1, ties: 0, shutouts: 1, shotsAgainst: 40, goalsAgainst: 4, minutesPlayed: 60 },
      ],
    };
    const tournaments = [{
      id: 'cup',
      playerStats: [{ name: 'Alpha', gamesPlayed: 3, goals: 4, assists: 1, points: 5 }],
      goalieStats: [{ name: 'Goalie', gamesPlayed: 1, wins: 1, losses: 0, goalsAgainst: 2, minutes: 30, savePercentage: 0.9 }],
    }];
    const records = buildAllTimeRecords(scopedDataset, tournaments);

    expect(records.scopes.regular.skaters[0]).toMatchObject({ gamesPlayed: 4, points: 5 });
    expect(records.scopes.playoffs.skaters[0]).toMatchObject({ gamesPlayed: 2, points: 3 });
    expect(records.scopes.tournaments.skaters[0]).toMatchObject({ gamesPlayed: 3, points: 5 });
    expect(records.scopes.all.skaters[0]).toMatchObject({ gamesPlayed: 9, points: 13 });
    expect(records.scopes.all.goalies[0]).toMatchObject({ gamesPlayed: 7, savePercentage: null, saves: null });
  });

  it('recomputes combined league goalie rates from regular-season and playoff totals', () => {
    const scopedDataset = {
      ...dataset,
      playerSeasonStats: [],
      goalieSeasonStats: [
        { playerId: 'g1', seasonTeamId: 't1', stage: 'regular', gamesPlayed: 4, wins: 2, losses: 2, ties: 0, shutouts: 0, shotsAgainst: 80, goalsAgainst: 12, minutesPlayed: 120 },
        { playerId: 'g1', seasonTeamId: 't1', stage: 'playoffs', gamesPlayed: 2, wins: 1, losses: 1, ties: 0, shutouts: 1, shotsAgainst: 40, goalsAgainst: 4, minutesPlayed: 60 },
      ],
    };
    const goalie = buildAllTimeRecords(scopedDataset).scopes.all.goalies[0];

    expect(goalie).toMatchObject({ shotsAgainst: 120, goalsAgainst: 16, saves: 104 });
    expect(goalie.savePercentage).toBeCloseTo(104 / 120, 5);
    expect(goalie.goalsAgainstAverage).toBeCloseTo(16 * 30 / 180, 5);
  });

  it('publishes one combined all-time record for Mathew Grenier', () => {
    const records = buildAllTimeRecords(OFFICIAL_STATS_DATASET);
    const matches = records.skaters.filter((line) => line.displayName === 'Mathew Grenier');

    expect(matches).toHaveLength(1);
    expect(matches[0]).toMatchObject({
      playerId: 'ycbhl-player-25650',
      gamesPlayed: 49,
      goals: 54,
      assists: 39,
      points: 93,
      seasonsPlayed: 6,
    });
  });

  it('publishes one record for every reviewed duplicate or name variant', () => {
    const records = buildAllTimeRecords(OFFICIAL_STATS_DATASET);
    const expected = [
      ['Adrian Bockner', 84, 33],
      ['Andrew Lorenowicz', 235, 16],
      ['Mathew Grenier', 49, 93],
      ['Matthew Stott', 39, 7],
      ['Michael Thomas Kerrane', 62, 10],
      ['Michael Woods', 4, 16],
      ['Michael Yen', 20, 8],
      ['Ryan Hunt', 59, 8],
      ['Stephen Macdonald', 59, 11],
      ['Zachary Sher', 23, 15],
    ];

    expected.forEach(([displayName, gamesPlayed, points]) => {
      const matches = records.skaters.filter((line) => line.displayName === displayName);
      expect(matches, displayName).toHaveLength(1);
      expect(matches[0]).toMatchObject({ gamesPlayed, points });
    });
  });
});
