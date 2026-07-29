create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  avatar_url text,
  role text not null default 'member' check (role in ('member', 'stat_manager', 'admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.create_profile_for_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(coalesce(new.email, ''), '@', 1)),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists create_profile_after_signup on auth.users;
create trigger create_profile_after_signup
  after insert on auth.users
  for each row execute function public.create_profile_for_new_user();

insert into public.profiles (id, display_name, avatar_url)
select
  id,
  coalesce(raw_user_meta_data ->> 'full_name', split_part(coalesce(email, ''), '@', 1)),
  raw_user_meta_data ->> 'avatar_url'
from auth.users
on conflict (id) do nothing;

create or replace function public.is_team_data_manager()
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('stat_manager', 'admin')
  );
$$;

create or replace function public.protect_profile_role()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if auth.uid() is not null and new.role is distinct from old.role then
    raise exception 'Profile roles can be changed only through an administrative database operation.';
  end if;
  return new;
end;
$$;

drop trigger if exists protect_profile_role_before_update on public.profiles;
create trigger protect_profile_role_before_update
  before update on public.profiles
  for each row execute function public.protect_profile_role();

alter table public.profiles enable row level security;

drop policy if exists "Members read own profile" on public.profiles;
create policy "Members read own profile" on public.profiles
  for select using (auth.uid() = id);

drop policy if exists "Members update own display profile" on public.profiles;
create policy "Members update own display profile" on public.profiles
  for update using (auth.uid() = id)
  with check (auth.uid() = id);

create table if not exists public.user_favorite_plays (
  user_id uuid not null references auth.users(id) on delete cascade,
  play_id text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, play_id)
);

alter table public.user_favorite_plays enable row level security;

drop policy if exists "Members manage own favorites" on public.user_favorite_plays;
create policy "Members manage own favorites" on public.user_favorite_plays
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

alter table public.playmaker_plays
  add column if not exists revision integer not null default 1,
  add column if not exists published_at timestamptz;

