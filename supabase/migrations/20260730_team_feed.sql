-- Private team feed for approved Goon Squad members.
-- Public statistics remain available through the existing public_stats_* views.

create or replace function public.is_approved_team_member(
  p_user_id uuid default auth.uid()
) returns boolean
language sql
stable
security definer set search_path = public
as $$
  select p_user_id is not null and (
    exists (
      select 1
      from public.profiles
      where id = p_user_id
        and role = 'admin'
    )
    or exists (
      select 1
      from public.member_player_claims
      where user_id = p_user_id
        and status = 'approved'
    )
  );
$$;

create or replace function public.is_team_admin(
  p_user_id uuid default auth.uid()
) returns boolean
language sql
stable
security definer set search_path = public
as $$
  select p_user_id is not null and exists (
    select 1
    from public.profiles
    where id = p_user_id
      and role = 'admin'
  );
$$;

revoke all on function public.is_approved_team_member(uuid) from public;
revoke all on function public.is_team_admin(uuid) from public;
grant execute on function public.is_approved_team_member(uuid) to authenticated;
grant execute on function public.is_team_admin(uuid) to authenticated;

drop policy if exists "Approved members read team profiles" on public.profiles;
create policy "Approved members read team profiles" on public.profiles
  for select to authenticated
  using (
    public.is_approved_team_member()
    and public.is_approved_team_member(id)
  );

drop policy if exists "Approved members read team player links" on public.member_player_claims;
create policy "Approved members read team player links" on public.member_player_claims
  for select to authenticated
  using (
    public.is_approved_team_member()
    and status = 'approved'
  );

create table if not exists public.team_feed_posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id) on delete cascade,
  body text not null default '',
  link_url text,
  media_path text,
  media_kind text check (media_kind in ('image', 'video')),
  pinned_at timestamptz,
  pinned_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint team_feed_posts_body_length_check
    check (char_length(body) <= 3000),
  constraint team_feed_posts_link_length_check
    check (link_url is null or char_length(link_url) <= 2048),
  constraint team_feed_posts_media_pair_check
    check ((media_path is null) = (media_kind is null)),
  constraint team_feed_posts_content_check
    check (
      length(trim(body)) > 0
      or link_url is not null
      or media_path is not null
    ),
  constraint team_feed_posts_pin_pair_check
    check ((pinned_at is null) = (pinned_by is null))
);

create index if not exists team_feed_posts_created_at_idx
  on public.team_feed_posts (created_at desc);
create index if not exists team_feed_posts_pinned_at_idx
  on public.team_feed_posts (pinned_at desc)
  where pinned_at is not null;

create table if not exists public.team_feed_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.team_feed_posts(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint team_feed_comments_body_check
    check (length(trim(body)) > 0 and char_length(body) <= 1000)
);

create index if not exists team_feed_comments_post_created_idx
  on public.team_feed_comments (post_id, created_at asc);

