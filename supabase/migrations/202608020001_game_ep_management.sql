-- Fixture-specific EP management.
-- EPs can reference an official league player or a private tracking-only player.
-- Tracking-only players never receive an auth account or public roster membership.

create table if not exists public.team_game_ep_roster (
  fixture_id text not null,
  player_id uuid not null references public.players(id) on delete cascade,
  response text not null default 'in' check (response in ('in', 'maybe', 'out')),
  note text,
  entry_source text not null default 'league' check (entry_source in ('league', 'manual')),
  assigned_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (fixture_id, player_id),
  constraint team_game_ep_roster_fixture_check
    check (length(trim(fixture_id)) > 0 and char_length(fixture_id) <= 160),
  constraint team_game_ep_roster_note_check
    check (note is null or char_length(note) <= 140)
);

create index if not exists team_game_ep_roster_player_idx
  on public.team_game_ep_roster (player_id, updated_at desc);

drop trigger if exists touch_updated_at_before_update on public.team_game_ep_roster;
create trigger touch_updated_at_before_update
  before update on public.team_game_ep_roster
  for each row execute function public.touch_updated_at();

alter table public.team_game_ep_roster enable row level security;

drop policy if exists "Eligible members read game EP roster" on public.team_game_ep_roster;
create policy "Eligible members read game EP roster" on public.team_game_ep_roster
  for select to authenticated
  using (public.can_access_game_attendance(fixture_id));

drop policy if exists "Admins create game EP roster" on public.team_game_ep_roster;
create policy "Admins create game EP roster" on public.team_game_ep_roster
  for insert to authenticated
  with check (public.is_team_admin() and assigned_by = auth.uid());

drop policy if exists "Admins update game EP roster" on public.team_game_ep_roster;
create policy "Admins update game EP roster" on public.team_game_ep_roster
  for update to authenticated
  using (public.is_team_admin())
  with check (public.is_team_admin() and assigned_by = auth.uid());

drop policy if exists "Admins delete game EP roster" on public.team_game_ep_roster;
create policy "Admins delete game EP roster" on public.team_game_ep_roster
  for delete to authenticated
  using (public.is_team_admin());

grant select, insert, update, delete on public.team_game_ep_roster to authenticated;

create or replace function public.list_game_ep_roster(p_fixture_id text)
returns table (
  player_id uuid,
  external_id text,
  display_name text,
  jersey_number text,
  primary_position text,
  source_url text,
  response text,
  note text,
  entry_source text,
  updated_at timestamptz
)
language plpgsql
stable
security definer set search_path = public
as $$
begin
  if not public.can_access_game_attendance(p_fixture_id) then
    raise exception 'This game lineup is not available to your account.';
  end if;

  return query
  select
    player.id,
    player.external_id,
    player.display_name,
    player.jersey_number,
    player.primary_position,
    player.source_url,
    ep.response,
    ep.note,
    ep.entry_source,
    ep.updated_at
  from public.team_game_ep_roster ep
  join public.players player on player.id = ep.player_id
  where ep.fixture_id = p_fixture_id
  order by lower(player.display_name), player.id;
end;
$$;

revoke all on function public.list_game_ep_roster(text) from public;
grant execute on function public.list_game_ep_roster(text) to authenticated;

create or replace function public.manage_game_ep(
  p_action text,
  p_fixture_id text,
  p_player_id uuid default null,
  p_player_external_id text default null,
  p_display_name text default null,
  p_jersey_number text default null,
  p_primary_position text default null,
  p_source_url text default null,
  p_entry_source text default 'league',
  p_response text default 'in',
  p_note text default null
)
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  normalized_action text := lower(trim(coalesce(p_action, '')));
  normalized_fixture text := trim(coalesce(p_fixture_id, ''));
  normalized_external_id text := nullif(trim(coalesce(p_player_external_id, '')), '');
  normalized_name text := nullif(trim(coalesce(p_display_name, '')), '');
  normalized_number text := nullif(trim(coalesce(p_jersey_number, '')), '');
  normalized_position text := nullif(upper(trim(coalesce(p_primary_position, ''))), '');
  normalized_source text := case when lower(trim(coalesce(p_entry_source, ''))) = 'manual' then 'manual' else 'league' end;
  normalized_response text := lower(trim(coalesce(p_response, 'in')));
  normalized_note text := nullif(trim(coalesce(p_note, '')), '');
  target_player_id uuid := p_player_id;
begin
  if not public.is_team_admin() then
    raise exception 'Admin access is required to manage EPs.';
  end if;
  if normalized_fixture = '' or char_length(normalized_fixture) > 160 then
    raise exception 'Choose a valid game before managing EPs.';
  end if;
  if normalized_action not in ('add', 'update', 'remove') then
    raise exception 'Unsupported EP action.';
  end if;

  if normalized_action = 'remove' then
    if target_player_id is null then
      raise exception 'Choose an EP to remove.';
    end if;
    delete from public.team_game_ep_roster
    where fixture_id = normalized_fixture and player_id = target_player_id;
    return target_player_id;
  end if;

  if normalized_response not in ('in', 'maybe', 'out') then
    raise exception 'EP attendance must be In, Maybe, or Out.';
  end if;
  if normalized_note is not null and char_length(normalized_note) > 140 then
    raise exception 'EP notes must be 140 characters or fewer.';
  end if;
  if normalized_number is not null and normalized_number !~ '^[0-9]{1,3}$' then
    raise exception 'Player number must use up to three digits.';
  end if;
  if normalized_position is not null and normalized_position not in ('G', 'D', 'C', 'W') then
    raise exception 'Player position must be G, D, C, or W.';
  end if;

  if target_player_id is null and normalized_external_id is not null then
    select player.id into target_player_id
    from public.players player
    where player.external_id = normalized_external_id
    order by case when player.source = 'league' then 0 else 1 end, player.created_at
    limit 1;
  end if;

  if target_player_id is null then
    if normalized_name is null then
      raise exception 'Enter an EP name or choose a league player.';
    end if;
    insert into public.players (
      display_name,
      jersey_number,
      primary_position,
      active,
      source,
      external_id,
      source_url
    ) values (
      left(normalized_name, 100),
      normalized_number,
      normalized_position,
      true,
      case when normalized_external_id is null then 'team' else 'league' end,
      normalized_external_id,
      nullif(trim(coalesce(p_source_url, '')), '')
    )
    returning id into target_player_id;
  elsif not exists (select 1 from public.players where id = target_player_id) then
    raise exception 'That league player record no longer exists.';
  end if;

  insert into public.team_game_ep_roster (
    fixture_id,
    player_id,
    response,
    note,
    entry_source,
    assigned_by
  ) values (
    normalized_fixture,
    target_player_id,
    normalized_response,
    normalized_note,
    normalized_source,
    auth.uid()
  )
  on conflict (fixture_id, player_id) do update set
    response = excluded.response,
    note = excluded.note,
    entry_source = excluded.entry_source,
    assigned_by = excluded.assigned_by,
    updated_at = now();

  return target_player_id;
end;
$$;

revoke all on function public.manage_game_ep(text, text, uuid, text, text, text, text, text, text, text, text) from public;
grant execute on function public.manage_game_ep(text, text, uuid, text, text, text, text, text, text, text, text) to authenticated;

select
  'Game EP management ready' as status,
  to_regclass('public.team_game_ep_roster') is not null as ep_roster_ready,
  to_regprocedure('public.manage_game_ep(text,text,uuid,text,text,text,text,text,text,text,text)') is not null as ep_manager_ready;
