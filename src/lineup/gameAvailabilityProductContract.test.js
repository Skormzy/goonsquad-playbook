import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const projectFile = (path) => readFileSync(
  new URL(`../../${path}`, import.meta.url),
  'utf8',
);

describe('private game availability and player pictures', () => {
  const migration = projectFile('supabase/migrations/20260731_player_photos_and_game_availability.sql');
  const availability = projectFile('src/lineup/GameAvailability.jsx');
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
  });

  it('lets each approved member answer once for the next published game', () => {
    expect(migration).toContain('primary key (fixture_id, user_id)');
    expect(availability).toContain("label: \"I'm in\"");
    expect(availability).toContain("label: 'Maybe'");
    expect(availability).toContain("label: \"I'm out\"");
    expect(availability).toContain('Approved team members only');
    expect(home).toContain('<GameAvailability');
    expect(home).toContain('fixture={nextGame}');
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
