-- Preserve team visibility when available without requiring the optional column
-- in deployments whose season_teams schema predates that visibility field.
create or replace function public.list_public_player_avatars()
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
      and coalesce((to_jsonb(team)->>'is_visible')::boolean, true)
      and season.is_visible
  );
$$;

revoke all on function public.list_public_player_avatars() from public;
grant execute on function public.list_public_player_avatars() to anon, authenticated;
