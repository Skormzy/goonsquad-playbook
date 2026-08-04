import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { isMissingTournamentControlRoom } from './tournamentCloud';
import { isMissingIntelligenceTable } from './tournamentIntelligenceCloud';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');

describe('tournament admin product contract', () => {
  it('keeps tournament writes behind the existing admin role', () => {
    const migration = read('../../supabase/migrations/20260731_tournament_control_room.sql');

    expect(migration).toContain('public.is_team_admin()');
    expect(migration).toContain('for insert to authenticated');
    expect(migration).toContain('for update to authenticated');
    expect(migration).toContain('for delete to authenticated');
    expect(migration).toContain('case when tournament.is_published then tournament.payload else null end');
  });

  it('provides editable event structure and an explicit hidden-bracket mode', () => {
    const panel = read('./TournamentAdminPanel.jsx');

    expect(panel).toContain("label: 'Teams'");
    expect(panel).toContain("label: 'Event games'");
    expect(panel).toContain("label: 'Goonsquad'");
    expect(panel).toContain("label: 'Standings'");
    expect(panel).toContain("label: 'Bracket'");
    expect(panel).toContain('<option value="hidden">Do not show a bracket</option>');
    expect(panel).toContain('Visible to everyone');
  });

  it('fails open to the bundled public archive until the one-time migration runs', () => {
    expect(isMissingTournamentControlRoom({ code: '42P01' })).toBe(true);
    expect(isMissingTournamentControlRoom({ message: 'team_tournaments does not exist' })).toBe(true);
    expect(isMissingTournamentControlRoom({ message: 'network request failed' })).toBe(false);
  });

  it('keeps opponent intelligence out of public data and behind the admin role', () => {
    const migration = read('../../supabase/migrations/20260804_tournament_opponent_intelligence.sql');
    const workspace = read('./TournamentWorkspace.jsx');
    const publicArchive = read('./tournaments.json');
    const publicEvents = read('./tournamentEvents.json');

    expect(migration).toContain('alter table public.tournament_opponent_intelligence enable row level security');
    expect(migration).toContain('for select to authenticated');
    expect(migration).toContain('using (public.is_team_admin())');
    expect(migration).toContain('revoke all on public.tournament_opponent_intelligence from anon');
    expect(workspace).toContain("tab.adminOnly ? canManage");
    expect(workspace).toContain("resolvedActiveTab === 'intelligence' && canManage");
    expect(publicArchive).not.toContain('tournament_opponent_intelligence');
    expect(publicArchive).not.toContain('Cambridge Hitmen');
    expect(publicEvents).not.toContain('Cambridge Hitmen');
    expect(isMissingIntelligenceTable({ code: '42P01' })).toBe(true);
    expect(isMissingIntelligenceTable({ message: 'tournament_opponent_intelligence does not exist' })).toBe(true);
    expect(isMissingIntelligenceTable({ message: 'network request failed' })).toBe(false);
  });
});
