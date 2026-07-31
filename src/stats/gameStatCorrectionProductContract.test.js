import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const workspace = readFileSync(new URL('./StatsWorkspace.jsx', import.meta.url), 'utf8');
const panel = readFileSync(new URL('./GameStatCorrectionPanel.jsx', import.meta.url), 'utf8');
const cloud = readFileSync(new URL('./statsCloud.js', import.meta.url), 'utf8');
const migration = readFileSync(
  new URL('../../supabase/migrations/20260731_team_game_stat_overrides.sql', import.meta.url),
  'utf8',
);

describe('game-stat correction product contract', () => {
  it('puts the correction workflow on the game page for admins', () => {
    expect(workspace).toContain("account.profile?.role === 'admin'");
    expect(workspace).toContain("game.adminCorrection ? 'Edit correction' : 'Correct game'");
    expect(workspace).toContain('Team correction applied');
    expect(panel).toContain('Every edit below changes this game');
    expect(panel).toContain('Publish correction');
  });

  it('supports score, events, player lines, team totals, goalies, and rollback', () => {
    expect(panel).toContain("['scoring', 'Scoring']");
    expect(panel).toContain("['players', 'Player lines']");
    expect(panel).toContain("['team', 'Game totals']");
    expect(panel).toContain("['goalies', 'Goalies']");
    expect(panel).toContain('Add goal');
    expect(panel).toContain('Add penalty');
    expect(panel).toContain('Use official data');
  });

  it('loads public corrections independently of the optional full cloud projection', () => {
    expect(cloud).toContain("cloud.rpc('list_public_team_game_stat_overrides')");
    expect(cloud).toContain('applyGameStatOverrides(dataset, data)');
    expect(cloud).toContain("cloud.rpc('upsert_team_game_stat_override'");
  });

  it('keeps writes admin-only and records every revision', () => {
    expect(migration).toContain('public.is_team_admin()');
    expect(migration).toContain('team_game_stat_override_revisions');
    expect(migration).toContain('audit_team_game_stat_override_after_write');
    expect(migration).toContain('grant execute on function public.list_public_team_game_stat_overrides() to anon, authenticated');
    expect(migration).toContain('Only a Goonsquad admin can correct official game statistics.');
  });
});
