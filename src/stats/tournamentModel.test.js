import { describe, expect, it } from 'vitest';
import {
  TOURNAMENT_ARCHIVE,
  mergeTournamentRecords,
  normalizeTournamentDisplay,
  parseTournamentVideo,
  sortedTournamentStandings,
  tournamentBracketRounds,
  tournamentBracketTree,
  tournamentEventGames,
  tournamentForPersistence,
  tournamentGameById,
  isTournamentEntrantName,
  tournamentPoolStandings,
  tournamentTeams,
  tournamentSummary,
} from './tournamentModel';

describe('tournament archive model', () => {
  it('maps the complete 2026 Mississauga schedule, pools, and seeded elimination path', () => {
    const tournament = TOURNAMENT_ARCHIVE.find((item) => item.id === '2026-mississauga-provincials');
    const eventGames = tournamentEventGames(tournament);
    const rounds = tournamentBracketRounds(tournament.bracket);

    expect(tournament).toBeTruthy();
    expect(tournament.status).toBe('scheduled');
    expect(tournament.startDate).toBe('2026-08-21');
    expect(tournament.endDate).toBe('2026-08-23');
    expect(tournament.games).toEqual([
      expect.objectContaining({ officialGameNumber: 43, opponent: 'Cambridge', time: '17:00', site: 'Home' }),
      expect.objectContaining({ officialGameNumber: 46, opponent: 'Sudbury Silly Gooses', time: '20:00', site: 'Away' }),
    ]);
    expect(tournament.games.every((game) => game.status === 'scheduled' && game.scoreFor === null && game.scoreAgainst === null)).toBe(true);

    expect(new Set(tournament.pools.flatMap((pool) => pool.teams))).toHaveLength(9);
    expect(tournament.pools.map((pool) => [pool.name, pool.teams])).toEqual([
      ['Pool A', ['Balls of Glory', 'Moosehead', 'Dirty Birds']],
      ['Pool B', ['Goonsquad', 'Cambridge', 'Sudbury Silly Gooses']],
      ['Pool C', ['High Park Highlanders', 'Sarabha', 'Mitt Magicians']],
    ]);
    expect(tournament.teams.map((team) => team.name)).toEqual([
      'Goonsquad',
      'Cambridge',
      'Sudbury Silly Gooses',
      'Balls of Glory',
      'Moosehead',
      'Dirty Birds',
      'High Park Highlanders',
      'Sarabha',
      'Mitt Magicians',
    ]);

    expect(eventGames).toHaveLength(17);
    expect(eventGames.map((game) => game.officialGameNumber)).toEqual([
      42, 43, 44, 45, 46, 47, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58,
    ]);
    expect(eventGames.filter((game) => game.stage === 'round-robin')).toHaveLength(9);
    expect(eventGames.filter((game) => game.stage === 'elimination')).toHaveLength(1);
    expect(eventGames.filter((game) => game.stage === 'quarterfinal')).toHaveLength(4);
    expect(eventGames.filter((game) => game.stage === 'semifinal')).toHaveLength(2);
    expect(eventGames.filter((game) => game.stage === 'final')).toHaveLength(1);
    expect(eventGames.every((game) => game.status === 'scheduled')).toBe(true);

    expect(rounds.map((round) => [round.id, round.matches.length])).toEqual([
      ['quarterfinal', 4],
      ['semifinal', 2],
      ['final', 1],
    ]);
    expect(rounds[0].matches.map((match) => match.eventGameId)).toEqual([
      '2026-mississauga-official-52',
      '2026-mississauga-official-55',
      '2026-mississauga-official-53',
      '2026-mississauga-official-54',
    ]);
    expect(rounds[1].matches.map((match) => [match.homeTeam.name, match.awayTeam.name])).toEqual([
      ['Winner Game 55', 'Winner Game 52'],
      ['Winner Game 54', 'Winner Game 53'],
    ]);
  });

  it('derives an editable tournament field from legacy game opponents', () => {
    expect(tournamentTeams({
      teamName: 'Goonsquad',
      games: [
        { opponent: 'Brown Royal' },
        { opponent: 'Brampton All Blacks' },
        { opponent: 'Brown Royal' },
      ],
    })).toEqual([
      expect.objectContaining({ name: 'Goonsquad', isGoonSquad: true }),
      expect.objectContaining({ name: 'Brown Royal', isGoonSquad: false }),
      expect.objectContaining({ name: 'Brampton All Blacks', isGoonSquad: false }),
    ]);
  });

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

  it('builds the complete official Oshawa run and keeps team videos on the matching games', () => {
    const tournament = TOURNAMENT_ARCHIVE.find((item) => item.id === '2026-oshawa-provincials');
    const summary = tournamentSummary(tournament);

    expect(tournament).toBeTruthy();
    expect(tournament.dataStatus).toBe('verified');
    expect(tournament.finish).toBe('Semifinalist');
    expect(tournament.source).toMatchObject({ seasonId: '14928', teamId: '514449' });
    expect(tournament.games).toHaveLength(5);
    expect(tournament.games.map((game) => game.opponent)).toEqual([
      'Brown Royal',
      'Brampton All Blacks',
      'Vaughan Knights',
      'Toronto Jets',
      'New Tecumseth Outlaws',
    ]);
    expect(tournament.games.map((game) => game.officialGameNumber)).toEqual([29, 37, 43, 49, 53]);
    expect(tournament.games.map((game) => [game.scoreFor, game.scoreAgainst])).toEqual([
      [7, 3],
      [8, 1],
      [3, 2],
      [4, 0],
      [1, 6],
    ]);
    expect(tournament.games.slice(0, 3).every((game) => game.media.length === 2)).toBe(true);
    expect(tournament.games.slice(3).every((game) => game.media.length === 0)).toBe(true);
    expect(tournament.standings[0]).toMatchObject({ team: 'Goonsquad', rank: 1, points: 6 });
    expect(tournament.playerStats[0]).toMatchObject({ number: 17, goals: 9, assists: 7, points: 16 });
    expect(summary).toMatchObject({
      documentedGames: 5,
      scoredGames: 5,
      opponents: 5,
      videoAngles: 6,
      record: '4-1-0',
      goalsFor: 23,
      goalsAgainst: 12,
      goalDifferential: 11,
      poolFinish: 1,
      poolRecord: '3-0-0',
    });
    const eventGames = tournamentEventGames(tournament);
    expect(eventGames).toHaveLength(28);
    expect(eventGames.filter((game) => game.stage === 'round-robin')).toHaveLength(21);
    expect(eventGames.filter((game) => game.stage === 'quarterfinal')).toHaveLength(4);
    expect(eventGames.filter((game) => game.stage === 'semifinal')).toHaveLength(2);
    expect(eventGames.filter((game) => game.stage === 'final')).toHaveLength(1);
    expect(tournamentGameById(tournament, '2026-oshawa-official-53')).toMatchObject({
      stage: 'semifinal',
      awayTeam: 'New Tecumseth Outlaws',
      awayScore: 6,
      homeTeam: 'Goonsquad',
      homeScore: 1,
      details: {
        gameId: '2883393',
        officialGameNumber: 53,
      },
    });
    expect(tournamentGameById(tournament, '2026-oshawa-official-54')).toMatchObject({
      stage: 'final',
      awayTeam: 'New Tecumseth Outlaws',
      awayScore: 6,
      homeTeam: 'Canadian Brew Crew',
      homeScore: 4,
    });
    expect(tournamentPoolStandings(tournament, 'pool-d')[0]).toMatchObject({
      rank: 1,
      team: 'Goonsquad',
      gamesPlayed: 3,
      wins: 3,
      losses: 0,
      points: 6,
      goalsFor: 18,
      goalsAgainst: 6,
    });
    const bracketRounds = tournamentBracketRounds(tournament.bracket);
    expect(bracketRounds.map((round) => round.id)).toEqual(['quarterfinal', 'semifinal', 'final']);
    expect(bracketRounds.map((round) => round.matches.length)).toEqual([4, 2, 1]);
    expect(eventGames.every((game) => game.details)).toBe(true);
    expect(eventGames.reduce((total, game) => total + game.details.goals.length, 0)).toBe(209);
    expect(eventGames.reduce((total, game) => total + game.details.penalties.length, 0)).toBe(134);
    eventGames.forEach((game) => {
      expect(game.details.goals).toHaveLength(game.awayScore + game.homeScore);
      expect(game.details.score.away.final).toBe(game.awayScore);
      expect(game.details.score.home.final).toBe(game.homeScore);
    });
  });

  it('preserves every official 2024 score, pool table, and elimination result', () => {
    const tournament = TOURNAMENT_ARCHIVE.find((item) => item.id === '2024-mississauga-provincials');

    expect(tournament).toBeTruthy();
    expect(tournament.division).toBe("Men's REC");
    expect(tournament.dataStatus).toBe('verified');
    expect(tournament.games.map((game) => [game.opponent, game.scoreFor, game.scoreAgainst])).toEqual([
      ['Blades of Steel', 1, 8],
      ['Spartans', 2, 9],
      ['Cambridge Thunder', 1, 7],
    ]);
    expect(tournamentBracketRounds(tournament.bracket).map((round) => round.id))
      .toEqual(['semifinal', 'final']);
    expect(tournamentEventGames(tournament)).toHaveLength(15);
    expect(tournamentEventGames(tournament).filter((game) => game.stage === 'round-robin')).toHaveLength(12);
    expect(tournamentEventGames(tournament).every((game) => game.status === 'final')).toBe(true);
    expect(tournamentPoolStandings(tournament, 'pool-a').map((row) => [row.team, row.points])).toEqual([
      ['Cambridge Thunder', 6],
      ['Blades of Steel', 4],
      ['Spartans', 2],
      ['Goonsquad', 0],
    ]);
    expect(tournamentPoolStandings(tournament, 'pool-b').map((row) => [row.team, row.points])).toEqual([
      ['Moosehead', 6],
      ['Woodstock Toros', 4],
      ['Hamilton Rockies', 2],
      ['Landsharks', 0],
    ]);
    expect(tournamentGameById(tournament, '2024-mississauga-final')).toMatchObject({
      stage: 'final',
      awayTeam: 'Blades of Steel',
      awayScore: 1,
      homeTeam: 'Cambridge Thunder',
      homeScore: 0,
    });
    expect(tournamentSummary(tournament)).toMatchObject({
      documentedGames: 3,
      scoredGames: 3,
      record: '0-3-0',
      goalsFor: 4,
      goalsAgainst: 24,
    });
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

  it('keeps bracket seed instructions out of the registered tournament field', () => {
    const tournament = {
      id: 'future-event',
      name: 'Future event',
      teamName: 'Goonsquad',
      teams: [{ name: 'Cambridge' }, { name: '8th Overall' }],
      eventGames: [
        { awayTeam: 'Sudbury Silly Gooses', homeTeam: '9th Overall' },
        { awayTeam: 'Winner Game 51', homeTeam: '1st PW Overall' },
      ],
      bracket: [
        { awayTeam: { name: 'Winner Game 56' }, homeTeam: { name: 'Winner Game 57' } },
      ],
    };
    const teams = tournamentTeams(tournament);

    expect(teams.map((team) => team.name)).toEqual([
      'Goonsquad',
      'Cambridge',
      'Sudbury Silly Gooses',
    ]);
    expect([
      '8th Overall',
      '3rd PW Overall',
      'Winner Game 51',
      'Loser Game 52',
      'TBD',
      'Pool A winner',
    ].every((name) => !isTournamentEntrantName(name))).toBe(true);
    expect(tournamentForPersistence(tournament).teams.map((team) => team.name)).toEqual([
      'Goonsquad',
      'Cambridge',
      'Sudbury Silly Gooses',
    ]);
  });

  it('keeps every published tournament field limited to named entrants', () => {
    TOURNAMENT_ARCHIVE.forEach((tournament) => {
      expect(
        tournament.teams.every((team) => isTournamentEntrantName(team.name)),
        `${tournament.id} contains a bracket instruction in its team field`,
      ).toBe(true);
    });
  });

  it('orders every elimination round by the winners that feed the next matchup', () => {
    const tournament = TOURNAMENT_ARCHIVE.find((item) => item.id === '2026-oshawa-provincials');
    const rounds = tournamentBracketTree(tournament.bracket);

    expect(rounds[0].matches.map((match) => match.id)).toEqual([
      '2026-oshawa-qf-3',
      '2026-oshawa-qf-2',
      '2026-oshawa-qf-4',
      '2026-oshawa-qf-1',
    ]);
    expect(rounds[1].matches.map((match) => match.id)).toEqual([
      '2026-oshawa-sf-2',
      '2026-oshawa-sf-1',
    ]);
    expect(rounds[2].matches.map((match) => match.id)).toEqual(['2026-oshawa-final']);
  });

  it('normalizes event-specific display controls and hides disabled brackets', () => {
    expect(normalizeTournamentDisplay({
      layout: 'scoreboard',
      accent: 'gold',
      bracketMode: 'hidden',
      showBracket: true,
      gamesLabel: 'Matchups',
    })).toMatchObject({
      layout: 'scoreboard',
      accent: 'gold',
      bracketMode: 'hidden',
      showBracket: false,
      showStats: true,
      statsLabel: 'Stats',
      gamesLabel: 'Matchups',
    });
  });

  it('merges published overrides, suppresses hidden seed dossiers, and includes drafts for admins', () => {
    const seed = [{
      id: 'seed-event',
      name: 'Seed event',
      games: [],
      standings: [],
      bracket: [],
    }];
    const published = mergeTournamentRecords(seed, [{
      id: 'seed-event',
      isPublished: true,
      payload: { id: 'seed-event', name: 'Edited event', games: [], standings: [], bracket: [] },
    }], { activities: [] });
    const hidden = mergeTournamentRecords(seed, [{
      id: 'seed-event',
      isPublished: false,
      payload: null,
    }], { activities: [] });
    const admin = mergeTournamentRecords(seed, [{
      id: 'seed-event',
      isPublished: false,
      payload: { id: 'seed-event', name: 'Private draft', games: [], standings: [], bracket: [] },
    }], { activities: [], includeDrafts: true });

    expect(published[0].name).toBe('Edited event');
    expect(hidden).toEqual([]);
    expect(admin[0]).toMatchObject({ name: 'Private draft', _record: { isPublished: false } });
  });

  it('refreshes a stale manual dossier to the current source-backed experience', () => {
    const snapshot = { provider: 'GameSheet', capturedAt: '2026-07-31', seasonId: '1' };
    const merged = mergeTournamentRecords([{
      id: 'official-event',
      name: 'Official event',
      dataStatus: 'verified',
      source: { ...snapshot, revision: 2 },
      games: [{ id: 'official-game', scoreFor: 7, scoreAgainst: 3 }],
      standings: [{ team: 'Goonsquad', points: 8 }],
      bracket: [],
      display: { gamesLabel: 'Gamebook', accent: 'red' },
    }], [{
      id: 'official-event',
      isPublished: true,
      payload: {
        id: 'official-event',
        name: 'Old manual event',
        source: snapshot,
        games: [{ id: 'manual-game', scoreFor: null, scoreAgainst: null }],
        standings: [],
        bracket: [],
        display: { gamesLabel: 'Matchups', accent: 'gold' },
      },
    }], { activities: [] });

    expect(merged[0]).toMatchObject({
      name: 'Official event',
      dataStatus: 'verified',
      display: { gamesLabel: 'Gamebook', accent: 'red' },
      _record: { hasOverride: true, sourceRefreshRequired: true },
    });
    expect(merged[0].games[0]).toMatchObject({ id: 'official-game', scoreFor: 7, scoreAgainst: 3 });
    expect(merged[0].standings[0]).toMatchObject({ team: 'Goonsquad', points: 8 });
  });

  it('keeps admin fact overrides after they are saved against the current source snapshot', () => {
    const source = { provider: 'GameSheet', capturedAt: '2026-07-31', seasonId: '1' };
    const merged = mergeTournamentRecords([{
      id: 'official-event',
      name: 'Official event',
      source,
      games: [{ id: 'game', scoreFor: 7, scoreAgainst: 3 }],
      standings: [],
      bracket: [],
    }], [{
      id: 'official-event',
      isPublished: true,
      payload: {
        id: 'official-event',
        name: 'Admin corrected event',
        source,
        games: [{ id: 'game', scoreFor: 8, scoreAgainst: 3 }],
        standings: [],
        bracket: [],
      },
    }], { activities: [] });

    expect(merged[0]).toMatchObject({
      name: 'Admin corrected event',
      _record: { sourceRefreshRequired: false },
    });
    expect(merged[0].games[0].scoreFor).toBe(8);
  });

  it('removes runtime video enrichment before persisting an admin edit', () => {
    const payload = tournamentForPersistence({
      id: 'event',
      name: 'Event',
      games: [{ id: 'game', media: [{ videoId: 'runtime-only' }] }],
      eventGames: [{ id: 'event-game', media: [{ videoId: 'runtime-only' }] }],
      standings: [],
      bracket: [],
      _record: { isSeed: true },
    });

    expect(payload).not.toHaveProperty('_record');
    expect(payload.games[0]).not.toHaveProperty('media');
    expect(payload.eventGames[0]).not.toHaveProperty('media');
  });
});
