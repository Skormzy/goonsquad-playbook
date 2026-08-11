-- Keep attendance available when the public schedule updates before the
-- statistics archive reaches the relational games table. A member may only
-- register a fixture for a schedule on which their approved player identity
-- is rostered, while explicit fixture/tournament grants keep working for EPs.

create table if not exists public.team_game_attendance_fixtures (
  fixture_id text primary key,
  season_team_id text references public.season_teams(id) on delete cascade,
  tournament_id text references public.team_tournaments(id) on delete cascade,
  scheduled_at timestamptz,
  opponent text not null default '',
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint team_game_attendance_fixtures_id_check
    check (length(trim(fixture_id)) > 0 and char_length(fixture_id) <= 160),
  constraint team_game_attendance_fixtures_scope_check
    check (season_team_id is not null or tournament_id is not null)
);

create index if not exists team_game_attendance_fixtures_schedule_idx
  on public.team_game_attendance_fixtures (season_team_id, scheduled_at);

drop trigger if exists touch_updated_at_before_update on public.team_game_attendance_fixtures;
create trigger touch_updated_at_before_update
  before update on public.team_game_attendance_fixtures
  for each row execute function public.touch_updated_at();

alter table public.team_game_attendance_fixtures enable row level security;

create or replace function public.normalized_attendance_player_name(p_name text)
returns text
language sql
immutable
parallel safe
as $$
  select case regexp_replace(lower(trim(coalesce(p_name, ''))), '[^a-z0-9]+', '', 'g')
    when 'mattgrenier' then 'mathewgrenier'
    when 'matthewgrenier' then 'mathewgrenier'
    else regexp_replace(lower(trim(coalesce(p_name, ''))), '[^a-z0-9]+', '', 'g')
  end;
$$;

revoke all on function public.normalized_attendance_player_name(text) from public;

create or replace function public.user_has_roster_schedule(
  p_user_id uuid,
  p_season_team_id text
) returns boolean
language sql
stable
security definer set search_path = public
as $$
  select p_user_id is not null
    and nullif(trim(coalesce(p_season_team_id, '')), '') is not null
    and exists (
      select 1
      from public.member_player_claims claim
      join public.players claimed_player on claimed_player.id = claim.player_id
      join public.roster_memberships membership
        on membership.season_team_id = p_season_team_id
       and membership.active
      join public.players roster_player on roster_player.id = membership.player_id
      where claim.user_id = p_user_id
        and claim.status = 'approved'
        and (
          membership.player_id = claim.player_id
          or public.normalized_attendance_player_name(roster_player.display_name)
             = public.normalized_attendance_player_name(claimed_player.display_name)
        )
    );
$$;

