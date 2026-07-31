-- First-class official activity and richer member reactions for Squad Live.
-- The import RPC is intentionally narrow: it can only upsert validated,
-- source-linked feed posts and cannot touch accounts, comments, or reactions.

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

alter table public.team_feed_posts
  alter column author_id drop not null,
  add column if not exists source_type text not null default 'member',
  add column if not exists source_key text,
  add column if not exists source_label text,
  add column if not exists source_title text,
  add column if not exists source_image_url text,
  add column if not exists source_published_at timestamptz,
  add column if not exists source_metadata jsonb not null default '{}'::jsonb;

alter table public.team_feed_posts
  drop constraint if exists team_feed_posts_source_type_check,
  add constraint team_feed_posts_source_type_check
    check (source_type in ('member', 'result', 'instagram', 'youtube', 'system')),
  drop constraint if exists team_feed_posts_author_source_check,
  add constraint team_feed_posts_author_source_check
    check (
      (source_type = 'member' and author_id is not null and source_key is null)
      or
      (
        source_type <> 'member'
        and author_id is null
        and source_key is not null
        and source_published_at is not null
      )
    ),
  drop constraint if exists team_feed_posts_source_key_length_check,
  add constraint team_feed_posts_source_key_length_check
    check (source_key is null or char_length(source_key) between 3 and 240),
  drop constraint if exists team_feed_posts_source_label_length_check,
  add constraint team_feed_posts_source_label_length_check
    check (source_label is null or char_length(source_label) <= 80),
  drop constraint if exists team_feed_posts_source_title_length_check,
  add constraint team_feed_posts_source_title_length_check
    check (source_title is null or char_length(source_title) <= 240),
  drop constraint if exists team_feed_posts_source_image_url_check,
  add constraint team_feed_posts_source_image_url_check
    check (
      source_image_url is null
      or (
        char_length(source_image_url) <= 2048
        and source_image_url ~ '^https://'
      )
    ),
  drop constraint if exists team_feed_posts_source_metadata_check,
  add constraint team_feed_posts_source_metadata_check
    check (jsonb_typeof(source_metadata) = 'object');

create unique index if not exists team_feed_posts_source_key_unique_idx
  on public.team_feed_posts (source_key)
  where source_key is not null;

create index if not exists team_feed_posts_source_published_idx
  on public.team_feed_posts (source_published_at desc)
  where source_published_at is not null;

create or replace function public.protect_team_feed_source_fields()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
begin
  if auth.uid() is not null
    and not public.is_team_admin()
    and (
      new.source_type is distinct from old.source_type
      or new.source_key is distinct from old.source_key
      or new.source_label is distinct from old.source_label
      or new.source_title is distinct from old.source_title
      or new.source_image_url is distinct from old.source_image_url
      or new.source_published_at is distinct from old.source_published_at
      or new.source_metadata is distinct from old.source_metadata
      or new.author_id is distinct from old.author_id
    )
  then
    raise exception 'Only a team admin can change official activity fields.';
  end if;
  return new;
end;
$$;

drop trigger if exists protect_team_feed_source_fields_before_update
  on public.team_feed_posts;
create trigger protect_team_feed_source_fields_before_update
  before update on public.team_feed_posts
  for each row execute function public.protect_team_feed_source_fields();

drop policy if exists "Approved members create feed posts" on public.team_feed_posts;
create policy "Approved members create feed posts" on public.team_feed_posts
  for insert to authenticated
  with check (
    public.is_approved_team_member()
    and author_id = auth.uid()
    and source_type = 'member'
    and source_key is null
    and pinned_at is null
    and pinned_by is null
  );

