import { describe, expect, it } from 'vitest';
import {
  buildOpponentMatchups,
  canonicalOpponentName,
  findOpponentMatchup,
  gameOutcome,
  opponentSlug,
} from './opponentModel';
import { OFFICIAL_STATS_DATASET } from './statsSeed';

const dataset = {
  seasons: [
    { id: 's2', name: 'Summer 2026' },
    { id: 's1', name: 'Spring 2026' },
  ],
  teams: [
    { id: 'sun', seasonId: 's2', scheduleLabel: 'SUNDAY', division: 'SUNDAY TIER 5', leagueKey: 'york-central', leagueName: 'York Central Ball Hockey League' },
    { id: 'mon', seasonId: 's1', scheduleLabel: 'MON/THU', division: 'MON/THU TIER 5', leagueKey: 'york-central', leagueName: 'York Central Ball Hockey League' },
  ],
  games: [
    { id: 'future', seasonTeamId: 'sun', opponent: 'RED WOLVES', status: 'scheduled', scheduledAt: '2026-08-02T18:00:00', venue: 'home' },
    { id: 'latest', seasonTeamId: 'sun', opponent: 'RED WOLVES', status: 'final', scheduledAt: '2026-07-20T18:00:00', goalsFor: 4, goalsAgainst: 2 },
    { id: 'seeded', seasonTeamId: 'mon', opponent: 'RED WOLVES (3rd)', status: 'final', stage: 'playoffs', scheduledAt: '2026-04-20T18:00:00', goalsFor: 1, goalsAgainst: 3 },
    { id: 'other', seasonTeamId: 'sun', opponent: 'VIPERZ', status: 'final', scheduledAt: '2026-07-10T18:00:00', goalsFor: 2, goalsAgainst: 2 },
    { id: 'viperz-pending', seasonTeamId: 'sun', opponent: 'OG VIPERZ', status: 'scheduled', scheduledAt: '2026-07-26T19:00:00' },
  ],
};

