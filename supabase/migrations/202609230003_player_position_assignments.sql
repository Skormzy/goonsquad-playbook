-- Preserve explicit position assignments, including a deliberate clear, without
-- changing positions recorded in historical roster memberships.
alter table public.players
  add column if not exists primary_position_updated_at timestamptz;

-- Keep imports from replacing an explicit assignment, including when an
-- administrator saves while a league import is already in progress.
create or replace function public.preserve_player_position_assignment()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.primary_position_updated_at is not null
    and new.primary_position_updated_at is not distinct from old.primary_position_updated_at then
    new.primary_position := old.primary_position;
  end if;
  return new;
end;
$$;

drop trigger if exists preserve_player_position_assignment on public.players;
create trigger preserve_player_position_assignment
before update on public.players
for each row execute function public.preserve_player_position_assignment();

drop function if exists public.list_public_player_avatars();
create function public.list_public_player_avatars()
returns table (
  player_id uuid,
  external_id text,
  avatar_url text,
  jersey_number text,
  primary_position text,
  jersey_number_updated_at timestamptz,
  primary_position_updated_at timestamptz
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
    player.jersey_number_updated_at,
    player.primary_position_updated_at
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
      and coalesce((to_jsonb(team)->>'is_visible')::boolean, true)
      and season.is_visible
  );
$$;

revoke all on function public.list_public_player_avatars() from public;
grant execute on function public.list_public_player_avatars() to anon, authenticated;

drop function if exists public.update_linked_player_details(uuid, text, text);
create or replace function public.update_linked_player_details(
  p_player_id uuid,
  p_jersey_number text default null,
  p_primary_position text default null,
  p_update_jersey_number boolean default true,
  p_update_primary_position boolean default true
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
  if p_update_jersey_number and normalized_number is not null and normalized_number !~ '^[0-9]{1,3}$' then
    raise exception 'Player number must use up to three digits.';
  end if;
  if p_update_primary_position and normalized_position is not null and normalized_position not in ('G', 'D', 'C', 'W') then
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

  -- Explicit dirty flags distinguish a deliberate clear of an imported
  -- fallback from an untouched null field. Older callers update both fields.
  update public.players
  set
    jersey_number = case when p_update_jersey_number then normalized_number else jersey_number end,
    jersey_number_updated_at = case
      when p_update_jersey_number then now()
      else jersey_number_updated_at
    end,
    primary_position = case when p_update_primary_position then normalized_position else primary_position end,
    primary_position_updated_at = case
      when p_update_primary_position then now()
      else primary_position_updated_at
    end,
    updated_at = now()
  where id = p_player_id;

  if not found then
    raise exception 'Player profile was not found.';
  end if;
end;
$$;

revoke all on function public.update_linked_player_details(uuid, text, text, boolean, boolean) from public;
grant execute on function public.update_linked_player_details(uuid, text, text, boolean, boolean) to authenticated;
