-- A season can contain multiple Goonsquad teams on the same day when the
-- league places them in different divisions. Official team identity remains
-- protected by the existing (source, external_id) constraint and the primary
-- key, so schedule labels must not be globally unique within a season.

alter table public.season_teams
  drop constraint if exists season_teams_season_id_schedule_label_key;
