import { describe, expect, it } from 'vitest';
import { applyGameStatOverrides, mapGameStatOverrideRow } from './gameStatOverrides';
import { statsSnapshot } from './statsModel';

function dataset() {
  return {
    seasons: [{ id: 's1', name: 'Season', current: true }],
    teams: [{ id: 't1', seasonId: 's1', scheduleLabel: 'SUNDAY' }],
    players: [
      { id: 'p1', displayName: 'Original Scorer' },
      { id: 'p2', displayName: 'Corrected Scorer' },
      { id: 'p3', displayName: 'Primary Assist' },
      { id: 'g1', displayName: 'Goalie' },
    ],
    memberships: ['p1', 'p2', 'p3', 'g1'].map((playerId) => ({
      id: `m-${playerId}`,
      seasonTeamId: 't1',
      playerId,
      active: true,
    })),
    games: [{
      id: 'league-game-10',
      externalId: '10',
      seasonTeamId: 't1',
      stage: 'regular',
      scheduledAt: '2026-07-19T18:00:00',
      status: 'final',
      goalsFor: 1,
      goalsAgainst: 0,
    }],
    teamGameStats: [],
    playerGameStats: [
      { id: 'l1', gameId: 'league-game-10', playerId: 'p1', gamesPlayed: 1, goals: 1, assists: 0, penaltyMinutes: 0, powerPlayGoals: 0, shortHandedGoals: 0, emptyNetGoals: 0, source: 'league' },
      { id: 'l2', gameId: 'league-game-10', playerId: 'p2', gamesPlayed: 1, goals: 0, assists: 0, penaltyMinutes: 0, powerPlayGoals: 0, shortHandedGoals: 0, emptyNetGoals: 0, source: 'league' },
      { id: 'l3', gameId: 'league-game-10', playerId: 'p3', gamesPlayed: 1, goals: 0, assists: 0, penaltyMinutes: 0, powerPlayGoals: 0, shortHandedGoals: 0, emptyNetGoals: 0, source: 'league' },
    ],
    goalieGameStats: [{ id: 'gl1', gameId: 'league-game-10', playerId: 'g1', gamesPlayed: 1, wins: 1, losses: 0, ties: 0, goalsAgainst: 0, shotsAgainst: 0, saves: 0, shutouts: 1, minutesPlayed: 30, source: 'league' }],
    gameEvents: [{ id: 'e1', gameId: 'league-game-10', period: 1, eventType: 'goal', teamSide: 'us', primaryPlayerId: 'p1', detail: { scorer: 'Original Scorer', assists: [] }, source: 'league' }],
    teamSeasonSummaries: [{ seasonTeamId: 't1', gamesPlayed: 1, wins: 1, losses: 0, ties: 0, points: 2, source: 'league' }],
    playerSeasonStats: [
      { id: 's-p1', seasonTeamId: 't1', stage: 'regular', playerId: 'p1', gamesPlayed: 5, goals: 4, assists: 1, points: 5, penaltyMinutes: 0, powerPlayGoals: 0, shortHandedGoals: 0, emptyNetGoals: 0, source: 'league' },
      { id: 's-p2', seasonTeamId: 't1', stage: 'regular', playerId: 'p2', gamesPlayed: 4, goals: 2, assists: 2, points: 4, penaltyMinutes: 0, powerPlayGoals: 0, shortHandedGoals: 0, emptyNetGoals: 0, source: 'league' },
      { id: 's-p3', seasonTeamId: 't1', stage: 'regular', playerId: 'p3', gamesPlayed: 4, goals: 0, assists: 1, points: 1, penaltyMinutes: 0, powerPlayGoals: 0, shortHandedGoals: 0, emptyNetGoals: 0, source: 'league' },
    ],
    goalieSeasonStats: [{ id: 's-g1', seasonTeamId: 't1', stage: 'regular', playerId: 'g1', gamesPlayed: 5, wins: 3, losses: 2, ties: 0, goalsAgainst: 10, shotsAgainst: 100, shutouts: 1, minutesPlayed: 150, source: 'league' }],
  };
}

function correction(payload) {
  return [{
    game_key: 'league-game-10',
    game_external_id: '10',
    season_team_id: 't1',
    payload,
    note: 'Coach correction',
    updated_at: '2026-07-31T12:00:00Z',
  }];
}

