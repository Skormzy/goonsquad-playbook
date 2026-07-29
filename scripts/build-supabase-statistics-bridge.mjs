import { createHash, randomBytes } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tokenPath = path.join(root, '.goonsquad-statistics-import.local');
const outputDir = path.join(root, 'docs', 'launch');
const outputPath = path.join(outputDir, 'GOONSQUAD_STATISTICS_ONE_CLICK_SETUP.sql');

let token = '';
try {
  token = (await readFile(tokenPath, 'utf8')).trim();
} catch (error) {
  if (error?.code !== 'ENOENT') throw error;
}

if (!/^[a-f0-9]{64}$/.test(token)) {
  token = randomBytes(32).toString('hex');
  await writeFile(tokenPath, `${token}\n`, 'utf8');
}

const tokenHash = createHash('md5').update(token).digest('hex');
const sql = `-- Goonsquad one-time statistics import bridge
-- Run this complete query once in Supabase SQL Editor.
-- It permits only the known statistics tables and is disabled after import.

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table if not exists private.goonsquad_archive_import_gate (
  id boolean primary key default true check (id),
  token_hash text not null,
  active boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table private.goonsquad_archive_import_gate enable row level security;
revoke all on table private.goonsquad_archive_import_gate from public, anon, authenticated;

insert into private.goonsquad_archive_import_gate (id, token_hash, active, updated_at)
values (true, '${tokenHash}', true, now())
on conflict (id) do update
set token_hash = excluded.token_hash,
    active = true,
    updated_at = now();

create or replace function public.goonsquad_archive_upsert(
  p_token text,
  p_table text,
  p_rows jsonb
) returns integer
language plpgsql
security definer
set search_path = pg_catalog, public, private, pg_temp
as $$
declare
  conflict_columns text[];
  conflict_list text;
  insert_columns text;
  update_columns text;
  requested_count integer;
  matched_count integer;
  affected integer;
  target_table regclass;
  command text;
begin
  if not exists (
    select 1
    from private.goonsquad_archive_import_gate
    where id = true
      and active = true
      and token_hash = md5(p_token)
  ) then
    raise exception 'The one-time Goonsquad import bridge is not active.';
  end if;

  if p_rows is null or jsonb_typeof(p_rows) <> 'array' then
    raise exception 'Import rows must be a JSON array.';
  end if;
  if jsonb_array_length(p_rows) = 0 then return 0; end if;

  case p_table
    when 'seasons' then conflict_columns := array['id'];
    when 'season_teams' then conflict_columns := array['id'];
    when 'players' then conflict_columns := array['source', 'external_id'];
    when 'roster_memberships' then conflict_columns := array['season_team_id', 'player_id'];
    when 'games' then conflict_columns := array['source', 'external_id'];
    when 'team_game_stats' then conflict_columns := array['game_id'];
    when 'player_game_stats' then conflict_columns := array['game_id', 'player_id'];
    when 'goalie_game_stats' then conflict_columns := array['game_id', 'player_id'];
    when 'game_events' then conflict_columns := array['source', 'external_id'];
    when 'team_season_summaries' then conflict_columns := array['season_team_id'];
    when 'player_season_stats' then conflict_columns := array['season_team_id', 'stage', 'player_id'];
    when 'goalie_season_stats' then conflict_columns := array['season_team_id', 'stage', 'player_id'];
    else raise exception 'Table % is not permitted by the Goonsquad import bridge.', p_table;
  end case;

  target_table := format('public.%I', p_table)::regclass;

  with requested as (
    select distinct keys.column_name as key
    from jsonb_array_elements(p_rows) as rows(row_data)
    cross join lateral jsonb_object_keys(rows.row_data) as keys(column_name)
  )
  select count(*) into requested_count from requested;

  with requested as (
    select distinct keys.column_name as key
    from jsonb_array_elements(p_rows) as rows(row_data)
    cross join lateral jsonb_object_keys(rows.row_data) as keys(column_name)
  ),
  matched as (
    select attribute.attname, attribute.attnum
    from pg_attribute as attribute
    join requested on requested.key = attribute.attname
    where attribute.attrelid = target_table
      and attribute.attnum > 0
      and not attribute.attisdropped
      and attribute.attgenerated = ''
      and attribute.attidentity = ''
  )
  select
    count(*),
    string_agg(format('%I', attname), ', ' order by attnum),
    string_agg(
      format('%I = excluded.%I', attname, attname),
      ', ' order by attnum
    ) filter (
      where not (attname = any(conflict_columns))
        and attname not in ('id', 'created_at')
    )
  into matched_count, insert_columns, update_columns
  from matched;

  if matched_count <> requested_count then
    raise exception 'The % payload contains an unknown or generated column.', p_table;
  end if;

  select string_agg(format('%I', column_name), ', ' order by position)
  into conflict_list
  from unnest(conflict_columns) with ordinality as conflict(column_name, position);

  if update_columns is null then
    command := format(
      'insert into public.%I (%s) select %s from jsonb_populate_recordset(null::public.%I, $1) on conflict (%s) do nothing',
      p_table, insert_columns, insert_columns, p_table, conflict_list
    );
  else
    command := format(
      'insert into public.%I (%s) select %s from jsonb_populate_recordset(null::public.%I, $1) on conflict (%s) do update set %s',
      p_table, insert_columns, insert_columns, p_table, conflict_list, update_columns
    );
  end if;

  execute command using p_rows;
  get diagnostics affected = row_count;
  if affected <> jsonb_array_length(p_rows) then
    raise exception 'Expected % affected rows for %, received %.', jsonb_array_length(p_rows), p_table, affected;
  end if;
  return affected;
end;
$$;

create or replace function public.goonsquad_archive_finalize(
  p_token text
) returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private, pg_temp
as $$
declare
  totals jsonb;
begin
  if not exists (
    select 1
    from private.goonsquad_archive_import_gate
    where id = true
      and active = true
      and token_hash = md5(p_token)
  ) then
    raise exception 'The one-time Goonsquad import bridge is not active.';
  end if;

  select jsonb_build_object(
    'seasons', (select count(*) from public.seasons),
    'teams', (select count(*) from public.season_teams),
    'players', (select count(*) from public.players),
    'games', (select count(*) from public.games),
    'playerSeasonLines', (select count(*) from public.player_season_stats),
    'playerGameLines', (select count(*) from public.player_game_stats),
    'gameEvents', (select count(*) from public.game_events)
  ) into totals;

  update private.goonsquad_archive_import_gate
  set active = false, updated_at = now()
  where id = true;

  execute 'revoke execute on function public.goonsquad_archive_upsert(text, text, jsonb) from anon, authenticated';
  return totals;
end;
$$;

revoke all on function public.goonsquad_archive_upsert(text, text, jsonb) from public, anon, authenticated;
revoke all on function public.goonsquad_archive_finalize(text) from public, anon, authenticated;
grant execute on function public.goonsquad_archive_upsert(text, text, jsonb) to anon;
grant execute on function public.goonsquad_archive_finalize(text) to anon;

select 'Ready for Codex to import the complete statistics archive.' as status;
`;

await mkdir(outputDir, { recursive: true });
await writeFile(outputPath, sql, 'utf8');
console.log(JSON.stringify({
  outputPath,
  bytes: Buffer.byteLength(sql),
  tokenPath,
}, null, 2));
