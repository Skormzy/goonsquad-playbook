-- Optional member photos and private next-game availability.
-- Public player photos are exposed only for approved player links.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'member-avatars',
  'member-avatars',
  true,
  8388608,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Members upload own avatar" on storage.objects;
create policy "Members upload own avatar" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'member-avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Members update own avatar" on storage.objects;
create policy "Members update own avatar" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'member-avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'member-avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Members delete own avatar" on storage.objects;
create policy "Members delete own avatar" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'member-avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop function if exists public.list_public_player_avatars();
create function public.list_public_player_avatars()
returns table (
  player_id uuid,
  external_id text,
  avatar_url text,
  jersey_number text,
  primary_position text
)
language sql
stable
security definer set search_path = public
as $$
  select distinct
    player.id as player_id,
    player.external_id,
    profile.avatar_url,
    player.jersey_number,
    player.primary_position
  from public.member_player_claims claim
  join public.profiles profile on profile.id = claim.user_id
  join public.players player on player.id = claim.player_id
  where claim.status = 'approved'
    and (
      (profile.avatar_url is not null and length(trim(profile.avatar_url)) > 0)
      or player.jersey_number is not null
      or player.primary_position is not null
    );
$$;

revoke all on function public.list_public_player_avatars() from public;
grant execute on function public.list_public_player_avatars() to anon, authenticated;

create or replace function public.update_linked_player_details(
  p_player_id uuid,
  p_jersey_number text default null,
  p_primary_position text default null
)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  normalized_number text := nullif(trim(coalesce(p_jersey_number, '')), '');
  normalized_position text := nullif(upper(trim(coalesce(p_primary_position, ''))), '');
begin
  if auth.uid() is null then
    raise exception 'Sign in before updating player details.';
  end if;
  if normalized_number is not null and normalized_number !~ '^[0-9]{1,3}$' then
    raise exception 'Player number must use up to three digits.';
  end if;
  if normalized_position is not null and normalized_position not in ('G', 'D', 'C', 'W') then
    raise exception 'Player position must be G, D, C, or W.';
  end if;
  if not public.is_team_admin() and not exists (
    select 1
    from public.member_player_claims claim
    where claim.user_id = auth.uid()
      and claim.player_id = p_player_id
      and claim.status = 'approved'
  ) then
    raise exception 'An approved player link is required.';
  end if;

  update public.players
  set
    jersey_number = normalized_number,
    primary_position = normalized_position,
    updated_at = now()
  where id = p_player_id;

  if not found then
    raise exception 'Player profile was not found.';
  end if;
end;
$$;

revoke all on function public.update_linked_player_details(uuid, text, text) from public;
grant execute on function public.update_linked_player_details(uuid, text, text) to authenticated;

create table if not exists public.team_game_availability (
  fixture_id text not null,
  user_id uuid not null references public.profiles(id) on delete cascade,
  response text not null check (response in ('in', 'maybe', 'out')),
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (fixture_id, user_id),
  constraint team_game_availability_fixture_length_check
    check (length(trim(fixture_id)) > 0 and char_length(fixture_id) <= 160),
  constraint team_game_availability_note_length_check
    check (note is null or char_length(note) <= 140)
);

create index if not exists team_game_availability_fixture_idx
  on public.team_game_availability (fixture_id, response, updated_at desc);

drop trigger if exists touch_updated_at_before_update on public.team_game_availability;
create trigger touch_updated_at_before_update
  before update on public.team_game_availability
  for each row execute function public.touch_updated_at();

alter table public.team_game_availability enable row level security;

drop policy if exists "Approved members read game availability" on public.team_game_availability;
create policy "Approved members read game availability" on public.team_game_availability
  for select to authenticated
  using (public.is_approved_team_member());

drop policy if exists "Members create game availability" on public.team_game_availability;
create policy "Members create game availability" on public.team_game_availability
  for insert to authenticated
  with check (
    public.is_approved_team_member()
    and (user_id = auth.uid() or public.is_team_admin())
  );

drop policy if exists "Members update game availability" on public.team_game_availability;
create policy "Members update game availability" on public.team_game_availability
  for update to authenticated
  using (
    public.is_approved_team_member()
    and (user_id = auth.uid() or public.is_team_admin())
  )
  with check (
    public.is_approved_team_member()
    and (user_id = auth.uid() or public.is_team_admin())
  );

drop policy if exists "Members delete game availability" on public.team_game_availability;
create policy "Members delete game availability" on public.team_game_availability
  for delete to authenticated
  using (
    public.is_approved_team_member()
    and (user_id = auth.uid() or public.is_team_admin())
  );

grant select, insert, update, delete on public.team_game_availability to authenticated;

select
  'Coach features ready' as status,
  (select public from storage.buckets where id = 'member-avatars') as player_photos_public,
  to_regclass('public.team_game_availability') is not null as availability_ready;
