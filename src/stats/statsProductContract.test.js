import { Buffer } from 'node:buffer';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { OFFICIAL_STATS_DATASET } from './statsSeed';

const workspaceSource = readFileSync(new URL('./StatsWorkspace.jsx', import.meta.url), 'utf8');
const headToHeadSource = readFileSync(new URL('./OpponentHeadToHead.jsx', import.meta.url), 'utf8');
const migrationSource = readFileSync(new URL('../../supabase/migrations/20260722_team_accounts_and_statistics.sql', import.meta.url), 'utf8');
const pushSource = readFileSync(new URL('../../scripts/push-york-central-stats-to-supabase.mjs', import.meta.url), 'utf8');
const bridgeSource = readFileSync(new URL('../../scripts/build-supabase-statistics-bridge.mjs', import.meta.url), 'utf8');
const mainSource = readFileSync(new URL('../main.jsx', import.meta.url), 'utf8');
const headerSource = readFileSync(new URL('../components/Header.jsx', import.meta.url), 'utf8');

describe('team account and statistics product contract', () => {
  it('ships a source-linked official archive without inventing unavailable values', () => {
    expect(OFFICIAL_STATS_DATASET.source).toBe('league-snapshot');
    expect(OFFICIAL_STATS_DATASET.seasons.length).toBeGreaterThanOrEqual(16);
    expect(OFFICIAL_STATS_DATASET.teams.length).toBeGreaterThanOrEqual(23);
    expect(OFFICIAL_STATS_DATASET.games.length).toBeGreaterThanOrEqual(282);
    expect(OFFICIAL_STATS_DATASET.players.length).toBeGreaterThanOrEqual(216);
    expect(OFFICIAL_STATS_DATASET.playerGameStats.length).toBeGreaterThanOrEqual(3405);
    expect(OFFICIAL_STATS_DATASET.goalieGameStats.length).toBeGreaterThanOrEqual(280);
    expect(OFFICIAL_STATS_DATASET.gameEvents.length).toBeGreaterThanOrEqual(2768);
    expect(OFFICIAL_STATS_DATASET.standings.length).toBeGreaterThanOrEqual(154);
    expect(new Set(OFFICIAL_STATS_DATASET.standings.map((row) => row.seasonTeamId)).size).toBeGreaterThanOrEqual(28);
    expect(OFFICIAL_STATS_DATASET.teams.filter((team) => team.seasonId === 'summer-2026').map((team) => team.name)).toEqual(['Mon/Thu Team', 'Sunday Team']);
    expect(OFFICIAL_STATS_DATASET.games.every((game) => game.sourceUrl && game.verified)).toBe(true);
    expect(OFFICIAL_STATS_DATASET.seasons.every((season) => season.startDate === null && season.endDate === null)).toBe(true);
  });

  it('supports every requested statistics layer and manager entry path', () => {
    for (const table of [
      'seasons',
      'season_teams',
      'players',
      'roster_memberships',
      'games',
      'team_game_stats',
      'team_season_summaries',
      'player_season_stats',
      'goalie_season_stats',
      'player_game_stats',
      'goalie_game_stats',
      'game_events',
    ]) {
      expect(migrationSource).toContain(`public.${table}`);
    }
    expect(migrationSource).toContain('public.is_team_data_manager()');
    expect(migrationSource).toContain('protect_profile_role_before_update');
    expect(workspaceSource).toContain("{ id: 'overview', label: 'Overview' }");
    expect(workspaceSource).toContain("{ id: 'standings', label: 'Standings' }");
    expect(workspaceSource).toContain("{ id: 'games', label: 'Games' }");
    expect(workspaceSource).toContain("{ id: 'players', label: 'Players' }");
    expect(workspaceSource).toContain('Every Goonsquad schedule');
    expect(workspaceSource).toContain("!scheduleComplete && <span className=\"stats-schedule-status\"");
    expect(workspaceSource).toContain('Results pending');
    expect(workspaceSource).not.toContain("scheduleComplete ? 'Complete'");
    expect(workspaceSource).toContain('TEAM STATISTICS');
    expect(workspaceSource).toContain('MatchdayCard');
    expect(workspaceSource).toContain('NEXT GAME');
    expect(workspaceSource).toContain('LATEST RESULT');
    expect(workspaceSource).toContain('ALL_SEASON_TEAMS_ID');
    expect(workspaceSource).toContain('League game sheet');
    expect(workspaceSource).toContain("initialQueryValue('game')");
    expect(workspaceSource).toContain("url.searchParams.set('game'");
    expect(workspaceSource).toContain("initialQueryValue('opponent')");
    expect(workspaceSource).toContain("url.searchParams.set('opponent'");
    expect(workspaceSource).toContain("initialQueryValue('player')");
    expect(workspaceSource).toContain("url.searchParams.set('player'");
    expect(workspaceSource).toContain('ref={workspaceRef}');
    expect(workspaceSource).toContain('workspaceRef.current.scrollTop = 0');
    expect(workspaceSource).toContain('PlayerProfilePage');
    expect(workspaceSource).toContain('Every Goonsquad player');
    expect(workspaceSource).toContain('playerRosterCandidates');
    expect(workspaceSource).toContain("game?.status !== 'final'");
    expect(workspaceSource).toContain('OpponentDirectory');
    expect(workspaceSource).toContain('OpponentHeadToHead');
    expect(workspaceSource).toContain('LeagueStandings');
    expect(workspaceSource).toContain('LEAGUE TABLE');
    expect(workspaceSource).toContain('seasonTeamIds: snapshot.isSeasonAggregate ? null : [snapshot.team.id]');
    expect(workspaceSource).toContain('Open head-to-head against');
    expect(workspaceSource).toContain('stats-game-page');
    expect(workspaceSource).toContain('PLAYER BOX SCORE');
    expect(workspaceSource).toContain('title="Shots for">SF</th>');
    expect(workspaceSource).toContain('title="Shots against">SA</th>');
    expect(workspaceSource).toContain('title="Penalty minutes">PIM</th>');
    expect(workspaceSource).toContain("awaitingResult ? 'Status' : 'Matchup'");
    expect(workspaceSource).not.toContain('Detailed statistics will appear after the game');
    expect(headToHeadSource).toContain('HEAD TO HEAD · {matchup.scopeLabel.toUpperCase()}');
    expect(headToHeadSource).toContain('PLAYED · RESULTS PENDING');
    expect(headToHeadSource).toContain('Results pending');
    expect(headToHeadSource).toContain('Matchup centre');
    expect(headToHeadSource).toContain('Browse all ${filtered.length} opponents');
    expect(headToHeadSource).toContain('SEASON BY SEASON');
    for (const table of ['team_game_stats', 'player_game_stats', 'goalie_game_stats', 'game_events']) {
      expect(pushSource).toContain(`upsert('${table}'`);
    }
    expect(workspaceSource).toContain("setMode('roster')");
    expect(workspaceSource).toContain("setMode('line')");
  });

  it('uses one app-wide identity for the shell and cloud-backed favorites', () => {
    expect(mainSource).toContain('<AccountProvider>');
    expect(headerSource).toContain("activateView('account')");
    expect(migrationSource).toContain('public.user_favorite_plays');
    expect(migrationSource).toContain('public.playmaker_play_revisions');
  });

  it('keeps the initial archive import small, restricted, and self-disabling', () => {
    expect(Buffer.byteLength(bridgeSource)).toBeLessThan(20_000);
    expect(bridgeSource).toContain('private.goonsquad_archive_import_gate');
    expect(bridgeSource).toContain('alter table private.goonsquad_archive_import_gate enable row level security');
    expect(bridgeSource).toContain('token_hash = md5(p_token)');
    expect(bridgeSource).toContain('security definer');
    expect(bridgeSource).toContain('p_table text');
    expect(bridgeSource).toContain('The one-time Goonsquad import bridge is not active.');
    expect(bridgeSource).toContain(
      'revoke execute on function public.goonsquad_archive_upsert(text, text, jsonb) from anon, authenticated',
    );
    expect(pushSource).toContain("cloud.rpc('goonsquad_archive_upsert'");
    expect(pushSource).toContain("cloud.rpc('goonsquad_archive_finalize'");

    for (const table of [
      'seasons',
      'season_teams',
      'players',
      'roster_memberships',
      'games',
      'team_game_stats',
      'team_season_summaries',
      'player_season_stats',
      'goalie_season_stats',
      'player_game_stats',
      'goalie_game_stats',
      'game_events',
    ]) {
      expect(bridgeSource).toContain(`when '${table}'`);
    }

    expect(bridgeSource).not.toContain("when 'profiles'");
    expect(bridgeSource).not.toContain('auth.users');
  });
});
