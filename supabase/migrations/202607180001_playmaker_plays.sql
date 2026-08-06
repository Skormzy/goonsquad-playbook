create extension if not exists pgcrypto;

create table if not exists public.playmaker_plays (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'Untitled play',
  description text not null default '',
  visibility text not null default 'private' check (visibility in ('private', 'public')),
  payload jsonb not null,
  share_slug text not null unique default encode(gen_random_bytes(9), 'hex'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists playmaker_plays_user_updated_idx
  on public.playmaker_plays (user_id, updated_at desc);

alter table public.playmaker_plays enable row level security;

drop policy if exists "Owners read playmaker plays" on public.playmaker_plays;
create policy "Owners read playmaker plays"
  on public.playmaker_plays for select
  using (auth.uid() = user_id);

drop policy if exists "Owners create playmaker plays" on public.playmaker_plays;
create policy "Owners create playmaker plays"
  on public.playmaker_plays for insert
  with check (auth.uid() = user_id);

drop policy if exists "Owners update playmaker plays" on public.playmaker_plays;
create policy "Owners update playmaker plays"
  on public.playmaker_plays for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Owners delete playmaker plays" on public.playmaker_plays;
create policy "Owners delete playmaker plays"
  on public.playmaker_plays for delete
  using (auth.uid() = user_id);

drop policy if exists "Public playmaker plays are readable" on public.playmaker_plays;
create policy "Public playmaker plays are readable"
  on public.playmaker_plays for select
  using (visibility = 'public');