create table if not exists public.playmaker_play_revisions (
  id bigint generated always as identity primary key,
  play_id text not null references public.playmaker_plays(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  revision integer not null,
  title text not null,
  description text not null,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  unique (play_id, revision)
);

create or replace function public.version_playmaker_play()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.payload is distinct from old.payload then
    insert into public.playmaker_play_revisions (
      play_id, user_id, revision, title, description, payload, created_at
    ) values (
      old.id, old.user_id, old.revision, old.title, old.description, old.payload, old.updated_at
    ) on conflict (play_id, revision) do nothing;
    new.revision := old.revision + 1;
  else
    new.revision := old.revision;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists version_playmaker_play_before_update on public.playmaker_plays;
create trigger version_playmaker_play_before_update
  before update on public.playmaker_plays
  for each row execute function public.version_playmaker_play();

alter table public.playmaker_play_revisions enable row level security;

drop policy if exists "Owners read play revisions" on public.playmaker_play_revisions;
create policy "Owners read play revisions" on public.playmaker_play_revisions
  for select using (auth.uid() = user_id);

create table if not exists public.seasons (
  id text primary key,
  slug text not null unique,
  name text not null,
  start_date date,
  end_date date,
  status text not null default 'upcoming' check (status in ('upcoming', 'active', 'complete')),
  is_current boolean not null default false,
  is_visible boolean not null default true,
  source text not null default 'team' check (source in ('team', 'league')),
  external_id text,
  source_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.season_teams (
  id text primary key,
  season_id text not null references public.seasons(id) on delete cascade,
  name text not null,
  schedule_label text not null,
  division text not null default '',
  source text not null default 'team' check (source in ('team', 'league')),
  external_id text,
  source_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (season_id, schedule_label),
  unique (source, external_id)
);

create table if not exists public.players (
  id uuid primary key default gen_random_uuid(),
  display_name text not null,
  jersey_number text,
  primary_position text check (primary_position is null or primary_position in ('G', 'D', 'C', 'W')),
  active boolean not null default true,
  source text not null default 'team' check (source in ('team', 'league')),
  external_id text,
  source_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source, external_id)
);

create table if not exists public.roster_memberships (
  id uuid primary key default gen_random_uuid(),
  season_team_id text not null references public.season_teams(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  jersey_number text,
  position text check (position is null or position in ('G', 'D', 'C', 'W')),
  active boolean not null default true,
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (season_team_id, player_id)
);

create table if not exists public.games (
  id uuid primary key default gen_random_uuid(),
  season_team_id text not null references public.season_teams(id) on delete cascade,
  stage text not null default 'regular' check (stage in ('regular', 'playoffs')),
  scheduled_at timestamptz not null,
  opponent text not null,
  venue text not null default 'neutral' check (venue in ('home', 'away', 'neutral')),
  location text not null default '',
  status text not null default 'scheduled' check (status in ('scheduled', 'final', 'postponed', 'cancelled')),
  goals_for integer check (goals_for is null or goals_for >= 0),
  goals_against integer check (goals_against is null or goals_against >= 0),
  overtime boolean not null default false,
  notes text not null default '',
  source text not null default 'team' check (source in ('team', 'league')),
  external_id text,
  source_url text,
  verified_by uuid references auth.users(id) on delete set null,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source, external_id)
);

create index if not exists games_team_date_idx on public.games (season_team_id, scheduled_at desc);

create table if not exists public.team_game_stats (
  game_id uuid primary key references public.games(id) on delete cascade,
  shots_for integer check (shots_for is null or shots_for >= 0),
  shots_against integer check (shots_against is null or shots_against >= 0),
  power_play_goals integer check (power_play_goals is null or power_play_goals >= 0),
  power_play_opportunities integer check (power_play_opportunities is null or power_play_opportunities >= 0),
  penalty_kill_goals_against integer check (penalty_kill_goals_against is null or penalty_kill_goals_against >= 0),
  times_shorthanded integer check (times_shorthanded is null or times_shorthanded >= 0),
  faceoff_wins integer check (faceoff_wins is null or faceoff_wins >= 0),
  faceoff_attempts integer check (faceoff_attempts is null or faceoff_attempts >= 0),
  blocks integer check (blocks is null or blocks >= 0),
  takeaways integer check (takeaways is null or takeaways >= 0),
  turnovers integer check (turnovers is null or turnovers >= 0),
  source text not null default 'team' check (source in ('team', 'league')),
  updated_at timestamptz not null default now()
);

create table if not exists public.team_season_summaries (
  season_team_id text primary key references public.season_teams(id) on delete cascade,
  games_played integer not null default 0 check (games_played >= 0),
  wins integer not null default 0 check (wins >= 0),
  losses integer not null default 0 check (losses >= 0),
  ties integer not null default 0 check (ties >= 0),
  points integer not null default 0 check (points >= 0),
  source text not null default 'team' check (source in ('team', 'league')),
  source_url text,
  updated_at timestamptz not null default now()
);

create table if not exists public.player_season_stats (
  id uuid primary key default gen_random_uuid(),
  season_team_id text not null references public.season_teams(id) on delete cascade,
  stage text not null default 'regular' check (stage in ('regular', 'playoffs')),
  player_id uuid not null references public.players(id) on delete cascade,
  games_played integer not null default 0 check (games_played >= 0),
  goals integer not null default 0 check (goals >= 0),
  assists integer not null default 0 check (assists >= 0),
  points integer not null default 0 check (points >= 0),
  penalty_minutes integer not null default 0 check (penalty_minutes >= 0),
  power_play_goals integer not null default 0 check (power_play_goals >= 0),
  short_handed_goals integer not null default 0 check (short_handed_goals >= 0),
  empty_net_goals integer not null default 0 check (empty_net_goals >= 0),
  source text not null default 'team' check (source in ('team', 'league')),
  updated_at timestamptz not null default now(),
  unique (season_team_id, stage, player_id)
);

create table if not exists public.goalie_season_stats (
  id uuid primary key default gen_random_uuid(),
  season_team_id text not null references public.season_teams(id) on delete cascade,
  stage text not null default 'regular' check (stage in ('regular', 'playoffs')),
  player_id uuid not null references public.players(id) on delete cascade,
  games_played integer not null default 0 check (games_played >= 0),
  wins integer not null default 0 check (wins >= 0),
  losses integer not null default 0 check (losses >= 0),
  ties integer not null default 0 check (ties >= 0),
  shutouts integer not null default 0 check (shutouts >= 0),
  shots_against integer not null default 0 check (shots_against >= 0),
  goals_against integer not null default 0 check (goals_against >= 0),
  minutes_played numeric(7,2) not null default 0 check (minutes_played >= 0),
  goals_against_average numeric(7,3) not null default 0 check (goals_against_average >= 0),
  save_percentage numeric(6,4) not null default 0 check (save_percentage >= 0 and save_percentage <= 1),
  goals integer not null default 0 check (goals >= 0),
  assists integer not null default 0 check (assists >= 0),
  penalty_minutes integer not null default 0 check (penalty_minutes >= 0),
  source text not null default 'team' check (source in ('team', 'league')),
  updated_at timestamptz not null default now(),
  unique (season_team_id, stage, player_id)
);

create table if not exists public.player_game_stats (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  games_played integer not null default 1 check (games_played in (0, 1)),
  goals integer not null default 0 check (goals >= 0),
  assists integer not null default 0 check (assists >= 0),
  shots integer check (shots is null or shots >= 0),
  penalty_minutes integer not null default 0 check (penalty_minutes >= 0),
  plus_minus integer,
  blocks integer check (blocks is null or blocks >= 0),
  takeaways integer check (takeaways is null or takeaways >= 0),
  turnovers integer check (turnovers is null or turnovers >= 0),
  power_play_goals integer not null default 0 check (power_play_goals >= 0),
  short_handed_goals integer not null default 0 check (short_handed_goals >= 0),
  empty_net_goals integer not null default 0 check (empty_net_goals >= 0),
  source text not null default 'team' check (source in ('team', 'league')),
  updated_at timestamptz not null default now(),
  unique (game_id, player_id)
);

create table if not exists public.goalie_game_stats (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  games_played integer not null default 1 check (games_played in (0, 1)),
  wins integer not null default 0 check (wins in (0, 1)),
  losses integer not null default 0 check (losses in (0, 1)),
  ties integer not null default 0 check (ties in (0, 1)),
  goals_against integer not null default 0 check (goals_against >= 0),
  shots_against integer not null default 0 check (shots_against >= 0),
  saves integer not null default 0 check (saves >= 0),
  shutouts integer not null default 0 check (shutouts in (0, 1)),
  minutes_played numeric(6,2) not null default 0 check (minutes_played >= 0),
  source text not null default 'team' check (source in ('team', 'league')),
  updated_at timestamptz not null default now(),
  unique (game_id, player_id)
);

create table if not exists public.game_events (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id) on delete cascade,
  period integer not null default 1 check (period > 0),
  clock_seconds integer check (clock_seconds is null or clock_seconds >= 0),
  event_type text not null check (event_type in ('goal', 'penalty', 'shot', 'save', 'faceoff', 'note')),
  team_side text not null default 'us' check (team_side in ('us', 'opponent')),
  primary_player_id uuid references public.players(id) on delete set null,
  secondary_player_id uuid references public.players(id) on delete set null,
  detail jsonb not null default '{}'::jsonb,
  source text not null default 'team' check (source in ('team', 'league')),
  external_id text,
  source_url text,
  created_at timestamptz not null default now(),
  unique (source, external_id)
);

