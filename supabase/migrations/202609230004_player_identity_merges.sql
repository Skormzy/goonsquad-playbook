-- Directed identity links retain every imported row and every historical claim.
alter table public.players
  add column if not exists merged_into_player_id uuid references public.players(id) on delete restrict,
  add column if not exists canonical_display_name text,
  add constraint players_merge_not_self check (merged_into_player_id is distinct from id),
  add constraint players_canonical_name_nonempty check (
    canonical_display_name is null or length(trim(canonical_display_name)) between 1 and 120
  );
create index if not exists players_merged_into_idx on public.players(merged_into_player_id);

create table public.player_merge_audit (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id) on delete set null,
  target_player_id uuid not null references public.players(id) on delete restrict,
  source_player_ids uuid[] not null,
  target_player_ids uuid[] not null,
  preview_fingerprint text not null,
  before_players jsonb not null,
  after_players jsonb not null,
  decision jsonb not null,
  created_at timestamptz not null default now()
);
alter table public.player_merge_audit enable row level security;
revoke all on public.player_merge_audit from public, anon, authenticated;
grant select, insert on public.player_merge_audit to service_role;

-- An import does not supply these columns. Ordinary direct table writers cannot
-- bypass the reviewed service-side operation to change identity links.
create function public.protect_player_identity_assignment()
returns trigger language plpgsql set search_path = public as $$
begin
  if auth.uid() is not null and coalesce(auth.role(), '') <> 'service_role'
    and ((tg_op = 'INSERT' and (new.merged_into_player_id is not null or new.canonical_display_name is not null))
      or (tg_op = 'UPDATE' and (new.merged_into_player_id is distinct from old.merged_into_player_id
        or new.canonical_display_name is distinct from old.canonical_display_name))) then
    raise exception 'Player identity links must be changed through the admin merge action.';
  end if;
  return new;
end;
$$;
create trigger protect_player_identity_assignment before insert or update on public.players
for each row execute function public.protect_player_identity_assignment();

create function public.player_identity_members(p_ids uuid[])
returns uuid[] language sql stable security definer set search_path = public as $$
  with recursive edges as (
    select id as a, merged_into_player_id as b from public.players where merged_into_player_id is not null
    union all
    select merged_into_player_id, id from public.players where merged_into_player_id is not null
  ), members(id) as (
    select unnest(p_ids)
    union
    select edge.b from edges edge join members member on member.id = edge.a
  )
  select coalesce(array_agg(id order by id), '{}'::uuid[]) from members;
$$;
revoke all on function public.player_identity_members(uuid[]) from public, anon, authenticated;

create function public.player_merge_counts(p_ids uuid[])
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'players', cardinality(p_ids),
    'memberships', (select count(*) from public.roster_memberships where player_id = any(p_ids)),
    'fieldAppearances', (select count(*) from public.player_game_stats where player_id = any(p_ids) and games_played > 0),
    'goalieAppearances', (select count(*) from public.goalie_game_stats where player_id = any(p_ids) and games_played > 0),
    'seasonRows', (select count(*) from public.player_season_stats where player_id = any(p_ids))
      + (select count(*) from public.goalie_season_stats where player_id = any(p_ids)),
    'approvedClaims', (select count(*) from public.member_player_claims where player_id = any(p_ids) and status = 'approved')
  );
$$;
revoke all on function public.player_merge_counts(uuid[]) from public, anon, authenticated;

