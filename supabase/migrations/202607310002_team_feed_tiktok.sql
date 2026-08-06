-- Add the official Goon Squad TikTok account as a validated Squad Live source.

alter table public.team_feed_posts
  drop constraint if exists team_feed_posts_source_type_check,
  add constraint team_feed_posts_source_type_check
    check (
      source_type in (
        'member',
        'result',
        'instagram',
        'youtube',
        'tiktok',
        'system'
      )
    );

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
        'tiktok',
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