alter table public.seasons enable row level security;
alter table public.season_teams enable row level security;
alter table public.players enable row level security;
alter table public.roster_memberships enable row level security;
alter table public.games enable row level security;
alter table public.team_game_stats enable row level security;
alter table public.team_season_summaries enable row level security;
alter table public.player_season_stats enable row level security;
alter table public.goalie_season_stats enable row level security;
alter table public.player_game_stats enable row level security;
alter table public.goalie_game_stats enable row level security;
alter table public.game_events enable row level security;

drop policy if exists "Visible seasons are public" on public.seasons;
create policy "Visible seasons are public" on public.seasons for select using (is_visible);

do $$
declare table_name text;
begin
  foreach table_name in array array['season_teams', 'players', 'roster_memberships', 'games', 'team_game_stats', 'team_season_summaries', 'player_season_stats', 'goalie_season_stats', 'player_game_stats', 'goalie_game_stats', 'game_events']
  loop
    execute format('drop policy if exists "Public statistics are readable" on public.%I', table_name);
    execute format('create policy "Public statistics are readable" on public.%I for select using (true)', table_name);
  end loop;
end $$;

do $$
declare table_name text;
begin
  foreach table_name in array array['seasons', 'season_teams', 'players', 'roster_memberships', 'games', 'team_game_stats', 'team_season_summaries', 'player_season_stats', 'goalie_season_stats', 'player_game_stats', 'goalie_game_stats', 'game_events']
  loop
    execute format('drop policy if exists "Team data managers write statistics" on public.%I', table_name);
    execute format('create policy "Team data managers write statistics" on public.%I for all using (public.is_team_data_manager()) with check (public.is_team_data_manager())', table_name);
  end loop;
