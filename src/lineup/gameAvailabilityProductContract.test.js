import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const projectFile = (path) => readFileSync(
  new URL(`../../${path}`, import.meta.url),
  'utf8',
);

describe('private game availability and player pictures', () => {
  const migration = projectFile('supabase/migrations/20260731_player_photos_and_game_availability.sql');
  const scopedMigration = projectFile('supabase/migrations/20260801_scoped_game_attendance.sql');
  const epMigration = projectFile('supabase/migrations/20260802_game_ep_management.sql');
  const availability = projectFile('src/lineup/GameAvailability.jsx');
  const attendanceBoard = projectFile('src/lineup/AttendanceBoard.jsx');
  const epManager = projectFile('src/lineup/EpManager.jsx');
  const home = projectFile('src/feed/TeamHome.jsx');
  const accountCloud = projectFile('src/account/accountCloud.js');
  const profile = projectFile('src/profile/ProfileWorkspace.jsx');
  const statsCloud = projectFile('src/stats/statsCloud.js');

  it('keeps lineup responses behind approved-member row-level security', () => {
    expect(migration).toContain('create table if not exists public.team_game_availability');
    expect(migration).toContain('alter table public.team_game_availability enable row level security');
    expect(migration).toContain('public.is_approved_team_member()');
    expect(migration).toContain('user_id = auth.uid() or public.is_team_admin()');
    expect(migration).not.toContain('grant select, insert, update, delete on public.team_game_availability to anon');
    expect(scopedMigration).toContain('create table if not exists public.team_game_attendance_access');
    expect(scopedMigration).toContain('create or replace function public.can_access_game_attendance');
    expect(scopedMigration).toContain("scope_type in ('fixture', 'tournament')");
    expect(scopedMigration).toContain('join public.roster_memberships membership');
    expect(scopedMigration).toContain('public.can_access_game_attendance(fixture_id)');
    expect(scopedMigration).toContain('create policy "Admins update attendance access"');
    expect(scopedMigration).toContain('create or replace function public.can_access_attendance_scope');
    expect(scopedMigration).toContain('public.can_access_attendance_scope(scope_type, scope_id)');
    expect(epMigration).toContain('create table if not exists public.team_game_ep_roster');
    expect(epMigration).toContain('create or replace function public.list_game_ep_roster');
    expect(epMigration).toContain('create or replace function public.manage_game_ep');
    expect(epMigration).toContain('public.can_access_game_attendance(fixture_id)');
    expect(epMigration).toContain('public.is_team_admin()');
    expect(epMigration).not.toContain('grant select, insert, update, delete on public.team_game_ep_roster to anon');
  });

  it('lets eligible players answer once across a compact multi-game board', () => {
    expect(migration).toContain('primary key (fixture_id, user_id)');
    expect(availability).toContain("label: \"I'm in\"");
    expect(availability).toContain("label: 'Maybe'");
    expect(availability).toContain("label: \"I'm out\"");
    expect(availability).toContain('Game roster and EPs');
    expect(availability).toContain("member.attendanceRole === 'EP'");
    expect(attendanceBoard).toContain('buildAttendanceFixtures');
    expect(attendanceBoard).toContain('loadGameEpRoster');
    expect(attendanceBoard).toContain('<EpManager');
    expect(epManager).toContain('Manage EPs');
    expect(epManager).toContain("label: 'Accounts'");
    expect(epManager).toContain("label: 'League records'");
    expect(epManager).toContain("label: 'New EP'");
    expect(epManager).toContain('This creates a private attendance card, not an app account.');
    expect(epManager).toContain("fixture.kind === 'tournament' ? 'tournament' : 'fixture'");
    expect(home).toContain('<AttendanceBoard');
    expect(home).toContain('tournaments={tournaments}');
  });

  it('stores optional member pictures in the owner folder and exposes only approved links', () => {
    expect(migration).toContain("bucket_id = 'member-avatars'");
    expect(migration).toContain("(storage.foldername(name))[1] = auth.uid()::text");
    expect(migration).toContain('create function public.list_public_player_avatars()');
    expect(migration).toContain("where claim.status = 'approved'");
    expect(accountCloud).toContain('prepareAccountAvatar');
    expect(accountCloud).toContain('MAX_AVATAR_EDGE = 1600');
    expect(accountCloud).toContain('uploadAccountAvatar');
    expect(accountCloud).toContain('removeAccountAvatar');
  });

  it('lets an approved linked player maintain their number and position', () => {
    expect(migration).toContain('create or replace function public.update_linked_player_details');
    expect(migration).toContain("claim.status = 'approved'");
    expect(migration).toContain("normalized_position not in ('G', 'D', 'C', 'W')");
    expect(migration).toContain('jersey_number text');
    expect(migration).toContain('primary_position text');
    expect(accountCloud).toContain('updateLinkedPlayerDetails');
    expect(accountCloud).toContain("'update_linked_player_details'");
    expect(profile).toContain('Edit roster card');
    expect(profile).toContain('savePlayerDetails');
    expect(statsCloud).toContain('jerseyNumber: row.jersey_number');
    expect(statsCloud).toContain('primaryPosition: row.primary_position');
  });
});
