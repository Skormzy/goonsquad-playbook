import { Buffer } from 'node:buffer';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { OFFICIAL_STATS_DATASET } from './statsSeed';

const workspaceSource = readFileSync(new URL('./StatsWorkspace.jsx', import.meta.url), 'utf8');
const migrationSource = readFileSync(new URL('../../supabase/migrations/20260722_team_accounts_and_statistics.sql', import.meta.url), 'utf8');
const pushSource = readFileSync(new URL('../../scripts/push-york-central-stats-to-supabase.mjs', import.meta.url), 'utf8');
const bridgeSource = readFileSync(new URL('../../scripts/build-supabase-statistics-bridge.mjs', import.meta.url), 'utf8');
const mainSource = readFileSync(new URL('../main.jsx', import.meta.url), 'utf8');
const headerSource = readFileSync(new URL('../components/Header.jsx', import.meta.url), 'utf8');

describe('team account and statistics product contract', () => {
  it('ships a source-linked official archive without inventing unavailable values', () => {
    expect(OFFICIAL_STATS_DATASET.source).toBe('league-snapshot');
    expect(OFFICIAL_STATS_DATASET.seasons).toHaveLength(16);
    expect(OFFICIAL_STATS_DATASET.teams).toHaveLength(23);
    expect(OFFICIAL_STATS_DATASET.games).toHaveLength(281);
    expect(OFFICIAL_STATS_DATASET.players).toHaveLength(216);
    expect(OFFICIAL_STATS_DATASET.playerGameStats).toHaveLength(3376);
    expect(OFFICIAL_STATS_DATASET.goalieGameStats).toHaveLength(277);
    expect(OFFICIAL_STATS_DATASET.gameEvents).toHaveLength(2734);
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
    expect(workspaceSource).toContain("{ id: 'games', label: 'Games' }");
    expect(workspaceSource).toContain("{ id: 'players', label: 'Players' }");
    expect(workspaceSource).toContain('Every Goonsquad schedule');
    expect(workspaceSource).toContain('TEAM HOME');
    expect(workspaceSource).toContain('MatchdayCard');
    expect(workspaceSource).toContain('NEXT GAME');
    expect(workspaceSource).toContain('LATEST RESULT');
    expect(workspaceSource).toContain('ALL_SEASON_TEAMS_ID');
    expect(workspaceSource).toContain('Official game sheet');
    expect(workspaceSource).toContain("initialQueryValue('game')");
    expect(workspaceSource).toContain("url.searchParams.set('game'");
    expect(workspaceSource).toContain('stats-game-page');
    expect(workspaceSource).toContain('PLAYER BOX SCORE');
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