create table if not exists public.team_feed_likes (
  post_id uuid not null references public.team_feed_posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create table if not exists public.team_feed_mentions (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.team_feed_posts(id) on delete cascade,
  comment_id uuid references public.team_feed_comments(id) on delete cascade,
  mentioned_user_id uuid not null references public.profiles(id) on delete cascade,
  created_by uuid not null references public.profiles(id) on delete cascade,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create or replace function public.protect_team_feed_mention_linkage()
returns trigger
language plpgsql
as $$
begin
  if (
    new.post_id is distinct from old.post_id
    or new.comment_id is distinct from old.comment_id
    or new.mentioned_user_id is distinct from old.mentioned_user_id
    or new.created_by is distinct from old.created_by
    or new.created_at is distinct from old.created_at
  ) then
    raise exception 'Only mention read status can be updated.';
  end if;
  return new;
end;
$$;

drop trigger if exists protect_team_feed_mention_linkage_before_update on public.team_feed_mentions;
create trigger protect_team_feed_mention_linkage_before_update
  before update on public.team_feed_mentions
  for each row execute function public.protect_team_feed_mention_linkage();

create unique index if not exists team_feed_post_mentions_unique_idx
  on public.team_feed_mentions (post_id, mentioned_user_id)
  where comment_id is null;
create unique index if not exists team_feed_comment_mentions_unique_idx
  on public.team_feed_mentions (comment_id, mentioned_user_id)
  where comment_id is not null;
create index if not exists team_feed_mentions_recipient_idx
  on public.team_feed_mentions (mentioned_user_id, read_at, created_at desc);

drop trigger if exists touch_updated_at_before_update on public.team_feed_posts;
create trigger touch_updated_at_before_update
  before update on public.team_feed_posts
  for each row execute function public.touch_updated_at();

drop trigger if exists touch_updated_at_before_update on public.team_feed_comments;
create trigger touch_updated_at_before_update
  before update on public.team_feed_comments
  for each row execute function public.touch_updated_at();

create or replace function public.protect_team_feed_pin()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if (
    new.pinned_at is distinct from old.pinned_at
    or new.pinned_by is distinct from old.pinned_by
  ) and not public.is_team_admin() then
    raise exception 'Only a team admin can pin a feed post.';
  end if;
  return new;
end;
$$;

drop trigger if exists protect_team_feed_pin_before_update on public.team_feed_posts;
create trigger protect_team_feed_pin_before_update
  before update on public.team_feed_posts
  for each row execute function public.protect_team_feed_pin();

alter table public.team_feed_posts enable row level security;
alter table public.team_feed_comments enable row level security;
alter table public.team_feed_likes enable row level security;
alter table public.team_feed_mentions enable row level security;

drop policy if exists "Approved members read feed posts" on public.team_feed_posts;
create policy "Approved members read feed posts" on public.team_feed_posts
  for select to authenticated
  using (public.is_approved_team_member());

drop policy if exists "Approved members create feed posts" on public.team_feed_posts;
create policy "Approved members create feed posts" on public.team_feed_posts
  for insert to authenticated
  with check (
    public.is_approved_team_member()
    and author_id = auth.uid()
    and pinned_at is null
    and pinned_by is null
  );

drop policy if exists "Authors update feed posts" on public.team_feed_posts;
create policy "Authors update feed posts" on public.team_feed_posts
  for update to authenticated
  using (
    public.is_approved_team_member()
    and (author_id = auth.uid() or public.is_team_admin())
  )
  with check (
    public.is_approved_team_member()
    and (author_id = auth.uid() or public.is_team_admin())
  );

drop policy if exists "Authors delete feed posts" on public.team_feed_posts;
create policy "Authors delete feed posts" on public.team_feed_posts
  for delete to authenticated
  using (
    public.is_approved_team_member()
    and (author_id = auth.uid() or public.is_team_admin())
  );

drop policy if exists "Approved members read feed comments" on public.team_feed_comments;
create policy "Approved members read feed comments" on public.team_feed_comments
  for select to authenticated
  using (public.is_approved_team_member());

drop policy if exists "Approved members create feed comments" on public.team_feed_comments;
create policy "Approved members create feed comments" on public.team_feed_comments
  for insert to authenticated
  with check (
    public.is_approved_team_member()
    and author_id = auth.uid()
  );

drop policy if exists "Authors update feed comments" on public.team_feed_comments;
create policy "Authors update feed comments" on public.team_feed_comments
  for update to authenticated
  using (
    public.is_approved_team_member()
    and (author_id = auth.uid() or public.is_team_admin())
  )
  with check (
    public.is_approved_team_member()
    and (author_id = auth.uid() or public.is_team_admin())
  );

drop policy if exists "Authors delete feed comments" on public.team_feed_comments;
create policy "Authors delete feed comments" on public.team_feed_comments
  for delete to authenticated
  using (
    public.is_approved_team_member()
    and (author_id = auth.uid() or public.is_team_admin())
  );

drop policy if exists "Approved members read feed likes" on public.team_feed_likes;
create policy "Approved members read feed likes" on public.team_feed_likes
  for select to authenticated
  using (public.is_approved_team_member());

drop policy if exists "Members create own feed likes" on public.team_feed_likes;
create policy "Members create own feed likes" on public.team_feed_likes
  for insert to authenticated
  with check (
    public.is_approved_team_member()
    and user_id = auth.uid()
  );

drop policy if exists "Members delete own feed likes" on public.team_feed_likes;
create policy "Members delete own feed likes" on public.team_feed_likes
  for delete to authenticated
  using (
    public.is_approved_team_member()
    and user_id = auth.uid()
  );

drop policy if exists "Members read relevant feed mentions" on public.team_feed_mentions;
create policy "Members read relevant feed mentions" on public.team_feed_mentions
  for select to authenticated
  using (
    public.is_approved_team_member()
    and (
      mentioned_user_id = auth.uid()
      or created_by = auth.uid()
      or public.is_team_admin()
    )
  );

drop policy if exists "Members create feed mentions" on public.team_feed_mentions;
create policy "Members create feed mentions" on public.team_feed_mentions
  for insert to authenticated
  with check (
    public.is_approved_team_member()
    and created_by = auth.uid()
    and public.is_approved_team_member(mentioned_user_id)
  );

drop policy if exists "Recipients update feed mentions" on public.team_feed_mentions;
create policy "Recipients update feed mentions" on public.team_feed_mentions
  for update to authenticated
  using (
    public.is_approved_team_member()
    and mentioned_user_id = auth.uid()
  )
  with check (
    public.is_approved_team_member()
    and mentioned_user_id = auth.uid()
  );

grant select, insert, update, delete on public.team_feed_posts to authenticated;
grant select, insert, update, delete on public.team_feed_comments to authenticated;
grant select, insert, delete on public.team_feed_likes to authenticated;
grant select, insert, update on public.team_feed_mentions to authenticated;

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
) values (
  'team-feed-media',
  'team-feed-media',
  false,
  52428800,
  array[
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'video/mp4',
    'video/webm',
    'video/quicktime'
  ]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Approved members read team feed media" on storage.objects;
create policy "Approved members read team feed media" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'team-feed-media'
    and public.is_approved_team_member()
  );

drop policy if exists "Approved members upload team feed media" on storage.objects;
create policy "Approved members upload team feed media" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'team-feed-media'
    and public.is_approved_team_member()
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Members delete own team feed media" on storage.objects;
create policy "Members delete own team feed media" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'team-feed-media'
    and public.is_approved_team_member()
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.is_team_admin()
    )
  );

do $$
declare
  v_table text;
begin
  foreach v_table in array array[
    'team_feed_posts',
    'team_feed_comments',
    'team_feed_likes',
    'team_feed_mentions'
  ]
  loop
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = v_table
    ) then
      execute format('alter publication supabase_realtime add table public.%I', v_table);
    end if;
  end loop;
end $$;
