import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  currentSeasonNameFromHistory,
  divisionStandings,
  mergeCurrentSeasonSnapshot,
  parseSchedule,
  resolveTeamIdentities,
} from '../../scripts/sync-york-central-stats.mjs';

const syncWorkflow = readFileSync(
  new URL('../../.github/workflows/sync-team-statistics.yml', import.meta.url),
  'utf8',
);

function snapshot(overrides = {}) {
  return {
    source: 'league-snapshot',
    sourceName: 'York Central Ball Hockey League',
    sourceUrl: 'https://www.yorkcentralbhl.com/team/7250-goonsquad',
    capturedAt: '2026-07-29T14:00:00.000Z',
    seasons: [],
    teams: [],
    players: [],
    memberships: [],
    games: [],
    teamGameStats: [],
    playerGameStats: [],
    goalieGameStats: [],
    gameEvents: [],
    teamSeasonSummaries: [],
    standings: [],
    playerSeasonStats: [],
    goalieSeasonStats: [],
    detailImport: { requestedGames: 0, importedGames: 0, errors: [] },
    ...overrides,
  };
}

describe('current-season statistics sync', () => {
  it('checks every active official schedule every 30 minutes', () => {
    expect(syncWorkflow).toContain("cron: '*/30 * * * *'");
    expect(syncWorkflow).toContain('npm run stats:sync:york-central');
    expect(syncWorkflow).toContain('STATS_SYNC_SCOPE: current');
  });

  it('keeps Thursday make-up games inside the Monday schedule import', () => {
    const html = `
      <table class="statistic">
        <tr>
          <th>Date</th><th>Time</th><th>Home team</th><th>Score</th>
          <th>Away team</th><th>Score</th><th>Location</th><th>Status</th><th></th>
        </tr>
        <tr>
          <td class="date">Mon Jul. 27</td><td class="date">8:00 pm</td>
          <td class="team"><a href="/team/7250-goonsquad">GOONSQUAD</a></td><td class="score">3</td>
          <td class="team"><a href="/team/7248-red-wolves">RED WOLVES</a></td><td class="score">6</td>
          <td class="location">Markham</td><td class="status">Final</td>
          <td class="anchor"><a href="/game/53050-goonsquad-red-wolves">View</a></td>
        </tr>
        <tr>
          <td class="date">Thu Jul. 30</td><td class="date">7:00 pm</td>
          <td class="team"><a href="/team/7250-goonsquad">GOONSQUAD</a></td><td class="score">-</td>
          <td class="team"><a href="/team/7251-viperz">VIPERZ</a></td><td class="score">-</td>
          <td class="location">Scarborough</td><td class="status">Scheduled</td>
          <td class="anchor"><a href="/game/53057-goonsquad-viperz">View</a></td>
        </tr>
      </table>
    `;

    const games = parseSchedule(
      '/team/7250-goonsquad',
      'summer-2026-mon-thu',
      'Summer 2026',
      html,
    );

    expect(games).toEqual([
      expect.objectContaining({
        id: 'ycbhl-game-53050',
        seasonTeamId: 'summer-2026-mon-thu',
        scheduledAt: '2026-07-27T20:00:00',
        status: 'final',
      }),
      expect.objectContaining({
        id: 'ycbhl-game-53057',
        seasonTeamId: 'summer-2026-mon-thu',
        scheduledAt: '2026-07-30T19:00:00',
        status: 'scheduled',
      }),
    ]);
  });

  it('discovers the newest official season from history instead of the anchor team page', () => {
    expect(currentSeasonNameFromHistory([
      { label: 'summer 2026 - MON/THU TIER 5' },
      { label: 'winter 2025-2026 - MONDAY TIER 5' },
      { label: 'fall 2026 - SUNDAY TIER 4' },
      { label: 'fall 2026 - MON/WED TIER 5' },
    ])).toBe('Fall 2026');

    expect(currentSeasonNameFromHistory([
      { label: 'fall 2026 - SUNDAY TIER 4' },
      { label: 'winter 2026-2027 - SUNDAY TIER 4' },
    ])).toBe('Winter 2026-2027');
  });

  it('keeps same-day Fall squads distinct by official tier', () => {
    const teams = resolveTeamIdentities([
      {
        entry: { href: '/team/7272-goonsquad' },
        teamHtml: '',
        team: {
          id: 'fall-2026-sunday',
          seasonSlug: 'fall-2026',
          scheduleLabel: 'SUNDAY',
          division: 'SUNDAY TIER 4',
        },
      },
      {
        entry: { href: '/team/7278-goonsquad' },
        teamHtml: '',
        team: {
          id: 'fall-2026-sunday',
          seasonSlug: 'fall-2026',
          scheduleLabel: 'SUNDAY',
          division: 'SUNDAY TIER 5',
        },
      },
      {
        entry: { href: '/team/7288-goonsquad' },
        teamHtml: '',
        team: {
          id: 'fall-2026-mon-wed',
          seasonSlug: 'fall-2026',
          scheduleLabel: 'MON/WED',
          division: 'MON/WED TIER 5',
        },
      },
    ]);

    expect(teams.map(({ team }) => team.id)).toEqual([
      'fall-2026-sunday-tier-4',
      'fall-2026-sunday-tier-5',
      'fall-2026-mon-wed',
    ]);
    expect(teams.map(({ disambiguated }) => disambiguated)).toEqual([true, true, false]);
  });

  it('falls back to the official team id when day and tier are both duplicated', () => {
    const teams = resolveTeamIdentities([
      {
        entry: { href: '/team/7272-goonsquad' },
        teamHtml: '',
        team: {
          id: 'fall-2026-sunday',
          seasonSlug: 'fall-2026',
          scheduleLabel: 'SUNDAY',
          division: 'SUNDAY TIER 4',
          providerExternalId: '7272',
        },
      },
      {
        entry: { href: '/team/7299-goonsquad' },
        teamHtml: '',
        team: {
          id: 'fall-2026-sunday',
          seasonSlug: 'fall-2026',
          scheduleLabel: 'SUNDAY',
          division: 'SUNDAY TIER 4',
          providerExternalId: '7299',
        },
      },
    ]);

    expect(teams.map(({ team }) => team.id)).toEqual([
      'fall-2026-sunday-tier-4-7272',
      'fall-2026-sunday-tier-4-7299',
    ]);
  });

  it('replaces active-season rows while preserving the historical archive', () => {
    const existing = snapshot({
      seasons: [
        { id: 'summer-2026', current: true, status: 'active' },
        { id: 'spring-2026', current: false, status: 'complete' },
      ],
      teams: [
        { id: 'summer-team', seasonId: 'summer-2026' },
        { id: 'spring-team', seasonId: 'spring-2026' },
      ],
      games: [
        { id: 'summer-game', seasonTeamId: 'summer-team', status: 'scheduled' },
        { id: 'spring-game', seasonTeamId: 'spring-team', status: 'final' },
      ],
      standings: [
        { seasonTeamId: 'summer-team', rank: 8, teamName: 'GOONSQUAD', points: 0 },
        { seasonTeamId: 'spring-team', rank: 4, teamName: 'GOONSQUAD', points: 7 },
      ],
    });
    const current = snapshot({
      capturedAt: '2026-07-29T14:30:00.000Z',
      seasons: [{ id: 'summer-2026', current: true, status: 'active' }],
      teams: [{ id: 'summer-team', seasonId: 'summer-2026' }],
      games: [{
        id: 'summer-game',
        seasonTeamId: 'summer-team',
        status: 'final',
        goalsFor: 9,
        goalsAgainst: 4,
      }],
      standings: [
        { seasonTeamId: 'summer-team', rank: 7, teamName: 'GOONSQUAD', points: 2 },
      ],
    });

    const merged = mergeCurrentSeasonSnapshot(existing, current);

    expect(merged.games).toEqual([
      expect.objectContaining({ id: 'summer-game', status: 'final', goalsFor: 9 }),
      expect.objectContaining({ id: 'spring-game', status: 'final' }),
    ]);
    expect(merged.seasons).toHaveLength(2);
    expect(merged.teams).toHaveLength(2);
    expect(merged.standings).toEqual([
      expect.objectContaining({ seasonTeamId: 'summer-team', rank: 7, points: 2 }),
      expect.objectContaining({ seasonTeamId: 'spring-team', rank: 4, points: 7 }),
    ]);
    expect(merged.capturedAt).toBe('2026-07-29T14:30:00.000Z');
  });

  it('captures every official standings row and marks the selected Goon Squad team', () => {
    const html = `
      <div class="stats-box standings">
        <table>
          <tr><th>Team</th><th>GP</th><th>W</th><th>L</th><th>T</th><th>PTS</th></tr>
          <tr><td><a href="/team/7248-red-wolves">RED WOLVES</a></td><td>12</td><td>11</td><td>1</td><td>0</td><td>22</td></tr>
          <tr><td><a href="/team/7250-goonsquad">GOONSQUAD</a></td><td>11</td><td>0</td><td>11</td><td>0</td><td>0</td></tr>
        </table>
      </div>
    `;

    expect(divisionStandings('/team/7250-goonsquad', html, 'summer-2026-mon-thu')).toEqual([
      expect.objectContaining({
        seasonTeamId: 'summer-2026-mon-thu',
        rank: 1,
        teamName: 'RED WOLVES',
        teamExternalId: '7248',
        gamesPlayed: 12,
        points: 22,
        isGoonSquad: false,
      }),
      expect.objectContaining({
        rank: 2,
        teamName: 'GOONSQUAD',
        teamExternalId: '7250',
        gamesPlayed: 11,
        points: 0,
        isGoonSquad: true,
      }),
    ]);
  });
});