describe('admin game-stat reconciliation', () => {
  it('replaces a scorer and reconciles the game, season, leaderboard, and profile source lines once', () => {
    const base = dataset();
    const corrected = applyGameStatOverrides(base, correction({
      version: 1,
      game: { goalsFor: 1, goalsAgainst: 0, status: 'final', overtime: false },
      teamStats: { shotsFor: 18, shotsAgainst: 13 },
      playerLines: [
        { playerId: 'p1', gamesPlayed: 1, goals: 0, assists: 0 },
        { playerId: 'p2', gamesPlayed: 1, goals: 1, assists: 0 },
        { playerId: 'p3', gamesPlayed: 1, goals: 0, assists: 1 },
      ],
      goalieLines: [{ playerId: 'g1', gamesPlayed: 1, wins: 1, goalsAgainst: 0, shotsAgainst: 13, saves: 13, shutouts: 1, minutesPlayed: 30 }],
      events: [{ period: 2, clockSeconds: 420, eventType: 'goal', teamSide: 'us', primaryPlayerId: 'p2', secondaryPlayerId: 'p3', detail: { scorer: 'Corrected Scorer', assists: ['Primary Assist'], assistPlayerIds: ['p3'], strength: 'EV' } }],
    }));

    expect(base.playerSeasonStats.find((line) => line.playerId === 'p1').goals).toBe(4);
    expect(corrected.games[0].adminCorrection).toMatchObject({ note: 'Coach correction' });
    expect(corrected.playerGameStats.find((line) => line.playerId === 'p1').goals).toBe(0);
    expect(corrected.playerGameStats.find((line) => line.playerId === 'p2').goals).toBe(1);
    expect(corrected.playerSeasonStats.find((line) => line.playerId === 'p1')).toMatchObject({ goals: 3, points: 4 });
    expect(corrected.playerSeasonStats.find((line) => line.playerId === 'p2')).toMatchObject({ goals: 3, points: 5 });
    expect(corrected.playerSeasonStats.find((line) => line.playerId === 'p3')).toMatchObject({ assists: 2, points: 2 });
    expect(corrected.goalieSeasonStats[0]).toMatchObject({ shotsAgainst: 113, goalsAgainst: 10, shutouts: 1 });

    const snapshot = statsSnapshot(corrected, 's1', 't1');
    expect(snapshot.fieldPlayers.map((line) => [line.playerId, line.points])).toEqual([
      ['p2', 5],
      ['p1', 4],
      ['p3', 2],
    ]);
    expect(snapshot.gameDetails['league-game-10'].events[0].detail.scorer).toBe('Corrected Scorer');
    expect(snapshot.gameDetails['league-game-10'].team).toMatchObject({ shotsFor: 18, shotsAgainst: 13 });
  });

  it('adds missing scorer and assist credit when the official game published zero lines', () => {
    const base = dataset();
    base.playerGameStats = base.playerGameStats.map((line) => ({ ...line, goals: 0, assists: 0 }));
    base.gameEvents = [];
    const corrected = applyGameStatOverrides(base, correction({
      playerLines: [
        { playerId: 'p1', gamesPlayed: 1, goals: 0, assists: 0 },
        { playerId: 'p2', gamesPlayed: 1, goals: 1, assists: 0 },
        { playerId: 'p3', gamesPlayed: 1, goals: 0, assists: 1 },
      ],
      events: [],
    }));
    expect(corrected.playerSeasonStats.find((line) => line.playerId === 'p2')).toMatchObject({ goals: 3, points: 5 });
    expect(corrected.playerSeasonStats.find((line) => line.playerId === 'p3')).toMatchObject({ assists: 2, points: 2 });
  });

  it('reconciles a corrected final score into the official team record', () => {
    const corrected = applyGameStatOverrides(dataset(), correction({
      game: { goalsFor: 0, goalsAgainst: 1, status: 'final', overtime: false },
    }));
    expect(corrected.teamSeasonSummaries[0]).toMatchObject({ gamesPlayed: 1, wins: 0, losses: 1, ties: 0, points: 0 });
    expect(statsSnapshot(corrected, 's1', 't1').summary).toMatchObject({ wins: 0, losses: 1, goalsFor: 0, goalsAgainst: 1 });
  });

  it('maps the public RPC row without leaking database naming into the model', () => {
    expect(mapGameStatOverrideRow({
      game_key: 'g1',
      game_external_id: '10',
      season_team_id: 't1',
      payload: { version: 1 },
      note: 'Verified',
      updated_at: '2026-07-31',
    })).toEqual({
      gameKey: 'g1',
      gameExternalId: '10',
      seasonTeamId: 't1',
      payload: { version: 1 },
      note: 'Verified',
      updatedAt: '2026-07-31',
    });
  });
});
