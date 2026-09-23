-- Keep explicit player-number assignments separate from imported roster history.
-- The timestamp also records a deliberate clear, even when the old value is null.
alter table public.players
  add column if not exists jersey_number_updated_at timestamptz;

drop function if exists public.list_public_player_avatars();
create function public.list_public_player_avatars()
returns table (
  player_id uuid,
  external_id text,
  avatar_url text,
  jersey_number text,
  primary_position text,
  jersey_number_updated_at timestamptz
)
language sql
stable
security definer set search_path = public
as $$
  select
    player.id,
    player.external_id,
    profile.avatar_url,
    player.jersey_number,
    player.primary_position,
    player.jersey_number_updated_at
  from public.players player
  left join public.member_player_claims claim
    on claim.player_id = player.id and claim.status = 'approved'
  left join public.profiles profile on profile.id = claim.user_id
  where exists (
    select 1
    from public.roster_memberships membership
    join public.season_teams team on team.id = membership.season_team_id
    join public.seasons season on season.id = team.season_id
    where membership.player_id = player.id
      and season.is_visible
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
    jersey_number_updated_at = now(),
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
