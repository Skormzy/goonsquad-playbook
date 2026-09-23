-- Run as the migration/database owner. All fixtures and audit entries roll back.
-- Existing account profiles are read only to exercise approved-link ownership.
begin;

set local role anon;
do $$
declare rejected boolean;
begin
  rejected := false;
  begin perform public.preview_player_merge(null, null, null, null, null);
  exception when insufficient_privilege then rejected := true; end;
  if not rejected then raise exception 'Anonymous clients must not execute merge previews.'; end if;
  rejected := false;
  begin perform public.merge_players(null, null, null, null, null, null, null, null);
  exception when insufficient_privilege then rejected := true; end;
  if not rejected then raise exception 'Anonymous clients must not execute player merges.'; end if;
  rejected := false;
  begin perform 1 from public.player_merge_audit limit 1;
  exception when insufficient_privilege then rejected := true; end;
  if not rejected then raise exception 'Anonymous clients must not read merge audits.'; end if;
  perform count(*) from public.list_public_player_avatars();
end;
$$;
reset role;

set local role authenticated;
do $$
declare rejected boolean;
begin
  rejected := false;
  begin perform public.preview_player_merge(null, null, null, null, null);
  exception when insufficient_privilege then rejected := true; end;
  if not rejected then raise exception 'Authenticated clients must not execute merge previews directly.'; end if;
  rejected := false;
  begin perform public.merge_players(null, null, null, null, null, null, null, null);
  exception when insufficient_privilege then rejected := true; end;
  if not rejected then raise exception 'Authenticated clients must not execute player merges directly.'; end if;
  rejected := false;
  begin perform 1 from public.player_merge_audit limit 1;
  exception when insufficient_privilege then rejected := true; end;
  if not rejected then raise exception 'Authenticated clients must not read merge audits.'; end if;
end;
$$;
reset role;

create function pg_temp.expect_merge_error(p_query text, p_message text)
returns void language plpgsql as $$
begin
  begin
    execute p_query;
  exception when others then
    if position(p_message in sqlerrm) = 0 then
      raise exception 'Expected error containing %, received %', p_message, sqlerrm;
    end if;
    return;
  end;
  raise exception 'Expected operation to fail: %', p_message;
end;
$$;

set local role service_role;
do $$
declare
  admin_id uuid;
  other_user_id uuid;
  source_id uuid := gen_random_uuid();
  old_target_id uuid := gen_random_uuid();
  target_id uuid := gen_random_uuid();
  next_source_id uuid := gen_random_uuid();
  shared_source_id uuid := gen_random_uuid();
  shared_target_id uuid := gen_random_uuid();
  stale_source_id uuid := gen_random_uuid();
  stale_target_id uuid := gen_random_uuid();
  visible_season text := 'merge-regression-' || gen_random_uuid()::text;
  hidden_season text := 'merge-regression-' || gen_random_uuid()::text;
  team_id text := 'merge-regression-' || gen_random_uuid()::text;
  hidden_team_id text := 'merge-regression-' || gen_random_uuid()::text;
  first_game uuid := gen_random_uuid();
  second_game uuid := gen_random_uuid();
  goalie_game uuid := gen_random_uuid();
  preview jsonb;
  result jsonb;
  original_stats jsonb;
  actual_stats jsonb;
  actual public.players%rowtype;
  avatar text;