end $$;

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

do $$
declare table_name text;
begin
  foreach table_name in array array['profiles', 'seasons', 'season_teams', 'players', 'roster_memberships', 'games', 'team_game_stats', 'team_season_summaries', 'player_season_stats', 'goalie_season_stats', 'player_game_stats', 'goalie_game_stats']
  loop
    execute format('drop trigger if exists touch_updated_at_before_update on public.%I', table_name);
    execute format('create trigger touch_updated_at_before_update before update on public.%I for each row execute function public.touch_updated_at()', table_name);
  end loop;
end $$;

create or replace function public.add_roster_player(
  p_season_team_id text,
  p_display_name text,
  p_jersey_number text default null,
  p_position text default null
) returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  player_id uuid;
begin
  if not public.is_team_data_manager() then raise exception 'Not authorized to manage team statistics.'; end if;
  if trim(coalesce(p_display_name, '')) = '' then raise exception 'Player name is required.'; end if;

  select id into player_id
  from public.players
  where lower(display_name) = lower(trim(p_display_name))
  order by created_at asc
  limit 1;

  if player_id is null then
    insert into public.players (display_name, jersey_number, primary_position)
    values (trim(p_display_name), nullif(trim(coalesce(p_jersey_number, '')), ''), p_position)
    returning id into player_id;
  end if;

  insert into public.roster_memberships (season_team_id, player_id, jersey_number, position)
  values (p_season_team_id, player_id, nullif(trim(coalesce(p_jersey_number, '')), ''), p_position)
  on conflict (season_team_id, player_id) do update set
    jersey_number = excluded.jersey_number,
    position = excluded.position,
    active = true,
    updated_at = now();
  return player_id;
end;
$$;

create or replace function public.record_team_game(
  p_season_team_id text,
  p_scheduled_at timestamptz,
  p_opponent text,
  p_venue text,
  p_goals_for integer,
  p_goals_against integer,
  p_overtime boolean default false,
  p_notes text default ''
) returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  v_game_id uuid;
begin
  if not public.is_team_data_manager() then raise exception 'Not authorized to manage team statistics.'; end if;
  if trim(coalesce(p_opponent, '')) = '' then raise exception 'Opponent is required.'; end if;
  if p_goals_for < 0 or p_goals_against < 0 then raise exception 'Scores cannot be negative.'; end if;

  insert into public.games (
    season_team_id, scheduled_at, opponent, venue, status,
    goals_for, goals_against, overtime, notes, verified_by, verified_at
  ) values (
    p_season_team_id, p_scheduled_at, trim(p_opponent), p_venue, 'final',
    p_goals_for, p_goals_against, p_overtime, coalesce(p_notes, ''), auth.uid(), now()
  ) returning id into v_game_id;

  insert into public.team_game_stats (game_id) values (v_game_id);
  return v_game_id;
end;
$$;

grant execute on function public.add_roster_player(text, text, text, text) to authenticated;
grant execute on function public.record_team_game(text, timestamptz, text, text, integer, integer, boolean, text) to authenticated;

insert into public.seasons (id, slug, name, start_date, end_date, status, is_current, is_visible, source, source_url)
values ('summer-2026', 'summer-2026', 'Summer 2026', null, null, 'active', true, true, 'league', 'https://www.yorkcentralbhl.com/team/7250-goonsquad')
on conflict (id) do update set
  name = excluded.name,
  status = excluded.status,
  is_current = excluded.is_current,
  is_visible = excluded.is_visible;

insert into public.season_teams (id, season_id, name, schedule_label, division, source, external_id, source_url)
values
  ('summer-2026-mon-thu', 'summer-2026', 'Mon/Thu Team', 'MON/THU', 'MON/THU TIER 5 (D/REC)', 'league', '7250', 'https://www.yorkcentralbhl.com/team/7250-goonsquad'),
  ('summer-2026-sunday', 'summer-2026', 'Sunday Team', 'SUNDAY', 'SUNDAY TIER 5 (D/REC)', 'league', '7240', 'https://www.yorkcentralbhl.com/team/7240-goonsquad')
on conflict (id) do update set
  name = excluded.name,
  schedule_label = excluded.schedule_label,
  division = excluded.division,
  source = excluded.source,
  external_id = excluded.external_id,
  source_url = excluded.source_url;
