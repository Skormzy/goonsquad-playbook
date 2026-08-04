-- Fixture-scoped attendance access.
-- Rostered players inherit their schedule. Admins can add a call-up to one
-- league game or to every game in a tournament without widening team access.

create table if not exists public.team_game_attendance_access (
  scope_type text not null check (scope_type in ('fixture', 'tournament')),
  scope_id text not null,
  user_id uuid not null references public.profiles(id) on delete cascade,
  assigned_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (scope_type, scope_id, user_id),
  constraint team_game_attendance_access_scope_id_check
    check (length(trim(scope_id)) > 0 and char_length(scope_id) <= 160)
);

create index if not exists team_game_attendance_access_user_idx
  on public.team_game_attendance_access (user_id, scope_type, scope_id);

alter table public.team_game_attendance_access enable row level security;

drop policy if exists "Members read own attendance access" on public.team_game_attendance_access;
create policy "Members read own attendance access" on public.team_game_attendance_access
  for select to authenticated
  using (user_id = auth.uid() or public.is_team_admin());

drop policy if exists "Admins create attendance access" on public.team_game_attendance_access;
create policy "Admins create attendance access" on public.team_game_attendance_access
  for insert to authenticated
  with check (public.is_team_admin() and assigned_by = auth.uid());

drop policy if exists "Admins update attendance access" on public.team_game_attendance_access;
create policy "Admins update attendance access" on public.team_game_attendance_access
  for update to authenticated
  using (public.is_team_admin())
  with check (public.is_team_admin() and assigned_by = auth.uid());

drop policy if exists "Admins delete attendance access" on public.team_game_attendance_access;
create policy "Admins delete attendance access" on public.team_game_attendance_access
  for delete to authenticated
  using (public.is_team_admin());

grant select, insert, update, delete on public.team_game_attendance_access to authenticated;

create or replace function public.can_access_game_attendance(
  p_fixture_id text,
  p_user_id uuid default auth.uid()
) returns boolean
language sql
stable
security definer set search_path = public
as $$
  select p_user_id is not null and length(trim(coalesce(p_fixture_id, ''))) > 0 and (
    public.is_team_admin(p_user_id)
    or exists (
      select 1
      from public.team_game_attendance_access access
      where access.user_id = p_user_id
        and access.scope_type = 'fixture'
        and access.scope_id = p_fixture_id
    )
    or exists (
      select 1
      from public.member_player_claims claim
      join public.roster_memberships membership
        on membership.player_id = claim.player_id
       and membership.active
      join public.games game
        on game.season_team_id = membership.season_team_id
      where claim.user_id = p_user_id
        and claim.status = 'approved'
        and (
          game.id::text = p_fixture_id
          or game.external_id = p_fixture_id
          or ('ycbhl-game-' || game.external_id) = p_fixture_id
        )
    )
    or exists (
      select 1
      from public.team_game_attendance_access access
      join public.team_tournaments tournament
        on access.scope_type = 'tournament'
       and access.scope_id = tournament.id
      cross join lateral jsonb_array_elements(
        case
          when jsonb_typeof(tournament.payload -> 'games') = 'array'
            then tournament.payload -> 'games'
          else '[]'::jsonb
        end
      ) game
      where access.user_id = p_user_id
        and game ->> 'id' = p_fixture_id
    )
  );
$$;

revoke all on function public.can_access_game_attendance(text, uuid) from public;
grant execute on function public.can_access_game_attendance(text, uuid) to authenticated;

create or replace function public.can_access_attendance_scope(
  p_scope_type text,
  p_scope_id text,
  p_user_id uuid default auth.uid()
) returns boolean
language sql
stable
security definer set search_path = public
as $$
  select p_user_id is not null and (
    public.is_team_admin(p_user_id)
    or exists (
      select 1
      from public.team_game_attendance_access access
      where access.user_id = p_user_id
        and access.scope_type = p_scope_type
        and access.scope_id = p_scope_id
    )
    or (
      p_scope_type = 'fixture'
      and public.can_access_game_attendance(p_scope_id, p_user_id)
    )
  );
$$;

revoke all on function public.can_access_attendance_scope(text, text, uuid) from public;
grant execute on function public.can_access_attendance_scope(text, text, uuid) to authenticated;

drop policy if exists "Members read own attendance access" on public.team_game_attendance_access;
create policy "Eligible members read attendance access" on public.team_game_attendance_access
  for select to authenticated
  using (public.can_access_attendance_scope(scope_type, scope_id));

drop policy if exists "Approved members read game availability" on public.team_game_availability;
drop policy if exists "Members create game availability" on public.team_game_availability;
drop policy if exists "Members update game availability" on public.team_game_availability;
drop policy if exists "Members delete game availability" on public.team_game_availability;

create policy "Eligible members read game availability" on public.team_game_availability
  for select to authenticated
  using (public.can_access_game_attendance(fixture_id));

create policy "Eligible members create game availability" on public.team_game_availability
  for insert to authenticated
  with check (
    public.can_access_game_attendance(fixture_id)
    and (user_id = auth.uid() or public.is_team_admin())
  );

create policy "Eligible members update game availability" on public.team_game_availability
  for update to authenticated
  using (
    public.can_access_game_attendance(fixture_id)
    and (user_id = auth.uid() or public.is_team_admin())
  )
  with check (
    public.can_access_game_attendance(fixture_id)
    and (user_id = auth.uid() or public.is_team_admin())
  );

create policy "Eligible members delete game availability" on public.team_game_availability
  for delete to authenticated
  using (
    public.can_access_game_attendance(fixture_id)
    and (user_id = auth.uid() or public.is_team_admin())
  );

select
  'Scoped attendance ready' as status,
  to_regclass('public.team_game_attendance_access') is not null as access_ready,
  to_regprocedure('public.can_access_game_attendance(text,uuid)') is not null as policy_ready;
