-- Admin-authored corrections sit beside the immutable league import. Clients
-- reconcile each correction against the published game before calculating
-- game, season, career, leaderboard, and profile totals.

create table if not exists public.team_game_stat_overrides (
  game_key text primary key,
  game_external_id text,
  season_team_id text not null,
  payload jsonb not null default '{}'::jsonb,
  note text not null default '',
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (length(game_key) between 1 and 180),
  check (game_external_id is null or length(game_external_id) <= 180),
  check (length(season_team_id) between 1 and 180),
  check (length(note) <= 1000),
  check (jsonb_typeof(payload) = 'object')
);

create table if not exists public.team_game_stat_override_revisions (
  id bigint generated always as identity primary key,
  game_key text not null,
  action text not null check (action in ('insert', 'update', 'delete')),
  payload jsonb not null default '{}'::jsonb,
  note text not null default '',
  changed_by uuid references auth.users(id) on delete set null,
  changed_at timestamptz not null default now()
);

create index if not exists team_game_stat_overrides_external_idx
  on public.team_game_stat_overrides (game_external_id);
create index if not exists team_game_stat_overrides_schedule_idx
  on public.team_game_stat_overrides (season_team_id, updated_at desc);
create index if not exists team_game_stat_override_revisions_game_idx
  on public.team_game_stat_override_revisions (game_key, changed_at desc);

create or replace function public.audit_team_game_stat_override()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    insert into public.team_game_stat_override_revisions (
      game_key, action, payload, note, changed_by
    ) values (
      old.game_key, 'delete', old.payload, old.note, auth.uid()
    );
    return old;
  end if;

  insert into public.team_game_stat_override_revisions (
    game_key, action, payload, note, changed_by
  ) values (
    new.game_key, lower(tg_op), new.payload, new.note, auth.uid()
  );
  return new;
end;
$$;

drop trigger if exists audit_team_game_stat_override_after_write
  on public.team_game_stat_overrides;
create trigger audit_team_game_stat_override_after_write
  after insert or update or delete on public.team_game_stat_overrides
  for each row execute function public.audit_team_game_stat_override();

drop trigger if exists touch_updated_at_before_update
  on public.team_game_stat_overrides;
create trigger touch_updated_at_before_update
  before update on public.team_game_stat_overrides
  for each row execute function public.touch_updated_at();

alter table public.team_game_stat_overrides enable row level security;
alter table public.team_game_stat_override_revisions enable row level security;

drop policy if exists "Admins manage game stat overrides"
  on public.team_game_stat_overrides;
create policy "Admins manage game stat overrides"
  on public.team_game_stat_overrides
  for all to authenticated
  using (public.is_team_admin())
  with check (public.is_team_admin());

drop policy if exists "Admins read game stat override history"
  on public.team_game_stat_override_revisions;
create policy "Admins read game stat override history"
  on public.team_game_stat_override_revisions
  for select to authenticated
  using (public.is_team_admin());

revoke all on table public.team_game_stat_overrides from public, anon, authenticated;
revoke all on table public.team_game_stat_override_revisions from public, anon, authenticated;

create or replace function public.validate_team_game_stat_override_payload(
  p_payload jsonb
) returns void
language plpgsql
immutable
set search_path = public
as $$
declare
  field_name text;
begin
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    raise exception 'A game correction payload is required.';
  end if;

  foreach field_name in array array['playerLines', 'goalieLines', 'events']
  loop
    if p_payload ? field_name and jsonb_typeof(p_payload -> field_name) <> 'array' then
      raise exception '% must be an array.', field_name;
    end if;
    if p_payload ? field_name and jsonb_array_length(p_payload -> field_name) > 120 then
      raise exception '% contains too many records.', field_name;
    end if;
  end loop;

  if p_payload ? 'game' and jsonb_typeof(p_payload -> 'game') <> 'object' then
    raise exception 'game must be an object.';
  end if;
  if p_payload ? 'teamStats' and jsonb_typeof(p_payload -> 'teamStats') <> 'object' then
    raise exception 'teamStats must be an object.';
  end if;
  if pg_column_size(p_payload) > 524288 then
    raise exception 'The game correction is too large.';
  end if;
