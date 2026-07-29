-- Public statistics are exposed only through narrow, read-only projections.
-- Base tables retain manager write policies but are no longer directly readable
-- by anonymous or ordinary authenticated clients.

alter table public.season_teams
  add column if not exists is_visible boolean not null default true;

drop policy if exists "Visible seasons are public" on public.seasons;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'season_teams',
    'players',
    'roster_memberships',
    'games',
    'team_game_stats',
    'team_season_summaries',
    'player_season_stats',
    'goalie_season_stats',
    'player_game_stats',
    'goalie_game_stats',
    'game_events'
  ]
  loop
    execute format(
      'drop policy if exists "Public statistics are readable" on public.%I',
      table_name
    );
  end loop;
end $$;

revoke select on table
  public.seasons,
  public.season_teams,
  public.players,
  public.roster_memberships,
  public.games,
  public.team_game_stats,
  public.team_season_summaries,
  public.player_season_stats,
  public.goalie_season_stats,
  public.player_game_stats,
  public.goalie_game_stats,
  public.game_events
from anon, authenticated;

-- Manager upserts return only the record identifier. The existing manager RLS
-- policy remains the authorization boundary for these direct write tables.
grant select (id) on public.player_game_stats to authenticated;
grant select (id) on public.goalie_game_stats to authenticated;

create or replace view public.public_stats_seasons
with (security_barrier = true)
as
select
  s.id,
  s.slug,
  s.name,
  s.start_date,
  s.end_date,
  s.status,
  s.is_current,
  s.source,
  s.external_id,
  s.source_url
from public.seasons s
where s.is_visible;

create or replace view public.public_stats_teams
with (security_barrier = true)
as
select
  st.id,
  st.season_id,
  st.name,
  st.schedule_label,
  st.division,
  st.source,
  st.external_id,
  st.source_url
from public.season_teams st
join public.seasons s on s.id = st.season_id
where s.is_visible
  and st.is_visible;

create or replace view public.public_stats_players
with (security_barrier = true)
as
select distinct
  p.id,
  p.display_name,
  p.jersey_number,
  p.primary_position,
  p.source,
  p.external_id,
  p.source_url
from public.players p
join public.roster_memberships rm on rm.player_id = p.id
join public.season_teams st on st.id = rm.season_team_id
join public.seasons s on s.id = st.season_id
where s.is_visible
  and st.is_visible;

create or replace view public.public_stats_memberships
with (security_barrier = true)
as
select
  rm.id,
  rm.season_team_id,
  rm.player_id,
  rm.jersey_number,
  rm.position,
  rm.active
from public.roster_memberships rm
join public.season_teams st on st.id = rm.season_team_id
join public.seasons s on s.id = st.season_id
where s.is_visible
  and st.is_visible;

create or replace view public.public_stats_games
with (security_barrier = true)
as
select
  g.id,
  g.season_team_id,
  g.stage,
  g.scheduled_at,
  g.opponent,
  g.venue,
  g.location,
  g.status,
  g.goals_for,
  g.goals_against,
  g.overtime,
  g.source,
  g.external_id,
  g.source_url,
  g.verified_at
from public.games g
join public.season_teams st on st.id = g.season_team_id
join public.seasons s on s.id = st.season_id
where s.is_visible
  and st.is_visible;

create or replace view public.public_stats_team_game_stats
with (security_barrier = true)
as
select
  tgs.game_id,
  tgs.shots_for,
  tgs.shots_against,
  tgs.power_play_goals,
  tgs.power_play_opportunities,
  tgs.penalty_kill_goals_against,
  tgs.times_shorthanded,
  tgs.faceoff_wins,
  tgs.faceoff_attempts,
  tgs.blocks,
  tgs.takeaways,
  tgs.turnovers,
  tgs.source
from public.team_game_stats tgs
join public.games g on g.id = tgs.game_id
join public.season_teams st on st.id = g.season_team_id
join public.seasons s on s.id = st.season_id
where s.is_visible
  and st.is_visible;

create or replace view public.public_stats_team_season_summaries
with (security_barrier = true)
as
select
  tss.season_team_id,
  tss.games_played,
  tss.wins,
  tss.losses,
  tss.ties,
  tss.points,
  tss.source,
  tss.source_url
from public.team_season_summaries tss
join public.season_teams st on st.id = tss.season_team_id
join public.seasons s on s.id = st.season_id
where s.is_visible
  and st.is_visible;

