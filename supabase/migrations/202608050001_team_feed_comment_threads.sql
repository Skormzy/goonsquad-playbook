alter table public.team_feed_comments
  add column if not exists parent_comment_id uuid
    references public.team_feed_comments(id) on delete cascade;

create index if not exists team_feed_comments_parent_created_idx
  on public.team_feed_comments (parent_comment_id, created_at asc)
  where parent_comment_id is not null;

create or replace function public.normalize_team_feed_comment_parent()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_parent_post_id uuid;
  v_root_parent_id uuid;
begin
  if new.parent_comment_id is null then
    return new;
  end if;

  if new.parent_comment_id = new.id then
    raise exception 'A comment cannot reply to itself.';
  end if;

  select post_id, parent_comment_id
    into v_parent_post_id, v_root_parent_id
  from public.team_feed_comments
  where id = new.parent_comment_id;

  if not found then
    raise exception 'The parent comment does not exist.';
  end if;

  if v_parent_post_id is distinct from new.post_id then
    raise exception 'Replies must stay on the same post.';
  end if;

  if v_root_parent_id is not null then
    new.parent_comment_id := v_root_parent_id;
  end if;

  return new;
end;
$$;

drop trigger if exists normalize_team_feed_comment_parent_before_write
  on public.team_feed_comments;
create trigger normalize_team_feed_comment_parent_before_write
  before insert or update of parent_comment_id, post_id
  on public.team_feed_comments
  for each row execute function public.normalize_team_feed_comment_parent();

create table if not exists public.team_feed_comment_likes (
  comment_id uuid not null
    references public.team_feed_comments(id) on delete cascade,
  user_id uuid not null
    references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (comment_id, user_id)
);

create index if not exists team_feed_comment_likes_user_idx
  on public.team_feed_comment_likes (user_id, created_at desc);

alter table public.team_feed_comment_likes enable row level security;

drop policy if exists "Approved members read comment likes"
  on public.team_feed_comment_likes;
create policy "Approved members read comment likes"
  on public.team_feed_comment_likes
  for select to authenticated
  using (public.is_approved_team_member());

drop policy if exists "Members create own comment likes"
  on public.team_feed_comment_likes;
create policy "Members create own comment likes"
  on public.team_feed_comment_likes
  for insert to authenticated
  with check (
    public.is_approved_team_member()
    and user_id = auth.uid()
  );

drop policy if exists "Members delete own comment likes"
  on public.team_feed_comment_likes;
create policy "Members delete own comment likes"
  on public.team_feed_comment_likes
  for delete to authenticated
  using (
    public.is_approved_team_member()
    and user_id = auth.uid()
  );

grant select, insert, delete
  on public.team_feed_comment_likes to authenticated;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'team_feed_comment_likes'
  ) then
    alter publication supabase_realtime
      add table public.team_feed_comment_likes;
  end if;
end $$;