end;
$$;

create or replace function public.list_public_team_game_stat_overrides()
returns table (
  game_key text,
  game_external_id text,
  season_team_id text,
  payload jsonb,
  note text,
  updated_at timestamptz
)
language sql
stable
security definer set search_path = public
as $$
  select
    correction.game_key,
    correction.game_external_id,
    correction.season_team_id,
    correction.payload,
    correction.note,
    correction.updated_at
  from public.team_game_stat_overrides correction
  order by correction.updated_at asc, correction.game_key asc;
$$;

create or replace function public.upsert_team_game_stat_override(
  p_game_key text,
  p_game_external_id text,
  p_season_team_id text,
  p_payload jsonb,
  p_note text default ''
) returns table (
  game_key text,
  game_external_id text,
  season_team_id text,
  payload jsonb,
  note text,
  updated_at timestamptz
)
language plpgsql
security definer set search_path = public
as $$
begin
  if not public.is_team_admin() then
    raise exception 'Only a Goonsquad admin can correct official game statistics.';
  end if;
  if length(trim(coalesce(p_game_key, ''))) = 0 then
    raise exception 'A game identifier is required.';
  end if;
  if length(trim(coalesce(p_season_team_id, ''))) = 0 then
    raise exception 'A schedule identifier is required.';
  end if;
  perform public.validate_team_game_stat_override_payload(p_payload);

  insert into public.team_game_stat_overrides (
    game_key,
    game_external_id,
    season_team_id,
    payload,
    note,
    created_by,
    updated_by
  ) values (
    trim(p_game_key),
    nullif(trim(coalesce(p_game_external_id, '')), ''),
    trim(p_season_team_id),
    p_payload,
    trim(coalesce(p_note, '')),
    auth.uid(),
    auth.uid()
  )
  on conflict on constraint team_game_stat_overrides_pkey do update set
    game_external_id = excluded.game_external_id,
    season_team_id = excluded.season_team_id,
    payload = excluded.payload,
    note = excluded.note,
    updated_by = auth.uid();

  return query
  select
    correction.game_key,
    correction.game_external_id,
    correction.season_team_id,
    correction.payload,
    correction.note,
    correction.updated_at
  from public.team_game_stat_overrides correction
  where correction.game_key = trim(p_game_key);
end;
$$;

create or replace function public.delete_team_game_stat_override(
  p_game_key text
) returns boolean
language plpgsql
security definer set search_path = public
as $$
declare
  deleted_count integer;
begin
  if not public.is_team_admin() then
    raise exception 'Only a Goonsquad admin can remove game-stat corrections.';
  end if;
  delete from public.team_game_stat_overrides correction
  where correction.game_key = trim(p_game_key);
  get diagnostics deleted_count = row_count;
  return deleted_count > 0;
end;
$$;

revoke all on function public.validate_team_game_stat_override_payload(jsonb) from public;
revoke all on function public.list_public_team_game_stat_overrides() from public;
revoke all on function public.upsert_team_game_stat_override(text, text, text, jsonb, text) from public;
revoke all on function public.delete_team_game_stat_override(text) from public;

grant execute on function public.list_public_team_game_stat_overrides() to anon, authenticated;
grant execute on function public.upsert_team_game_stat_override(text, text, text, jsonb, text) to authenticated;
grant execute on function public.delete_team_game_stat_override(text) to authenticated;

comment on table public.team_game_stat_overrides is
  'Audited admin corrections layered over immutable official league game data.';
comment on function public.list_public_team_game_stat_overrides() is
  'Public display-safe corrections used to reconcile game, season, career, and leaderboard statistics.';