-- Resolve each field independently. A timestamped null is an intentional clear.
-- The chosen record breaks ties between unassigned imported values.
create function public.player_merge_fields(p_ids uuid[], p_preferred_id uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  with number_values as (
    select jersey_number as value, jersey_number_updated_at as assigned_at,
      (id = p_preferred_id) as preferred, 0 as fallback, updated_at, id::text as stable_id
    from public.players
    where id = any(p_ids) and (jersey_number_updated_at is not null or jersey_number is not null)
    union all
    select jersey_number, null::timestamptz, false, 1, updated_at, id::text
    from public.roster_memberships where player_id = any(p_ids) and jersey_number is not null
  ), position_values as (
    select primary_position as value, primary_position_updated_at as assigned_at,
      (id = p_preferred_id) as preferred, 0 as fallback, updated_at, id::text as stable_id
    from public.players
    where id = any(p_ids) and (primary_position_updated_at is not null or primary_position is not null)
    union all
    select position, null::timestamptz, false, 1, updated_at, id::text
    from public.roster_memberships where player_id = any(p_ids) and position is not null
  )
  select jsonb_build_object(
    'jerseyNumber', (select jsonb_build_object('value', value, 'assigned', assigned_at is not null)
      from number_values order by assigned_at desc nulls last, preferred desc, fallback, updated_at desc, stable_id limit 1),
    'primaryPosition', (select jsonb_build_object('value', value, 'assigned', assigned_at is not null)
      from position_values order by assigned_at desc nulls last, preferred desc, fallback, updated_at desc, stable_id limit 1)
  );
$$;
revoke all on function public.player_merge_fields(uuid[], uuid) from public, anon, authenticated;

create function public.preview_player_merge(
  p_actor_id uuid, p_source_ids uuid[], p_target_ids uuid[],
  p_target_id uuid, p_target_display_name text
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  source_ids uuid[];
  target_ids uuid[];
  all_ids uuid[];
  blockers jsonb := '[]'::jsonb;
  source_fields jsonb;
  target_fields jsonb;
  fields jsonb := '{}'::jsonb;
  field_name text;
  source_value jsonb;
  target_value jsonb;
  fingerprint_data jsonb;
  overlap_count integer;
begin
  if not public.is_team_admin(p_actor_id) then raise exception 'Admin access is required.'; end if;
  -- Keep the displayed counts/field choices and their fingerprint on one stable
  -- data state, including under READ COMMITTED while an import is finishing.
  lock table public.players, public.roster_memberships, public.games,
    public.player_game_stats, public.goalie_game_stats, public.player_season_stats,
    public.goalie_season_stats, public.member_player_claims in share mode;
  if p_source_ids is null or p_target_ids is null
    or cardinality(p_source_ids) = 0 or cardinality(p_target_ids) = 0
    or array_position(p_source_ids, null) is not null or array_position(p_target_ids, null) is not null then
    raise exception 'Select two complete player identities.';
  end if;
  select array_agg(id order by id) into source_ids from (select distinct unnest(p_source_ids) id) ids;
  select array_agg(id order by id) into target_ids from (select distinct unnest(p_target_ids) id) ids;
  if source_ids && target_ids then raise exception 'These records already belong to the same player.'; end if;
  if p_target_id is null or not p_target_id = any(target_ids) then
    raise exception 'The remaining player must belong to the selected target identity.';
  end if;
  if p_target_display_name is null or length(trim(p_target_display_name)) not between 1 and 120 then
    raise exception 'The remaining player needs a name of 1 to 120 characters.';
  end if;
  all_ids := source_ids || target_ids;
  if (select count(*) from public.players where id = any(all_ids)) <> cardinality(all_ids) then
    raise exception 'One of these player records no longer exists. Refresh the player directory.';
  end if;
  if public.player_identity_members(source_ids) is distinct from source_ids
    or public.player_identity_members(target_ids) is distinct from target_ids then
    raise exception 'These player links changed. Refresh the player directory before merging.';
  end if;

  if (select count(distinct user_id) from public.member_player_claims
      where player_id = any(all_ids) and status = 'approved') > 1 then
    blockers := blockers || jsonb_build_array(jsonb_build_object('code', 'different_account_owners',
      'message', 'These players are linked to different approved member accounts. Resolve those account links before merging.'));
  end if;

  with appearances as (
    select player_id, game_id from public.player_game_stats where player_id = any(all_ids) and games_played > 0
    union
    select player_id, game_id from public.goalie_game_stats where player_id = any(all_ids) and games_played > 0
  )
  select count(*) into overlap_count from (
    select game_id from appearances group by game_id having count(distinct player_id) > 1
  ) overlapping_games;
  if overlap_count > 0 then
    blockers := blockers || jsonb_build_array(jsonb_build_object('code', 'shared_game_appearances',
      'message', format('The selected records appear separately in %s of the same games. Review those statistics before merging to avoid counting a game twice.', overlap_count)));
  end if;

  -- Positive season totals in a shared scope need complete, disjoint game logs.
  -- Without those logs, two league summaries might describe the same games.
  with season_lines as (
    select 'field' as kind, player_id, season_team_id, stage, games_played
    from public.player_season_stats where player_id = any(all_ids) and games_played > 0
    union all
    select 'goalie', player_id, season_team_id, stage, games_played
    from public.goalie_season_stats where player_id = any(all_ids) and games_played > 0
  ), shared_scopes as (
    select kind, season_team_id, stage from season_lines group by kind, season_team_id, stage
    having count(distinct player_id) > 1
  ), game_counts as (
    select 'field' as kind, line.player_id, game.season_team_id, game.stage, count(*) as appearances
    from public.player_game_stats line join public.games game on game.id = line.game_id
    where line.player_id = any(all_ids) and line.games_played > 0
    group by line.player_id, game.season_team_id, game.stage
    union all
    select 'goalie', line.player_id, game.season_team_id, game.stage, count(*)
    from public.goalie_game_stats line join public.games game on game.id = line.game_id
    where line.player_id = any(all_ids) and line.games_played > 0
    group by line.player_id, game.season_team_id, game.stage
  )
  select count(*) into overlap_count from season_lines line
    join shared_scopes scope using (kind, season_team_id, stage)
    left join game_counts games using (kind, player_id, season_team_id, stage)
    where coalesce(games.appearances, 0) <> line.games_played;
  if overlap_count > 0 then
    blockers := blockers || jsonb_build_array(jsonb_build_object('code', 'unverified_season_overlap',
      'message', 'These records have totals in the same season, but their game histories do not fully explain those totals. Review the overlapping statistics before merging.'));
  end if;

  source_fields := public.player_merge_fields(source_ids, source_ids[1]);
  target_fields := public.player_merge_fields(target_ids, p_target_id);
  foreach field_name in array array['jerseyNumber', 'primaryPosition'] loop
    source_value := source_fields -> field_name;
    target_value := target_fields -> field_name;
    fields := fields || jsonb_build_object(field_name, jsonb_build_object(
      'source', source_value -> 'value', 'target', target_value -> 'value',
      'suggested', case when target_value is not null and target_value <> 'null'::jsonb
        then target_value -> 'value' else source_value -> 'value' end,
      'sourceAssigned', coalesce((source_value ->> 'assigned')::boolean, false),
      'targetAssigned', coalesce((target_value ->> 'assigned')::boolean, false),
      'conflict', source_value is not null and source_value <> 'null'::jsonb
        and target_value is not null and target_value <> 'null'::jsonb
        and (source_value -> 'value') is distinct from (target_value -> 'value')
    ));
  end loop;

  -- Hash full relevant rows, not just counts: a changed goal, number, claim,
  -- roster entry, or identity link must invalidate an open confirmation dialog.
  select jsonb_build_object(
    'sourceIds', source_ids, 'targetIds', target_ids, 'targetId', p_target_id,
    'targetName', trim(p_target_display_name),
    'players', (select jsonb_agg(to_jsonb(row) order by row.id) from public.players row where row.id = any(all_ids)),
    'memberships', (select jsonb_agg(to_jsonb(row) order by row.id) from public.roster_memberships row where row.player_id = any(all_ids)),
    'fieldGames', (select jsonb_agg(to_jsonb(row) order by row.id) from public.player_game_stats row where row.player_id = any(all_ids)),
    'goalieGames', (select jsonb_agg(to_jsonb(row) order by row.id) from public.goalie_game_stats row where row.player_id = any(all_ids)),
    'fieldSeasons', (select jsonb_agg(to_jsonb(row) order by row.id) from public.player_season_stats row where row.player_id = any(all_ids)),
    'goalieSeasons', (select jsonb_agg(to_jsonb(row) order by row.id) from public.goalie_season_stats row where row.player_id = any(all_ids)),
    'games', (select jsonb_agg(to_jsonb(game) order by game.id) from public.games game
      where game.id in (select game_id from public.player_game_stats where player_id = any(all_ids)
        union select game_id from public.goalie_game_stats where player_id = any(all_ids))),
    'claims', (select jsonb_agg(to_jsonb(row) order by row.user_id, row.player_id) from public.member_player_claims row where row.player_id = any(all_ids))
  ) into fingerprint_data;
  return jsonb_build_object(
    'sourceIds', source_ids, 'targetIds', target_ids, 'targetId', p_target_id,
    'targetName', trim(p_target_display_name), 'fingerprint', md5(fingerprint_data::text),
    'counts', jsonb_build_object('source', public.player_merge_counts(source_ids),
      'target', public.player_merge_counts(target_ids), 'combined', public.player_merge_counts(all_ids)),
    'fields', fields, 'blockers', blockers, 'canMerge', jsonb_array_length(blockers) = 0
  );
end;
$$;
revoke all on function public.preview_player_merge(uuid, uuid[], uuid[], uuid, text) from public, anon, authenticated;
grant execute on function public.preview_player_merge(uuid, uuid[], uuid[], uuid, text) to service_role;

create function public.merge_players(
  p_actor_id uuid, p_source_ids uuid[], p_target_ids uuid[],
  p_target_id uuid, p_target_display_name text, p_preview_fingerprint text,
  p_jersey_number text, p_primary_position text
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  preview jsonb;
  all_ids uuid[];
  before_rows jsonb;
  after_rows jsonb;
  merge_id uuid;
  stamp timestamptz;
  normalized_number text := nullif(trim(p_jersey_number), '');
  normalized_position text := nullif(upper(trim(p_primary_position)), '');
begin
  if not public.is_team_admin(p_actor_id) then raise exception 'Admin access is required.'; end if;
  if normalized_number is not null and normalized_number !~ '^[0-9]{1,3}$' then
    raise exception 'Player number must use up to three digits.';
  end if;
  if normalized_position is not null and normalized_position not in ('G', 'D', 'C', 'W') then
    raise exception 'Player position must be G, D, C, or W.';
  end if;
  -- Rare administrative operation: hold a short, consistent write boundary over
  -- imports, claims and stats until validation and the directed-link update end.
  lock table public.players, public.roster_memberships, public.games,
    public.player_game_stats, public.goalie_game_stats, public.player_season_stats,
    public.goalie_season_stats, public.member_player_claims in share row exclusive mode;
  preview := public.preview_player_merge(p_actor_id, p_source_ids, p_target_ids, p_target_id, p_target_display_name);
  if p_preview_fingerprint is null or p_preview_fingerprint is distinct from preview ->> 'fingerprint' then
    raise exception 'Player information changed since this preview. Review a fresh preview before merging.';
  end if;
  if not (preview ->> 'canMerge')::boolean then
    raise exception '%', preview #>> '{blockers,0,message}';
  end if;
  select array_agg(id order by id) into all_ids from (
    select distinct unnest(p_source_ids || p_target_ids) id
  ) ids;
  select jsonb_agg(to_jsonb(player) order by id),
    greatest(clock_timestamp(), max(jersey_number_updated_at) + interval '1 microsecond',
      max(primary_position_updated_at) + interval '1 microsecond')
    into before_rows, stamp from public.players player where id = any(all_ids);
  -- Clear the selected survivor first, which permits choosing an existing alias
  -- as the new survivor without creating a temporary directed cycle.
  update public.players set merged_into_player_id = null,
    canonical_display_name = trim(p_target_display_name),
    jersey_number = normalized_number, jersey_number_updated_at = stamp,
    primary_position = normalized_position, primary_position_updated_at = stamp,
    active = exists(select 1 from public.players where id = any(all_ids) and active),
    updated_at = stamp
  where id = p_target_id;
  update public.players set merged_into_player_id = p_target_id,
    canonical_display_name = null, updated_at = stamp
  where id = any(all_ids) and id <> p_target_id;
  select jsonb_agg(to_jsonb(player) order by id) into after_rows
  from public.players player where id = any(all_ids);
  insert into public.player_merge_audit(actor_id, target_player_id, source_player_ids,
    target_player_ids, preview_fingerprint, before_players, after_players, decision)
  values (p_actor_id, p_target_id, p_source_ids, p_target_ids, p_preview_fingerprint,
    before_rows, after_rows, preview || jsonb_build_object('jerseyNumber', normalized_number,
      'primaryPosition', normalized_position)) returning id into merge_id;
  return preview || jsonb_build_object('mergeId', merge_id, 'merged', true);
end;
$$;
revoke all on function public.merge_players(uuid, uuid[], uuid[], uuid, text, text, text, text) from public, anon, authenticated;
grant execute on function public.merge_players(uuid, uuid[], uuid[], uuid, text, text, text, text) to service_role;

-- Keep subsequent account approvals consistent across aliases. The advisory
-- lock serializes competing approvals; the merge transaction also locks claims.
create function public.protect_merged_player_claim_owner()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  identity_ids uuid[];
begin
  if new.status <> 'approved' then return new; end if;
  identity_ids := public.player_identity_members(array[new.player_id]);
  perform pg_advisory_xact_lock(hashtextextended('player-claim:' || identity_ids[1]::text, 0));
  if exists(select 1 from public.member_player_claims
    where player_id = any(identity_ids) and status = 'approved' and user_id <> new.user_id) then
    raise exception 'This player identity is already linked to another approved member account.';
  end if;
  return new;
end;
$$;
revoke all on function public.protect_merged_player_claim_owner() from public, anon, authenticated;
create trigger protect_merged_player_claim_owner before insert or update on public.member_player_claims
for each row execute function public.protect_merged_player_claim_owner();

drop function public.list_public_player_avatars();
create function public.list_public_player_avatars()
returns table (
  player_id uuid, external_id text, avatar_url text, jersey_number text,
  primary_position text, jersey_number_updated_at timestamptz,
  primary_position_updated_at timestamptz, display_name text, source_url text,
  canonical_display_name text, merged_into_player_id uuid,
  merged_into_external_id text, merged_into_display_name text, merged_into_source_url text
)
language sql stable security definer set search_path = public as $$
  with identities as (
    select player.*, coalesce(player.merged_into_player_id, player.id) as identity_id
    from public.players player
  ), visible_identities as (
    select distinct player.identity_id
    from identities player
    join public.roster_memberships membership on membership.player_id = player.id
    join public.season_teams team on team.id = membership.season_team_id
    join public.seasons season on season.id = team.season_id
    where coalesce((to_jsonb(team)->>'is_visible')::boolean, true) and season.is_visible
  )
  select player.id, player.external_id, photo.avatar_url,
    player.jersey_number, player.primary_position, player.jersey_number_updated_at,
    player.primary_position_updated_at, player.display_name, player.source_url,
    player.canonical_display_name, player.merged_into_player_id,
    target.external_id, coalesce(target.canonical_display_name, target.display_name), target.source_url
  from identities player
  join visible_identities visible on visible.identity_id = player.identity_id
  left join public.players target on target.id = player.merged_into_player_id
  left join lateral (
    select profile.avatar_url from identities alias
    join public.member_player_claims claim on claim.player_id = alias.id and claim.status = 'approved'
    join public.profiles profile on profile.id = claim.user_id
    where alias.identity_id = player.identity_id and nullif(trim(profile.avatar_url), '') is not null
    order by (alias.id = player.identity_id) desc, claim.linked_at, alias.id limit 1
  ) photo on true;
$$;
revoke all on function public.list_public_player_avatars() from public;
grant execute on function public.list_public_player_avatars() to anon, authenticated, service_role;
