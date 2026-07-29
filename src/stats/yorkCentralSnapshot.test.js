import { describe, expect, it } from 'vitest';
import snapshot from './yorkCentralSnapshot.json';
import { ALL_SEASON_TEAMS_ID, statsSnapshot } from './statsModel';

describe('York Central Goonsquad statistics snapshot', () => {
  it('keeps every imported relationship intact', () => {
    const teamIds = new Set(snapshot.teams.map((team) => team.id));
    const playerIds = new Set(snapshot.players.map((player) => player.id));
    const gameIds = new Set(snapshot.games.map((game) => game.id));
    expect(snapshot.teamSeasonSummaries).toHaveLength(snapshot.teams.length);
    expect(snapshot.games.every((game) => teamIds.has(game.seasonTeamId))).toBe(true);
    expect(snapshot.playerSeasonStats.every((line) => teamIds.has(line.seasonTeamId) && playerIds.has(line.playerId))).toBe(true);
    expect(snapshot.goalieSeasonStats.every((line) => teamIds.has(line.seasonTeamId) && playerIds.has(line.playerId))).toBe(true);
    expect(snapshot.teamGameStats.every((line) => gameIds.has(line.gameId))).toBe(true);
    expect(snapshot.playerGameStats.every((line) => gameIds.has(line.gameId) && playerIds.has(line.playerId))).toBe(true);
    expect(snapshot.goalieGameStats.every((line) => gameIds.has(line.gameId) && playerIds.has(line.playerId))).toBe(true);
    expect(snapshot.gameEvents.every((event) => gameIds.has(event.gameId)
      && (!event.primaryPlayerId || playerIds.has(event.primaryPlayerId))
      && (!event.secondaryPlayerId || playerIds.has(event.secondaryPlayerId)))).toBe(true);
    expect(gameIds.size).toBe(snapshot.games.length);
  });

  it('contains the complete verified game-sheet import without fabricated box-score fields', () => {
    expect(snapshot.detailImport).toEqual({ requestedGames: 278, importedGames: 278, errors: [] });
    expect(snapshot.teamGameStats).toHaveLength(274);
    expect(snapshot.playerGameStats).toHaveLength(3376);
    expect(snapshot.goalieGameStats).toHaveLength(277);
    expect(snapshot.gameEvents).toHaveLength(2734);
    expect(snapshot.playerGameStats.some((line) => line.shots === null && line.plusMinus === null)).toBe(true);
    expect(snapshot.teamGameStats.some((line) => line.powerPlayGoals === null && line.faceoffWins === null)).toBe(true);
  });

  it('matches the two official Summer 2026 team records at capture time', () => {
    const monThu = statsSnapshot(snapshot, 'summer-2026', 'summer-2026-mon-thu');
    const sunday = statsSnapshot(snapshot, 'summer-2026', 'summer-2026-sunday');
    expect(monThu.summary).toMatchObject({ gamesPlayed: 10, wins: 0, losses: 10, ties: 0, points: 0 });
    expect(sunday.summary).toMatchObject({ gamesPlayed: 11, wins: 3, losses: 6, ties: 2, points: 8 });
    expect(monThu.scheduleComplete).toBe(true);
    expect(sunday.scheduleComplete).toBe(true);
  });

  it('preserves every official league schedule as a separate source identity', () => {
    const externalIds = snapshot.teams.map((team) => team.externalId);
    expect(new Set(externalIds).size).toBe(snapshot.teams.length);
    expect(snapshot.teams.every((team) => team.scheduleLabel && team.division && team.sourceUrl)).toBe(true);
    expect(snapshot.seasons.every((season) => snapshot.teams.some((team) => team.seasonId === season.id))).toBe(true);
    expect(snapshot.teams.every((team) => snapshot.games.some((game) => game.seasonTeamId === team.id))).toBe(true);
  });

  it('offers one Summer 2026 view without merging the Sunday and weekday schedules', () => {
    const combined = statsSnapshot(snapshot, 'summer-2026', ALL_SEASON_TEAMS_ID);
    expect(combined.seasonSchedules.map((schedule) => schedule.team.id)).toEqual([
      'summer-2026-mon-thu',
      'summer-2026-sunday',
    ]);
    expect(combined.seasonSchedules.map((schedule) => schedule.label)).toEqual([
      'Monday / Thursday League',
      'Sunday League',
    ]);
    expect(combined.games).toHaveLength(24);
    expect(combined.summary).toMatchObject({ gamesPlayed: 21, wins: 3, losses: 16, ties: 2, points: 8 });
    expect(combined.scheduleComplete).toBe(true);
  });

  it('builds a source-linked page context for every imported game', () => {
    const pageContexts = snapshot.teams.flatMap((team) => {
      const teamSnapshot = statsSnapshot(snapshot, team.seasonId, team.id, 'all');
      return teamSnapshot.games.map((game) => ({
        game,
        details: teamSnapshot.gameDetails[game.id],
      }));
    });

    expect(pageContexts).toHaveLength(snapshot.games.length);
    expect(pageContexts.every(({ game, details }) => game.sourceUrl
      && details
      && details.schedule?.id === game.seasonTeamId
      && Array.isArray(details.players)
      && Array.isArray(details.goalies)
      && Array.isArray(details.events))).toBe(true);
  });

  it('labels playoff data independently from regular-season data', () => {
    const team = snapshot.teams.find((item) => snapshot.games.some((game) => game.seasonTeamId === item.id && game.stage === 'playoffs'));
    expect(team).toBeTruthy();
    const regular = statsSnapshot(snapshot, team.seasonId, team.id, 'regular');
    const playoffs = statsSnapshot(snapshot, team.seasonId, team.id, 'playoffs');
    expect(regular.games.every((game) => game.stage === 'regular')).toBe(true);
    expect(playoffs.games.length).toBeGreaterThan(0);
    expect(playoffs.games.every((game) => game.stage === 'playoffs')).toBe(true);
  });
});