create table if not exists public.team_feed_reactions (
  post_id uuid not null references public.team_feed_posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  reaction text not null
    check (reaction in ('like', 'heart', 'fire', 'celebrate', 'laugh', 'wow')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

insert into public.team_feed_reactions (post_id, user_id, reaction, created_at)
select post_id, user_id, 'like', created_at
from public.team_feed_likes
on conflict (post_id, user_id) do nothing;

drop trigger if exists touch_updated_at_before_update on public.team_feed_reactions;
create trigger touch_updated_at_before_update
  before update on public.team_feed_reactions
  for each row execute function public.touch_updated_at();

alter table public.team_feed_reactions enable row level security;

drop policy if exists "Approved members read feed reactions"
  on public.team_feed_reactions;
create policy "Approved members read feed reactions"
  on public.team_feed_reactions
  for select to authenticated
  using (public.is_approved_team_member());

drop policy if exists "Members create own feed reactions"
  on public.team_feed_reactions;
create policy "Members create own feed reactions"
  on public.team_feed_reactions
  for insert to authenticated
  with check (
    public.is_approved_team_member()
    and user_id = auth.uid()
  );

drop policy if exists "Members update own feed reactions"
  on public.team_feed_reactions;
create policy "Members update own feed reactions"
  on public.team_feed_reactions
  for update to authenticated
  using (
    public.is_approved_team_member()
    and user_id = auth.uid()
  )
  with check (
    public.is_approved_team_member()
    and user_id = auth.uid()
  );

drop policy if exists "Members delete own feed reactions"
  on public.team_feed_reactions;
create policy "Members delete own feed reactions"
  on public.team_feed_reactions
  for delete to authenticated
  using (
    public.is_approved_team_member()
    and user_id = auth.uid()
  );

grant select, insert, update, delete
  on public.team_feed_reactions to authenticated;

create table if not exists private.goonsquad_feed_ingest_gate (
  id boolean primary key default true check (id),
  token_hash text not null,
  active boolean not null default true,
  updated_at timestamptz not null default now()
);

alter table private.goonsquad_feed_ingest_gate enable row level security;
revoke all on table private.goonsquad_feed_ingest_gate
  from public, anon, authenticated;

insert into private.goonsquad_feed_ingest_gate (
  id,
  token_hash,
  active,
  updated_at
) values (
  true,
  '7a06049568ae4e4ee1a865fe96b75bfd',
  true,
  now()
)
on conflict (id) do update set
  token_hash = excluded.token_hash,
  active = true,
  updated_at = now();

create or replace function public.goonsquad_feed_upsert(
  p_token text,
  p_items jsonb
) returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private, pg_temp
as $$
declare
  affected integer := 0;
begin
  if not exists (
    select 1
    from private.goonsquad_feed_ingest_gate
    where id = true
      and active = true
      and token_hash = md5(p_token)
  ) then
    raise exception 'The Goon Squad feed import token is invalid.';
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' then
    raise exception 'Feed items must be a JSON array.';
  end if;

  if jsonb_array_length(p_items) > 250 then
    raise exception 'Feed imports are limited to 250 items per request.';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_items) as item
    where
      not (item ? 'sourceKey')
      or not (item ? 'sourceType')
      or not (item ? 'sourcePublishedAt')
      or coalesce(item->>'sourceType', '') not in (
        'result',
        'instagram',
        'youtube',
        'system'
      )
      or char_length(coalesce(item->>'sourceKey', '')) not between 3 and 240
      or char_length(coalesce(item->>'body', '')) > 3000
      or char_length(coalesce(item->>'sourceTitle', '')) > 240
      or char_length(coalesce(item->>'sourceLabel', '')) > 80
      or (
        length(trim(coalesce(item->>'body', ''))) = 0
        and length(trim(coalesce(item->>'linkUrl', ''))) = 0
      )
      or (
        coalesce(item->>'linkUrl', '') <> ''
        and (
          char_length(item->>'linkUrl') > 2048
          or (item->>'linkUrl') !~ '^https://'
        )
      )
      or (
        coalesce(item->>'sourceImageUrl', '') <> ''
        and (
          char_length(item->>'sourceImageUrl') > 2048
          or (item->>'sourceImageUrl') !~ '^https://'
        )
      )
      or (
        item ? 'sourceMetadata'
        and jsonb_typeof(item->'sourceMetadata') <> 'object'
      )
  ) then
    raise exception 'A feed item failed source, content, or URL validation.';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_items) as item
    join public.team_feed_posts as post
      on post.source_key = item->>'sourceKey'
    where post.source_type <> item->>'sourceType'
  ) then
    raise exception 'A feed source key cannot change source type.';
  end if;

  insert into public.team_feed_posts (
    author_id,
    body,
    link_url,
    source_type,
    source_key,
    source_label,
    source_title,
    source_image_url,
    source_published_at,
    source_metadata,
    created_at,
    updated_at
  )
  select
    null,
    coalesce(item.body, ''),
    nullif(item."linkUrl", ''),
    item."sourceType",
    item."sourceKey",
    nullif(item."sourceLabel", ''),
    nullif(item."sourceTitle", ''),
    nullif(item."sourceImageUrl", ''),
    item."sourcePublishedAt",
    coalesce(item."sourceMetadata", '{}'::jsonb),
    item."sourcePublishedAt",
    now()
  from jsonb_to_recordset(p_items) as item(
    "sourceKey" text,
    "sourceType" text,
    "sourceLabel" text,
    "sourceTitle" text,
    body text,
    "linkUrl" text,
    "sourceImageUrl" text,
    "sourcePublishedAt" timestamptz,
    "sourceMetadata" jsonb
  )
  on conflict (source_key) where source_key is not null
  do update set
    body = excluded.body,
    link_url = excluded.link_url,
    source_label = excluded.source_label,
    source_title = excluded.source_title,
    source_image_url = excluded.source_image_url,
    source_published_at = excluded.source_published_at,
    source_metadata = excluded.source_metadata,
    updated_at = now()
  where public.team_feed_posts.source_type = excluded.source_type;

  get diagnostics affected = row_count;

  return jsonb_build_object(
    'processed', jsonb_array_length(p_items),
    'affected', affected
  );
end;
$$;

revoke all on function public.goonsquad_feed_upsert(text, jsonb)
  from public, anon, authenticated;
grant execute on function public.goonsquad_feed_upsert(text, jsonb) to anon;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'team_feed_reactions'
  ) then
    alter publication supabase_realtime
      add table public.team_feed_reactions;
  end if;
end $$;

select
  'Squad Live activity automation ready' as status,
  (select count(*) from public.team_feed_reactions) as migrated_reactions;