revoke all on function public.user_has_roster_schedule(uuid, text) from public;
grant execute on function public.user_has_roster_schedule(uuid, text) to authenticated;

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
      from public.team_game_attendance_fixtures fixture
      where fixture.fixture_id = p_fixture_id
        and (
          (
            fixture.season_team_id is not null
            and public.user_has_roster_schedule(p_user_id, fixture.season_team_id)
          )
          or (
            fixture.tournament_id is not null
            and exists (
              select 1
              from public.team_game_attendance_access access
              where access.user_id = p_user_id
                and access.scope_type = 'tournament'
                and access.scope_id = fixture.tournament_id
            )
          )
        )
    )
    or exists (
      select 1
      from public.games game
      where public.user_has_roster_schedule(p_user_id, game.season_team_id)
        and (
          game.id::text = p_fixture_id
          or game.external_id = p_fixture_id
          or ('ycbhl-game-' || game.external_id) = p_fixture_id
          or ('gtbhl-game-' || game.external_id) = p_fixture_id
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

create or replace function public.register_game_attendance_fixture(
  p_fixture_id text,
  p_season_team_id text default null,
  p_tournament_id text default null,
  p_scheduled_at timestamptz default null,
  p_opponent text default null
) returns text
language plpgsql
security definer set search_path = public
as $$
declare
  normalized_fixture_id text := trim(coalesce(p_fixture_id, ''));
  normalized_season_team_id text := nullif(trim(coalesce(p_season_team_id, '')), '');
  normalized_tournament_id text := nullif(trim(coalesce(p_tournament_id, '')), '');
  existing_fixture public.team_game_attendance_fixtures%rowtype;
begin
  if normalized_fixture_id = '' or char_length(normalized_fixture_id) > 160 then
    raise exception 'Choose a valid published game before setting attendance.';
  end if;
  if normalized_season_team_id is null and normalized_tournament_id is null then
    raise exception 'This game is missing its schedule.';
  end if;

  if not (
    public.is_team_admin()
    or (
      normalized_season_team_id is not null
      and public.user_has_roster_schedule(auth.uid(), normalized_season_team_id)
    )
    or exists (
      select 1 from public.team_game_attendance_access access
      where access.user_id = auth.uid()
        and access.scope_type = 'fixture'
        and access.scope_id = normalized_fixture_id
    )
    or (
      normalized_tournament_id is not null
      and exists (
        select 1 from public.team_game_attendance_access access
        where access.user_id = auth.uid()
          and access.scope_type = 'tournament'
          and access.scope_id = normalized_tournament_id
      )
    )
  ) then
    raise exception 'This game is not assigned to your roster.';
  end if;

  select * into existing_fixture
  from public.team_game_attendance_fixtures
  where fixture_id = normalized_fixture_id;

  if found and (
    existing_fixture.season_team_id is distinct from normalized_season_team_id
    or existing_fixture.tournament_id is distinct from normalized_tournament_id
  ) then
    raise exception 'This game is already connected to a different schedule.';
  end if;

  insert into public.team_game_attendance_fixtures (
    fixture_id,
    season_team_id,
    tournament_id,
    scheduled_at,
    opponent,
    created_by
  ) values (
    normalized_fixture_id,
    normalized_season_team_id,
    normalized_tournament_id,
    p_scheduled_at,
    left(trim(coalesce(p_opponent, '')), 160),
    auth.uid()
  )
  on conflict (fixture_id) do update set
    scheduled_at = coalesce(excluded.scheduled_at, public.team_game_attendance_fixtures.scheduled_at),
    opponent = case
      when excluded.opponent = '' then public.team_game_attendance_fixtures.opponent
      else excluded.opponent
    end,
    updated_at = now();

  return normalized_fixture_id;
end;
$$;

revoke all on function public.register_game_attendance_fixture(text, text, text, timestamptz, text) from public;
grant execute on function public.register_game_attendance_fixture(text, text, text, timestamptz, text) to authenticated;

drop policy if exists "Eligible members read attendance fixtures" on public.team_game_attendance_fixtures;
create policy "Eligible members read attendance fixtures" on public.team_game_attendance_fixtures
  for select to authenticated
  using (public.can_access_game_attendance(fixture_id));

drop policy if exists "Admins manage attendance fixtures" on public.team_game_attendance_fixtures;
create policy "Admins manage attendance fixtures" on public.team_game_attendance_fixtures
  for all to authenticated
  using (public.is_team_admin())
  with check (public.is_team_admin());

grant select, insert, update, delete on public.team_game_attendance_fixtures to authenticated;

-- Backfill the live Monday playoff fixture that exposed the archive/schedule lag.
insert into public.games (
  season_team_id,
  stage,
  scheduled_at,
  opponent,
  venue,
  location,
  status,
  source,
  external_id,
  source_url,
  verified_at
) values (
  'summer-2026-mon-thu',
  'playoffs',
  '2026-08-17T19:00:00-04:00',
  'DEW LANG DUCKS (5th)',
  'home',
  'Markham - Clatworthy Arena',
  'scheduled',
  'league',
  '53195',
  'https://www.yorkcentralbhl.com/game/53195-goonsquad-dew-lang-ducks',
  now()
)
on conflict (source, external_id) do update set
  season_team_id = excluded.season_team_id,
  stage = excluded.stage,
  scheduled_at = excluded.scheduled_at,
  opponent = excluded.opponent,
  venue = excluded.venue,
  location = excluded.location,
  status = excluded.status,
  source_url = excluded.source_url,
  verified_at = excluded.verified_at,
  updated_at = now();

select
  'Resilient game attendance ready' as status,
  to_regclass('public.team_game_attendance_fixtures') is not null as fixture_scope_ready,
  to_regprocedure('public.register_game_attendance_fixture(text,text,text,timestamptz,text)') is not null as register_ready;
