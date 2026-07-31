-- Flexible tournament dossiers with public published reads and admin-only writes.

create table if not exists public.team_tournaments (
  id text primary key,
  payload jsonb not null default '{}'::jsonb,
  is_published boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint team_tournaments_id_check
    check (id ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' and char_length(id) <= 120),
  constraint team_tournaments_payload_check
    check (jsonb_typeof(payload) = 'object')
);

create index if not exists team_tournaments_publication_idx
  on public.team_tournaments (is_published, updated_at desc);

drop trigger if exists touch_updated_at_before_update on public.team_tournaments;
create trigger touch_updated_at_before_update
  before update on public.team_tournaments
  for each row execute function public.touch_updated_at();

alter table public.team_tournaments enable row level security;

drop policy if exists "Admins read tournament control room" on public.team_tournaments;
create policy "Admins read tournament control room" on public.team_tournaments
  for select to authenticated
  using (public.is_team_admin());

drop policy if exists "Admins create tournaments" on public.team_tournaments;
create policy "Admins create tournaments" on public.team_tournaments
  for insert to authenticated
  with check (
    public.is_team_admin()
    and created_by = auth.uid()
    and updated_by = auth.uid()
  );

drop policy if exists "Admins update tournaments" on public.team_tournaments;
create policy "Admins update tournaments" on public.team_tournaments
  for update to authenticated
  using (public.is_team_admin())
  with check (
    public.is_team_admin()
    and updated_by = auth.uid()
  );

drop policy if exists "Admins delete tournaments" on public.team_tournaments;
create policy "Admins delete tournaments" on public.team_tournaments
  for delete to authenticated
  using (public.is_team_admin());

grant select, insert, update, delete on public.team_tournaments to authenticated;

-- Draft rows still return their id so a hidden seed dossier cannot reappear from
-- the bundled fallback. Draft payloads are never exposed to public clients.
drop function if exists public.list_public_team_tournaments();
create function public.list_public_team_tournaments()
returns table (
  id text,
  payload jsonb,
  is_published boolean,
  updated_at timestamptz
)
language sql
stable
security definer set search_path = public
as $$
  select
    tournament.id,
    case when tournament.is_published then tournament.payload else null end,
    tournament.is_published,
    tournament.updated_at
  from public.team_tournaments tournament
  order by tournament.updated_at desc;
$$;

revoke all on function public.list_public_team_tournaments() from public;
grant execute on function public.list_public_team_tournaments() to anon, authenticated;

select
  'Tournament control room ready' as status,
  to_regclass('public.team_tournaments') is not null as tournaments_ready,
  to_regprocedure('public.list_public_team_tournaments()') is not null as public_archive_ready;
