import { renderToStaticMarkup } from 'react-dom/server';
import { load } from 'cheerio';
import { describe, expect, it, vi } from 'vitest';
import PlayerName from './PlayerName';
import PlayerProfilePage from './PlayerProfilePage';
import { PlayerDirectory, PlayerTables } from './StatsWorkspace';

vi.mock('./PlayerSpotlight3D', () => ({ default: () => null }));

const players = [
  { id: 'field-zero', displayName: 'Zero Field', jerseyNumber: 0 },
  { id: 'field-27', displayName: 'Numbered Field', jerseyNumber: '27' },
  { id: 'field-none', displayName: 'Unassigned Field', jerseyNumber: null },
];

function fixtureDataset() {
  return {
    seasons: [{ id: 'current', name: 'Summer 2026', current: true }],
    teams: [{ id: 'team', seasonId: 'current', name: 'Monday Team' }],
    players,
    memberships: players.map((player) => ({
      playerId: player.id,
      seasonTeamId: 'team',
      jerseyNumber: player.jerseyNumber,
      position: 'C',
    })),
  };
}

function profileFor(jerseyNumber) {
  return {
    primaryPlayer: { id: 'player', displayName: 'Sam Member' },
    jerseyNumber,
    position: 'C',
    currentTeams: [],
    seasonsPlayed: 0,
    careerField: { gamesPlayed: 0, powerPlayGoals: 0 },
    careerGoalie: { gamesPlayed: 0 },
    seasonHistory: [],
    recentGames: [],
  };
}

describe('player number display', () => {
  it.each([0, '0', 27, '27'])('shows assigned number %s beside the name', (jerseyNumber) => {
    const $ = load(renderToStaticMarkup(<PlayerName displayName="Sam Member" jerseyNumber={jerseyNumber} />));
    expect($('body').text().trim()).toBe(`Sam Member #${jerseyNumber}`);
    expect($('.player-jersey-number').attr('title')).toBe(`Player number ${jerseyNumber}`);
  });

  it.each([null, undefined, '', '  '])('leaves unassigned number %s blank', (jerseyNumber) => {
    const $ = load(renderToStaticMarkup(<PlayerName displayName="Sam Member" jerseyNumber={jerseyNumber} />));
    expect($('body').text()).toBe('Sam Member');
    expect($('.player-jersey-number')).toHaveLength(0);
  });

  it('renders numbers in both field-player and goalie season tables', () => {
    const fieldPlayers = players.map((player) => ({
      ...player,
      playerId: player.id,
      gamesPlayed: 1,
      goals: 1,
      assists: 1,
      points: 2,
      pointsPerGame: 2,
    }));
    const goalies = [{
      playerId: 'goalie-zero', displayName: 'Zero Goalie', jerseyNumber: 0,
      gamesPlayed: 1, wins: 1, losses: 0, ties: 0, shotsAgainst: 20,
      goalsAgainst: 1, savePercentage: 0.95, goalsAgainstAverage: 1, shutouts: 0,
    }];
    const $ = load(renderToStaticMarkup(<PlayerTables fieldPlayers={fieldPlayers} goalies={goalies} onOpenPlayer={() => {}} />));
    const names = $('.stats-player-link').map((_, item) => $(item).text().trim()).get();
    expect(names).toEqual(['Zero Field #0', 'Numbered Field #27', 'Unassigned Field', 'Zero Goalie #0']);
  });

  it('shows zero and assigned numbers beside directory names without inventing an unassigned number', () => {
    const $ = load(renderToStaticMarkup(<PlayerDirectory dataset={fixtureDataset()} onOpenPlayer={() => {}} />));
    const numbers = Object.fromEntries($('.stats-player-directory-grid > button').map((_, item) => [[
      $(item).find('strong').text(),
      $(item).find('.stats-player-directory-number').text().trim(),
    ]]).get());
    expect(numbers).toEqual({ 'Zero Field': '#0', 'Numbered Field': '#27', 'Unassigned Field': 'U' });
  });

  it.each([0, '27', null])('includes number %s in the individual page heading only when assigned', (jerseyNumber) => {
    const $ = load(renderToStaticMarkup(<PlayerProfilePage profile={profileFor(jerseyNumber)} />));
    expect($('h1').text().trim()).toBe(jerseyNumber === null ? 'Sam Member' : `Sam Member #${jerseyNumber}`);
    expect($('.public-player-identity > p').text()).not.toContain('#');
  });
});