create or replace view public.public_stats_player_season_stats
with (security_barrier = true)
as
select
  pss.id,
  pss.season_team_id,
  pss.stage,
  pss.player_id,
  pss.games_played,
  pss.goals,
  pss.assists,
  pss.points,
  pss.penalty_minutes,
  pss.power_play_goals,
  pss.short_handed_goals,
  pss.empty_net_goals,
  pss.source
from public.player_season_stats pss
join public.season_teams st on st.id = pss.season_team_id
join public.seasons s on s.id = st.season_id
where s.is_visible
  and st.is_visible;

create or replace view public.public_stats_goalie_season_stats
with (security_barrier = true)
as
select
  gss.id,
  gss.season_team_id,
  gss.stage,
  gss.player_id,
  gss.games_played,
  gss.wins,
  gss.losses,
  gss.ties,
  gss.shutouts,
  gss.shots_against,
  gss.goals_against,
  gss.minutes_played,
  gss.goals_against_average,
  gss.save_percentage,
  gss.goals,
  gss.assists,
  gss.penalty_minutes,
  gss.source
from public.goalie_season_stats gss
join public.season_teams st on st.id = gss.season_team_id
join public.seasons s on s.id = st.season_id
where s.is_visible
  and st.is_visible;

create or replace view public.public_stats_player_game_stats
with (security_barrier = true)
as
select
  pgs.id,
  pgs.game_id,
  pgs.player_id,
  pgs.games_played,
  pgs.goals,
  pgs.assists,
  pgs.shots,
  pgs.penalty_minutes,
  pgs.plus_minus,
  pgs.blocks,
  pgs.takeaways,
  pgs.turnovers,
  pgs.power_play_goals,
  pgs.short_handed_goals,
  pgs.empty_net_goals,
  pgs.source
from public.player_game_stats pgs
join public.games g on g.id = pgs.game_id
join public.season_teams st on st.id = g.season_team_id
join public.seasons s on s.id = st.season_id
where s.is_visible
  and st.is_visible;

create or replace view public.public_stats_goalie_game_stats
with (security_barrier = true)
as
select
  ggs.id,
  ggs.game_id,
  ggs.player_id,
  ggs.games_played,
  ggs.wins,
  ggs.losses,
  ggs.ties,
  ggs.goals_against,
  ggs.shots_against,
  ggs.saves,
  ggs.shutouts,
  ggs.minutes_played,
  ggs.source
from public.goalie_game_stats ggs
join public.games g on g.id = ggs.game_id
join public.season_teams st on st.id = g.season_team_id
join public.seasons s on s.id = st.season_id
where s.is_visible
  and st.is_visible;

create or replace view public.public_stats_game_events
with (security_barrier = true)
as
select
  ge.id,
  ge.game_id,
  ge.period,
  ge.clock_seconds,
  ge.event_type,
  ge.team_side,
  ge.primary_player_id,
  ge.secondary_player_id,
  jsonb_strip_nulls(jsonb_build_object(
    'scorer', ge.detail -> 'scorer',
    'player', ge.detail -> 'player',
    'strength', ge.detail -> 'strength',
    'assists', ge.detail -> 'assists',
    'minutes', ge.detail -> 'minutes',
    'penalty', ge.detail -> 'penalty'
  )) as detail,
  ge.source
from public.game_events ge
join public.games g on g.id = ge.game_id
join public.season_teams st on st.id = g.season_team_id
join public.seasons s on s.id = st.season_id
where s.is_visible
  and st.is_visible
  and ge.event_type <> 'note';

do $$
declare
  view_name text;
begin
  foreach view_name in array array[
    'public_stats_seasons',
    'public_stats_teams',
    'public_stats_players',
    'public_stats_memberships',
    'public_stats_games',
    'public_stats_team_game_stats',
    'public_stats_team_season_summaries',
    'public_stats_player_season_stats',
    'public_stats_goalie_season_stats',
    'public_stats_player_game_stats',
    'public_stats_goalie_game_stats',
    'public_stats_game_events'
  ]
  loop
    execute format(
      'revoke all on table public.%I from public, anon, authenticated',
      view_name
    );
    execute format(
      'grant select on table public.%I to anon, authenticated',
      view_name
    );
  end loop;
end $$;

comment on view public.public_stats_games is
  'Public game projection; excludes notes, verifier identity, and internal timestamps.';
comment on view public.public_stats_memberships is
  'Public roster projection; excludes manager notes and internal timestamps.';
comment on view public.public_stats_game_events is
  'Public event projection; excludes note events and limits detail to display-safe fields.';
