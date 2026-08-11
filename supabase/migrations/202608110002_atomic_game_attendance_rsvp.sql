-- Register the published fixture and save the signed-in member's RSVP in one
-- transaction. This prevents schedule-import lag from producing a UI-only
-- response that disappears when availability is reloaded.
create or replace function public.set_my_game_availability(
  p_fixture_id text,
  p_season_team_id text default null,
  p_tournament_id text default null,
  p_scheduled_at timestamptz default null,
  p_opponent text default null,
  p_response text default null,
  p_note text default null
) returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  normalized_response text := lower(trim(coalesce(p_response, '')));
  normalized_note text := nullif(trim(coalesce(p_note, '')), '');
  saved public.team_game_availability%rowtype;
begin
  if current_user_id is null then
    raise exception 'Sign in before setting attendance.';
  end if;

  if normalized_response not in ('in', 'maybe', 'out') then
    raise exception 'Attendance must be In, Maybe, or Out.';
  end if;

  if char_length(coalesce(normalized_note, '')) > 140 then
    raise exception 'Attendance notes must be 140 characters or fewer.';
  end if;

  perform public.register_game_attendance_fixture(
    p_fixture_id,
    p_season_team_id,
    p_tournament_id,
    p_scheduled_at,
    p_opponent
  );

  if not public.can_access_game_attendance(p_fixture_id, current_user_id) then
    raise exception 'This game is not assigned to your roster.';
  end if;

  insert into public.team_game_availability (
    fixture_id,
    user_id,
    response,
    note
  ) values (
    trim(p_fixture_id),
    current_user_id,
    normalized_response,
    normalized_note
  )
  on conflict (fixture_id, user_id) do update set
    response = excluded.response,
    note = excluded.note,
    updated_at = now()
  returning * into saved;

  return jsonb_build_object(
    'fixture_id', saved.fixture_id,
    'user_id', saved.user_id,
    'response', saved.response,
    'note', saved.note,
    'updated_at', saved.updated_at
  );
end;
$$;

revoke all on function public.set_my_game_availability(
  text,
  text,
  text,
  timestamptz,
  text,
  text,
  text
) from public;

grant execute on function public.set_my_game_availability(
  text,
  text,
  text,
  timestamptz,
  text,
  text,
  text
) to authenticated;

select
  'Atomic attendance RSVP ready' as status,
  to_regprocedure(
    'public.set_my_game_availability(text,text,text,timestamptz,text,text,text)'
  ) is not null as rsvp_ready;
