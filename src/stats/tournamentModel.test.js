import { describe, expect, it } from 'vitest';
import {
  TOURNAMENT_ARCHIVE,
  parseTournamentVideo,
  sortedTournamentStandings,
  tournamentBracketRounds,
  tournamentSummary,
} from './tournamentModel';

describe('tournament archive model', () => {
  it('parses a tournament game video without confusing the opponent or camera angle', () => {
    expect(parseTournamentVideo({
      sourceTitle: 'Goonsquad vs Brown Royal (Away View) - Game 1 | 2026 Oshawa Provincials',
      linkUrl: 'https://www.youtube.com/watch?v=example',
      sourceImageUrl: 'https://i.ytimg.com/vi/example/maxresdefault.jpg',
      sourceMetadata: { videoId: 'example' },
      sourcePublishedAt: '2026-05-22T12:00:00.000Z',
    })).toMatchObject({
      opponent: 'Brown Royal',
      angle: 'away',
      gameNumber: 1,
      tournamentName: '2026 Oshawa Provincials',
      videoId: 'example',
    });
  });

  it('enriches the verified Oshawa dossier with all three games and six camera angles', () => {
    const tournament = TOURNAMENT_ARCHIVE.find((item) => item.id === '2026-oshawa-provincials');
    const summary = tournamentSummary(tournament);

    expect(tournament).toBeTruthy();
    expect(tournament.games).toHaveLength(3);
    expect(tournament.games.map((game) => game.opponent)).toEqual([
      'Brown Royal',
      'Brampton All Blacks',
      'Vaughan Knights',
    ]);
    expect(tournament.games.every((game) => game.media.length === 2)).toBe(true);
    expect(summary).toMatchObject({
      documentedGames: 3,
      scoredGames: 0,
      opponents: 3,
      videoAngles: 6,
      record: 'Archive pending',
    });
  });

  it('preserves the official 2024 pool schedule and tournament-format bracket', () => {
    const tournament = TOURNAMENT_ARCHIVE.find((item) => item.id === '2024-mississauga-provincials');

    expect(tournament).toBeTruthy();
    expect(tournament.division).toBe("Men's REC");
    expect(tournament.games.map((game) => [game.opponent, game.date, game.time])).toEqual([
      ['Blades of Steel', '2024-08-23', '20:00'],
      ['Spartans', '2024-08-24', '12:00'],
      ['Cambridge Thunder', '2024-08-24', '16:15'],
    ]);
    expect(tournamentBracketRounds(tournament.bracket).map((round) => round.id))
      .toEqual(['semifinal', 'final']);
    expect(tournamentSummary(tournament).documentedGames).toBe(3);
  });

  it('sorts a pool table by points, goal difference, then goals scored', () => {
    const standings = sortedTournamentStandings([
      { team: 'B', points: 4, goalsFor: 4, goalsAgainst: 2 },
      { team: 'C', points: 4, goalsFor: 6, goalsAgainst: 4 },
      { team: 'A', points: 6, goalsFor: 5, goalsAgainst: 1 },
    ]);

    expect(standings.map((row) => `${row.rank}:${row.team}`)).toEqual(['1:A', '2:C', '3:B']);
  });

  it('groups bracket matches into ordered rounds and ordered games', () => {
    const rounds = tournamentBracketRounds([
      { id: 'sf-2', roundId: 'semifinal', roundName: 'Semifinal', roundOrder: 2, order: 2 },
      { id: 'qf-1', roundId: 'quarterfinal', roundName: 'Quarterfinal', roundOrder: 1, order: 1 },
      { id: 'sf-1', roundId: 'semifinal', roundName: 'Semifinal', roundOrder: 2, order: 1 },
    ]);

    expect(rounds.map((round) => round.id)).toEqual(['quarterfinal', 'semifinal']);
    expect(rounds[1].matches.map((match) => match.id)).toEqual(['sf-1', 'sf-2']);
  });
});