begin
  select id into admin_id from public.profiles where role = 'admin' order by id limit 1;
  select id into other_user_id from public.profiles where id <> admin_id order by id limit 1;
  if admin_id is null or other_user_id is null then
    raise exception 'Regression prerequisite: an admin and another existing profile are required.';
  end if;
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claims', '{}', true);

  if has_function_privilege('anon', 'public.preview_player_merge(uuid,uuid[],uuid[],uuid,text)', 'execute')
    or has_function_privilege('authenticated', 'public.merge_players(uuid,uuid[],uuid[],uuid,text,text,text,text)', 'execute')
    or not has_function_privilege('service_role', 'public.merge_players(uuid,uuid[],uuid[],uuid,text,text,text,text)', 'execute')
    or has_table_privilege('anon', 'public.player_merge_audit', 'select')
    or has_table_privilege('authenticated', 'public.player_merge_audit', 'select') then
    raise exception 'Merge operations and audit history must be private to the service role.';
  end if;

  insert into public.seasons(id, slug, name, is_visible) values
    (visible_season, visible_season, 'Rollback merge visible season', true),
    (hidden_season, hidden_season, 'Rollback merge hidden season', false);
  insert into public.season_teams(id, season_id, name, schedule_label) values
    (team_id, visible_season, 'Rollback merge visible team', 'TEST'),
    (hidden_team_id, hidden_season, 'Rollback merge hidden team', 'TEST');
  insert into public.players(id, display_name, jersey_number, jersey_number_updated_at,
    primary_position, primary_position_updated_at, merged_into_player_id) values
    (source_id, 'Rollback misspelled player', '99', '2020-01-01', 'G', '2020-01-01', null),
    (old_target_id, 'Rollback former target', '22', '2000-01-01', 'C', '2000-01-01', null),
    (target_id, 'Rollback correct spelling', null, '2001-01-01', 'D', '2001-01-01', old_target_id),
    (next_source_id, 'Rollback next alias', '8', null, 'W', null, null),
    (shared_source_id, 'Rollback shared game source', null, null, null, null, null),
    (shared_target_id, 'Rollback shared game target', null, null, null, null, null),
    (stale_source_id, 'Rollback stale source', null, null, null, null, null),
    (stale_target_id, 'Rollback stale target', null, null, null, null, null);
  insert into public.roster_memberships(season_team_id, player_id, notes) values
    (team_id, source_id, 'Source roster note remains intact'),
    (hidden_team_id, old_target_id, 'Target roster note remains intact');
  insert into public.games(id, season_team_id, scheduled_at, opponent, status) values
    (first_game, team_id, '2001-01-01', 'Rollback one', 'final'),
    (second_game, team_id, '2001-01-02', 'Rollback two', 'final'),
    (goalie_game, team_id, '2001-01-03', 'Rollback three', 'final');
  insert into public.player_game_stats(game_id, player_id, goals, assists) values
    (first_game, source_id, 2, 1), (second_game, old_target_id, 3, 4);
  insert into public.goalie_game_stats(game_id, player_id, wins, shots_against, saves, goals_against, minutes_played)
  values (goalie_game, source_id, 1, 12, 10, 2, 30);
  insert into public.player_season_stats(season_team_id, player_id, games_played, goals, assists, points) values
    (team_id, source_id, 1, 2, 1, 3), (team_id, old_target_id, 1, 3, 4, 7);
  insert into public.goalie_season_stats(season_team_id, player_id, games_played, wins, shots_against, goals_against, minutes_played)
  values (team_id, source_id, 1, 1, 12, 2, 30);
  insert into public.member_player_claims(user_id, player_id, status, is_primary)
  values (admin_id, source_id, 'approved', false), (other_user_id, old_target_id, 'approved', false);
  if exists(select 1 from public.list_public_player_avatars() where player_id in (old_target_id,target_id)) then
    raise exception 'The public metadata RPC must not expose an entirely hidden identity.';
  end if;

  preview := public.preview_player_merge(admin_id, array[source_id], array[old_target_id,target_id], target_id, 'Correct survivor');
  if (preview ->> 'canMerge')::boolean or not preview -> 'blockers' @> '[{"code":"different_account_owners"}]'::jsonb then
    raise exception 'Different approved account owners must block a merge.';
  end if;
  delete from public.member_player_claims where user_id = other_user_id and player_id = old_target_id;

  preview := public.preview_player_merge(admin_id, array[source_id], array[old_target_id,target_id], target_id, 'Correct survivor');
  if not (preview ->> 'canMerge')::boolean
    or (preview #>> '{counts,combined,fieldAppearances}')::integer <> 2
    or (preview #>> '{counts,combined,goalieAppearances}')::integer <> 1
    or (preview #>> '{counts,combined,seasonRows}')::integer <> 3
    or (preview #>> '{counts,combined,memberships}')::integer <> 2
    or (preview #>> '{counts,combined,approvedClaims}')::integer <> 1
    or preview #> '{fields,jerseyNumber,suggested}' <> 'null'::jsonb
    or preview #>> '{fields,primaryPosition,suggested}' <> 'D'
    or not (preview #>> '{fields,jerseyNumber,conflict}')::boolean then
    raise exception 'Preview must combine exact counts and preserve target explicit clears and position.';
  end if;

  perform pg_temp.expect_merge_error(format('select public.preview_player_merge(%L,%L::uuid[],%L::uuid[],%L,%L)',
    gen_random_uuid(), array[source_id], array[old_target_id,target_id], target_id, 'Correct survivor'), 'Admin access is required');
  perform pg_temp.expect_merge_error(format('select public.preview_player_merge(%L,%L::uuid[],%L::uuid[],%L,%L)',
    admin_id, '{}'::uuid[], array[old_target_id,target_id], target_id, 'Correct survivor'), 'Select two complete');
  perform pg_temp.expect_merge_error(format('select public.preview_player_merge(%L,%L::uuid[],%L::uuid[],%L,%L)',
    admin_id, array[source_id], array[gen_random_uuid()], target_id, 'Correct survivor'), 'remaining player must belong');
  perform pg_temp.expect_merge_error(format('select public.preview_player_merge(%L,%L::uuid[],%L::uuid[],%L,%L)',
    admin_id, array[gen_random_uuid()], array[old_target_id,target_id], target_id, 'Correct survivor'), 'no longer exists');
  perform pg_temp.expect_merge_error(format('select public.preview_player_merge(%L,%L::uuid[],%L::uuid[],%L,%L)',
    admin_id, array[source_id], array[target_id], target_id, 'Correct survivor'), 'player links changed');
  perform pg_temp.expect_merge_error(format('select public.preview_player_merge(%L,%L::uuid[],%L::uuid[],%L,%L)',
    admin_id, array[source_id], array[source_id], source_id, 'Correct survivor'), 'same player');
  perform pg_temp.expect_merge_error(format('select public.merge_players(%L,%L::uuid[],%L::uuid[],%L,%L,%L,%L,%L)',
    admin_id, array[source_id], array[old_target_id,target_id], target_id, 'Correct survivor', preview ->> 'fingerprint', '1000', 'D'), 'three digits');
  perform pg_temp.expect_merge_error(format('select public.merge_players(%L,%L::uuid[],%L::uuid[],%L,%L,%L,%L,%L)',
    admin_id, array[source_id], array[old_target_id,target_id], target_id, 'Correct survivor', preview ->> 'fingerprint', null, 'BAD'), 'G, D, C, or W');

  select jsonb_build_object(
    'field', (select jsonb_agg(to_jsonb(line) order by id) from public.player_game_stats line where player_id in (source_id,old_target_id)),
    'goalie', (select jsonb_agg(to_jsonb(line) order by id) from public.goalie_game_stats line where player_id = source_id),
    'fieldSeasons', (select jsonb_agg(to_jsonb(line) order by id) from public.player_season_stats line where player_id in (source_id,old_target_id)),
    'goalieSeasons', (select jsonb_agg(to_jsonb(line) order by id) from public.goalie_season_stats line where player_id = source_id),
    'roster', (select jsonb_agg(to_jsonb(line) order by id) from public.roster_memberships line where player_id in (source_id,old_target_id)),
    'claims', (select jsonb_agg(to_jsonb(line) order by player_id) from public.member_player_claims line where player_id = source_id)
  ) into original_stats;
  result := public.merge_players(admin_id, array[source_id], array[old_target_id,target_id], target_id,
    'Correct survivor', preview ->> 'fingerprint', null, 'D');
  select * into actual from public.players where id = target_id;
  if not (result ->> 'merged')::boolean or actual.merged_into_player_id is not null
    or actual.canonical_display_name <> 'Correct survivor' or actual.jersey_number is not null
    or actual.primary_position <> 'D' or actual.jersey_number_updated_at <= '2020-01-01'::timestamptz
    or (select count(*) from public.players where id in (source_id,old_target_id) and merged_into_player_id = target_id) <> 2
    or not exists(select 1 from public.player_merge_audit where id = (result ->> 'mergeId')::uuid
      and jsonb_array_length(before_players) = 3 and jsonb_array_length(after_players) = 3) then
    raise exception 'Merge must flatten both identities, preserve the survivor, stamp choices and record reversible audit data.';
  end if;
  select jsonb_build_object(
    'field', (select jsonb_agg(to_jsonb(line) order by id) from public.player_game_stats line where player_id in (source_id,old_target_id)),
    'goalie', (select jsonb_agg(to_jsonb(line) order by id) from public.goalie_game_stats line where player_id = source_id),
    'fieldSeasons', (select jsonb_agg(to_jsonb(line) order by id) from public.player_season_stats line where player_id in (source_id,old_target_id)),
    'goalieSeasons', (select jsonb_agg(to_jsonb(line) order by id) from public.goalie_season_stats line where player_id = source_id),
    'roster', (select jsonb_agg(to_jsonb(line) order by id) from public.roster_memberships line where player_id in (source_id,old_target_id)),
    'claims', (select jsonb_agg(to_jsonb(line) order by player_id) from public.member_player_claims line where player_id = source_id)
  ) into actual_stats;
  if actual_stats is distinct from original_stats then
    raise exception 'Merging must preserve every original statistic, roster note and approved claim byte for byte.';
  end if;
  if (select count(*) from public.list_public_player_avatars() where player_id in (source_id,old_target_id,target_id)) <> 3
    or not exists(select 1 from public.list_public_player_avatars()
      where player_id = source_id and merged_into_player_id = target_id and merged_into_display_name = 'Correct survivor') then
    raise exception 'A visible alias must expose the complete identity and chosen survivor metadata.';
  end if;
  select avatar_url into avatar from public.profiles where id = admin_id;
  if nullif(trim(avatar), '') is not null and not exists(select 1 from public.list_public_player_avatars()
    where player_id = target_id and avatar_url = avatar) then
    raise exception 'The source approved account photo must remain visible on the survivor.';
  end if;
  update public.players set display_name = 'Imported typo again', jersey_number = '3', primary_position = 'W' where id = target_id;
  select * into actual from public.players where id = target_id;
  if actual.canonical_display_name <> 'Correct survivor' or actual.primary_position <> 'D' then
    raise exception 'A subsequent import must preserve canonical spelling and assigned position.';
  end if;

  -- A later merge may choose a former alias; every inbound link must flatten.
  preview := public.preview_player_merge(admin_id, array[next_source_id], array[source_id,old_target_id,target_id], old_target_id, 'Next survivor');
  perform public.merge_players(admin_id, array[next_source_id], array[source_id,old_target_id,target_id], old_target_id,
    'Next survivor', preview ->> 'fingerprint', '007', 'W');
  if (select count(*) from public.players where id in (source_id,target_id,next_source_id) and merged_into_player_id = old_target_id) <> 3
    or not exists(select 1 from public.players where id = old_target_id and merged_into_player_id is null and jersey_number = '007') then
    raise exception 'Repeated merges must flatten every prior alias into the newly selected survivor.';
  end if;
  perform pg_temp.expect_merge_error(format('insert into public.member_player_claims(user_id,player_id,status,is_primary) values(%L,%L,''approved'',false)',
    other_user_id, next_source_id), 'another approved member account');
  insert into public.member_player_claims(user_id,player_id,status,is_primary) values(admin_id,next_source_id,'approved',false);

  -- Field and goalie appearances in the same game cannot be double-counted.
  insert into public.player_game_stats(game_id, player_id) values(first_game,shared_source_id);
  insert into public.goalie_game_stats(game_id, player_id) values(first_game,shared_target_id);
  preview := public.preview_player_merge(admin_id,array[shared_source_id],array[shared_target_id],shared_target_id,'Shared target');
  if not preview -> 'blockers' @> '[{"code":"shared_game_appearances"}]'::jsonb then
    raise exception 'Same-game field and goalie aliases must be blocked.';
  end if;
  delete from public.player_game_stats where player_id = shared_source_id;
  delete from public.goalie_game_stats where player_id = shared_target_id;
  insert into public.player_season_stats(season_team_id,player_id,games_played) values
    (team_id,shared_source_id,1),(team_id,shared_target_id,1);
  preview := public.preview_player_merge(admin_id,array[shared_source_id],array[shared_target_id],shared_target_id,'Shared target');
  if not preview -> 'blockers' @> '[{"code":"unverified_season_overlap"}]'::jsonb then
    raise exception 'Unexplained overlapping season totals must be blocked.';
  end if;
  update public.player_season_stats set games_played = 0 where player_id in (shared_source_id,shared_target_id);
  preview := public.preview_player_merge(admin_id,array[shared_source_id],array[shared_target_id],shared_target_id,'Shared target');
  if not (preview ->> 'canMerge')::boolean then raise exception 'Empty season placeholders must not block merging.'; end if;

  preview := public.preview_player_merge(admin_id,array[stale_source_id],array[stale_target_id],stale_target_id,'Stale target');
  update public.players set jersey_number = '4' where id = stale_source_id;
  perform pg_temp.expect_merge_error(format('select public.merge_players(%L,%L::uuid[],%L::uuid[],%L,%L,%L,%L,%L)',
    admin_id,array[stale_source_id],array[stale_target_id],stale_target_id,'Stale target',preview ->> 'fingerprint',null,null), 'changed since this preview');
  if exists(select 1 from public.players where id = stale_source_id and merged_into_player_id is not null) then
    raise exception 'A stale confirmation must make no changes.';
  end if;
  preview := public.preview_player_merge(admin_id,array[stale_source_id],array[stale_target_id],stale_target_id,'Stale target');
  if preview #>> '{fields,jerseyNumber,suggested}' <> '4' then
    raise exception 'A source number must fill an unassigned target field.';
  end if;
  insert into public.player_game_stats(game_id,player_id,goals) values(first_game,stale_source_id,1);
  preview := public.preview_player_merge(admin_id,array[stale_source_id],array[stale_target_id],stale_target_id,'Stale target');
  update public.player_game_stats set goals = 2 where player_id = stale_source_id;
  perform pg_temp.expect_merge_error(format('select public.merge_players(%L,%L::uuid[],%L::uuid[],%L,%L,%L,%L,%L)',
    admin_id,array[stale_source_id],array[stale_target_id],stale_target_id,'Stale target',preview ->> 'fingerprint','4',null), 'changed since this preview');

  perform set_config('request.jwt.claim.sub', admin_id::text, true);
  perform set_config('request.jwt.claims', jsonb_build_object('sub',admin_id,'role','authenticated')::text, true);
  perform pg_temp.expect_merge_error(format('update public.players set merged_into_player_id = %L where id = %L',
    stale_target_id,stale_source_id), 'admin merge action');
  raise notice 'Player identity merge regressions passed; rolling back all fixtures and merge audits.';
end;
$$;
reset role;

rollback;