describe('opponent matchup model', () => {
  it('consolidates playoff seed labels into one stable opponent identity', () => {
    expect(canonicalOpponentName('RED WOLVES (3rd)')).toBe('RED WOLVES');
    expect(opponentSlug('RED WOLVES (3rd)')).toBe('red-wolves');

    const matchups = buildOpponentMatchups(dataset, new Date('2026-07-29T12:00:00'));
    const redWolves = findOpponentMatchup(matchups, 'red-wolves');
    expect(matchups).toHaveLength(2);
    expect(redWolves.games.map((game) => game.id)).toEqual(['future', 'latest', 'seeded']);
    expect(redWolves.summary).toMatchObject({
      gamesPlayed: 2,
      wins: 1,
      losses: 1,
      ties: 0,
      goalsFor: 5,
      goalsAgainst: 5,
    });
  });

  it('keeps verified results separate from future fixtures and builds season splits', () => {
    const matchup = findOpponentMatchup(
      buildOpponentMatchups(dataset, new Date('2026-07-29T12:00:00')),
      'RED WOLVES',
    );
    expect(matchup.nextGame.id).toBe('future');
    expect(matchup.lastGame.id).toBe('latest');
    expect(matchup.seasons.map((season) => season.seasonName)).toEqual(['Summer 2026', 'Spring 2026']);
    expect(matchup.seasons[0].scheduleNames).toEqual(['YCBHL · Sunday Tier 5 League']);
    expect(matchup.recentForm.map((item) => item.outcome)).toEqual(['win', 'loss']);
  });

  it('keeps same-name opponents separate when one league schedule is selected', () => {
    const sunday = findOpponentMatchup(
      buildOpponentMatchups(dataset, new Date('2026-07-29T12:00:00'), {
        seasonTeamIds: ['sun'],
        scopeLabel: 'Summer 2026 · Sunday League',
      }),
      'RED WOLVES',
    );
    const weekday = findOpponentMatchup(
      buildOpponentMatchups(dataset, new Date('2026-07-29T12:00:00'), {
        seasonTeamIds: ['mon'],
        scopeLabel: 'Spring 2026 · Monday League',
      }),
      'RED WOLVES',
    );

    expect(sunday.games.map((game) => game.id)).toEqual(['future', 'latest']);
    expect(sunday.summary).toMatchObject({ gamesPlayed: 1, wins: 1, losses: 0 });
    expect(sunday.scopeLabel).toBe('Summer 2026 · Sunday League');
    expect(weekday.games.map((game) => game.id)).toEqual(['seeded']);
    expect(weekday.summary).toMatchObject({ gamesPlayed: 1, wins: 0, losses: 1 });
  });

  it('labels only completed scorelines as outcomes', () => {
    expect(gameOutcome(dataset.games[0])).toBe('scheduled');
    expect(gameOutcome(dataset.games[1])).toBe('win');
    expect(gameOutcome(dataset.games[2])).toBe('loss');
    expect(gameOutcome(dataset.games[3])).toBe('tie');
  });

  it('unifies the verified Viperz aliases and preserves elapsed fixtures awaiting results', () => {
    expect(canonicalOpponentName('OG VIPERZ (2nd)')).toBe('VIPERZ');
    expect(opponentSlug('OG VIPERZ')).toBe('viperz');

    const matchup = findOpponentMatchup(
      buildOpponentMatchups(dataset, new Date('2026-07-29T12:00:00')),
      'VIPERZ',
    );

    expect(matchup.games.map((game) => game.id)).toEqual(['viperz-pending', 'other']);
    expect(matchup.awaitingResults.map((game) => game.id)).toEqual(['viperz-pending']);
    expect(matchup.recentMeetings.map((game) => game.id)).toEqual(['viperz-pending', 'other']);
    expect(matchup.summary.gamesPlayed).toBe(1);
  });

  it('indexes every verified archive game under one unique opponent page', () => {
    const matchups = buildOpponentMatchups(OFFICIAL_STATS_DATASET, new Date('2000-01-01T00:00:00'));
    const indexedGames = matchups.flatMap((matchup) => matchup.games);
    expect(indexedGames).toHaveLength(OFFICIAL_STATS_DATASET.games.length);
    expect(new Set(matchups.map((matchup) => matchup.slug)).size).toBe(matchups.length);
    expect(matchups.every((matchup) => matchup.name && matchup.slug && matchup.seasons.length)).toBe(true);
    expect(findOpponentMatchup(matchups, 'RED WOLVES (3rd)')?.games.some((game) => game.opponent === 'RED WOLVES')).toBe(true);
  });

  it('keeps the verified July 26 Sunday win and July 30 Monday result in the consolidated Viperz history', () => {
    const matchup = findOpponentMatchup(
      buildOpponentMatchups(OFFICIAL_STATS_DATASET, new Date('2026-07-30T22:00:00-04:00')),
      'VIPERZ',
    );
    const sundayWin = matchup.finalGames.find((game) => game.id === 'ycbhl-game-53117');

    expect(sundayWin).toMatchObject({
      opponent: 'OG VIPERZ',
      scheduledAt: '2026-07-26T19:00:00',
      status: 'final',
      goalsFor: 9,
      goalsAgainst: 4,
    });
    expect(matchup.nextGame).toBeNull();
    expect(matchup.summary).toMatchObject({
      gamesPlayed: 36,
      wins: 4,
      losses: 32,
      ties: 0,
      goalsFor: 98,
      goalsAgainst: 266,
    });
  });

  it('separates the current Sunday and Monday League Viperz records', () => {
    const sunday = findOpponentMatchup(
      buildOpponentMatchups(OFFICIAL_STATS_DATASET, new Date('2026-07-30T22:00:00-04:00'), {
        seasonTeamIds: ['summer-2026-sunday'],
        scopeLabel: 'Summer 2026 · Sunday League',
      }),
      'VIPERZ',
    );
    const weekday = findOpponentMatchup(
      buildOpponentMatchups(OFFICIAL_STATS_DATASET, new Date('2026-07-30T22:00:00-04:00'), {
        seasonTeamIds: ['summer-2026-mon-thu'],
        scopeLabel: 'Summer 2026 · Monday League',
      }),
      'VIPERZ',
    );

    expect(sunday.summary).toMatchObject({
      gamesPlayed: 3,
      wins: 1,
      losses: 2,
      goalsFor: 10,
      goalsAgainst: 19,
    });
    expect(weekday.summary).toMatchObject({
      gamesPlayed: 2,
      wins: 0,
      losses: 2,
      goalsFor: 1,
      goalsAgainst: 12,
    });
    expect(weekday.nextGame).toBeNull();
  });
});
