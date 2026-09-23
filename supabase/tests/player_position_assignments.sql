-- Run as the migration/database owner after migration 202609230003.
-- Every write targets a new synthetic player and is rolled back. Existing
-- profiles are read only to select an admin context; no profile data is output.
-- Use one successful RPC save per synthetic row: now() is transaction-stable.
begin;

do $$
declare
  test_admin_id uuid;
  test_unlinked_id uuid := gen_random_uuid();
  imported_id uuid := gen_random_uuid();
  assigned_id uuid := gen_random_uuid();
  cleared_id uuid := gen_random_uuid();
  clear_null_position_id uuid := gen_random_uuid();
  clear_null_number_id uuid := gen_random_uuid();
  changed_position_id uuid := gen_random_uuid();
  legacy_call_id uuid := gen_random_uuid();
  denied_id uuid := gen_random_uuid();
  initial_marker timestamptz := '2001-01-01T00:00:00Z';
  changed_marker timestamptz := '2002-01-01T00:00:00Z';
  actual public.players%rowtype;
  rejected boolean;
begin
  select id into test_admin_id
  from public.profiles
  where role = 'admin'
  order by id
  limit 1;
  if test_admin_id is null then
    raise exception 'Regression prerequisite: an existing admin profile is required.';
  end if;
  -- Keep the unlinked authorization probe independent of existing identities.
  while exists (select 1 from public.profiles where id = test_unlinked_id) loop
    test_unlinked_id := gen_random_uuid();
  end loop;

  insert into public.players (id, display_name, primary_position)
  values (imported_id, 'Rollback regression: imported position', 'C');
  update public.players set primary_position = 'W' where id = imported_id;
  select * into strict actual from public.players where id = imported_id;
  if actual.primary_position is distinct from 'W'
    or actual.primary_position_updated_at is not null then
    raise exception 'Unedited player positions must still accept imported updates.';
  end if;

  insert into public.players (id, display_name, primary_position, primary_position_updated_at)
  values (assigned_id, 'Rollback regression: assigned position', 'D', initial_marker);
  update public.players set primary_position = 'W' where id = assigned_id;
  select * into strict actual from public.players where id = assigned_id;
  if actual.primary_position is distinct from 'D'
    or actual.primary_position_updated_at is distinct from initial_marker then
    raise exception 'An import must preserve an explicit position assignment and marker.';
  end if;

  insert into public.players (id, display_name, primary_position, primary_position_updated_at)
  values (cleared_id, 'Rollback regression: cleared position', null, initial_marker);
  update public.players set primary_position = 'G' where id = cleared_id;
  select * into strict actual from public.players where id = cleared_id;
  if actual.primary_position is not null
    or actual.primary_position_updated_at is distinct from initial_marker then
    raise exception 'An import must preserve an explicit position clear and marker.';
  end if;

  update public.players
  set primary_position = 'C', primary_position_updated_at = changed_marker
  where id = assigned_id;
  select * into strict actual from public.players where id = assigned_id;
  if actual.primary_position is distinct from 'C'
    or actual.primary_position_updated_at is distinct from changed_marker then
    raise exception 'A changed assignment marker must allow the new position.';
  end if;

  insert into public.players (id, display_name, primary_position, jersey_number)
  values (denied_id, 'Rollback regression: authorization', 'D', '12');
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claims', '{}', true);
  rejected := false;
  begin
    perform public.update_linked_player_details(denied_id, '77', 'G', true, true);
  exception when raise_exception then
    if sqlerrm <> 'Sign in before updating player details.' then raise; end if;
    rejected := true;
  end;
  if not rejected then
    raise exception 'An unauthenticated linked-profile save must be rejected.';
  end if;

  perform set_config('request.jwt.claim.sub', test_unlinked_id::text, true);
  perform set_config('request.jwt.claims', jsonb_build_object('sub', test_unlinked_id, 'role', 'authenticated')::text, true);
  rejected := false;
  begin
    perform public.update_linked_player_details(denied_id, '77', 'G', true, true);
  exception when raise_exception then
    if sqlerrm <> 'An approved player link is required.' then raise; end if;
    rejected := true;
  end;
  if not rejected then
    raise exception 'An unlinked non-admin save must be rejected.';
  end if;
  select * into strict actual from public.players where id = denied_id;
  if actual.primary_position is distinct from 'D'
    or actual.jersey_number is distinct from '12'
    or actual.primary_position_updated_at is not null
    or actual.jersey_number_updated_at is not null then
    raise exception 'Rejected saves must not change player fields or markers.';
  end if;

  perform set_config('request.jwt.claim.sub', test_admin_id::text, true);
  perform set_config('request.jwt.claims', jsonb_build_object('sub', test_admin_id, 'role', 'authenticated')::text, true);

  insert into public.players (id, display_name)
  values (clear_null_position_id, 'Rollback regression: deliberate null position clear');
  -- An untouched number must stay null with no marker, despite a supplied value.
  perform public.update_linked_player_details(clear_null_position_id, '999', null, false, true);
  select * into strict actual from public.players where id = clear_null_position_id;
  if actual.primary_position is not null
    or actual.primary_position_updated_at is distinct from now()
    or actual.jersey_number is not null
    or actual.jersey_number_updated_at is not null then
    raise exception 'A null position clear must stamp only the changed position field.';
  end if;
  update public.players set primary_position = 'W' where id = clear_null_position_id;
  select * into strict actual from public.players where id = clear_null_position_id;
  if actual.primary_position is not null then
    raise exception 'An import must not undo a newly saved null position clear.';
  end if;

  insert into public.players (id, display_name, primary_position, primary_position_updated_at)
  values (clear_null_number_id, 'Rollback regression: deliberate null number clear', 'D', initial_marker);
  perform public.update_linked_player_details(clear_null_number_id, null, 'G', true, false);
  select * into strict actual from public.players where id = clear_null_number_id;
  if actual.jersey_number is not null
    or actual.jersey_number_updated_at is distinct from now()
    or actual.primary_position is distinct from 'D'
    or actual.primary_position_updated_at is distinct from initial_marker then
    raise exception 'A null number clear must preserve the untouched position and marker.';
  end if;

  insert into public.players (
    id, display_name, primary_position, primary_position_updated_at,
    jersey_number, jersey_number_updated_at
  ) values (
    changed_position_id, 'Rollback regression: changed explicit position', 'D', initial_marker,
    '19', initial_marker
  );
  perform public.update_linked_player_details(changed_position_id, null, ' g ', false, true);
  select * into strict actual from public.players where id = changed_position_id;
  if actual.primary_position is distinct from 'G'
    or actual.primary_position_updated_at is distinct from now()
    or actual.jersey_number is distinct from '19'
    or actual.jersey_number_updated_at is distinct from initial_marker then
    raise exception 'An explicit position save must normalize and update while preserving the untouched number.';
  end if;

  insert into public.players (id, display_name)
  values (legacy_call_id, 'Rollback regression: legacy three-argument caller');
  perform public.update_linked_player_details(legacy_call_id, '007', 'C');
  select * into strict actual from public.players where id = legacy_call_id;
  if actual.primary_position is distinct from 'C'
    or actual.primary_position_updated_at is distinct from now()
    or actual.jersey_number is distinct from '007'
    or actual.jersey_number_updated_at is distinct from now() then
    raise exception 'Legacy three-argument callers must update and stamp both fields.';
  end if;

  raise notice 'Player position assignment regressions passed; rolling back every synthetic row.';
end;
$$;

rollback;
