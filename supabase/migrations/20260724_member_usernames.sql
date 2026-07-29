alter table public.profiles
  add column if not exists username text;

create or replace function public.normalize_member_username(p_value text)
returns text
language sql
immutable
as $$
  select trim(both '_' from left(
    regexp_replace(lower(trim(coalesce(p_value, ''))), '[^a-z0-9]+', '_', 'g'),
    24
  ));
$$;

do $$
declare
  v_profile record;
  v_base text;
  v_candidate text;
  v_suffix text;
begin
  for v_profile in
    select
      profiles.id,
      profiles.username,
      profiles.display_name,
      auth.users.email
    from public.profiles
    left join auth.users on auth.users.id = profiles.id
    order by profiles.created_at asc, profiles.id asc
  loop
    v_base := public.normalize_member_username(
      coalesce(
        nullif(v_profile.username, ''),
        nullif(v_profile.display_name, ''),
        split_part(coalesce(v_profile.email, ''), '@', 1),
        'player'
      )
    );
    if length(v_base) < 3 then
      v_base := 'player';
    end if;

    v_candidate := v_base;
    if exists (
      select 1
      from public.profiles
      where id <> v_profile.id and lower(username) = lower(v_candidate)
    ) then
      v_suffix := replace(left(v_profile.id::text, 6), '-', '');
      v_candidate := left(v_base, 17) || '_' || v_suffix;
    end if;

    update public.profiles
    set username = v_candidate
    where id = v_profile.id;
  end loop;
end $$;

alter table public.profiles
  alter column username set not null;

alter table public.profiles
  drop constraint if exists profiles_username_format_check;
alter table public.profiles
  add constraint profiles_username_format_check
  check (username ~ '^[a-z0-9_]{3,24}$');

create unique index if not exists profiles_username_lower_idx
  on public.profiles (lower(username));

create or replace function public.create_profile_for_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_requested text;
  v_base text;
  v_candidate text;
begin
  v_requested := nullif(trim(coalesce(new.raw_user_meta_data ->> 'username', '')), '');

  if v_requested is not null then
    v_candidate := public.normalize_member_username(v_requested);
    if length(v_candidate) < 3 then
      raise exception 'Username must contain at least 3 letters, numbers, or underscores.';
    end if;
    if exists (select 1 from public.profiles where lower(username) = lower(v_candidate)) then
      raise exception 'Username is already taken.';
    end if;
  else
    v_base := public.normalize_member_username(
      coalesce(
        nullif(new.raw_user_meta_data ->> 'full_name', ''),
        split_part(coalesce(new.email, ''), '@', 1),
        'player'
      )
    );
    if length(v_base) < 3 then
      v_base := 'player';
    end if;
    v_candidate := v_base;
    if exists (select 1 from public.profiles where lower(username) = lower(v_candidate)) then
      v_candidate := left(v_base, 17) || '_' || replace(left(new.id::text, 6), '-', '');
    end if;
  end if;

  insert into public.profiles (id, username, display_name, avatar_url)
  values (
    new.id,
    v_candidate,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(coalesce(new.email, ''), '@', 1)),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
exception
  when unique_violation then
    raise exception 'Username is already taken.';
end;
$$;

create or replace function public.check_username_available(p_username text)
returns boolean
language plpgsql
stable
security definer set search_path = public
as $$
declare
  v_username text;
begin
  v_username := public.normalize_member_username(p_username);
  if length(v_username) < 3 or v_username !~ '^[a-z0-9_]{3,24}$' then
    return false;
  end if;
  return not exists (
    select 1 from public.profiles where lower(username) = lower(v_username)
  );
end;
$$;

create or replace function public.update_my_member_profile(
  p_display_name text,
  p_username text
) returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_username text;
  v_display_name text;
begin
  if auth.uid() is null then
    raise exception 'Sign in before updating your profile.';
  end if;

  v_username := public.normalize_member_username(p_username);
  v_display_name := left(trim(coalesce(p_display_name, '')), 80);

  if length(v_username) < 3 or v_username !~ '^[a-z0-9_]{3,24}$' then
    raise exception 'Username must be 3 to 24 characters using letters, numbers, or underscores.';
  end if;
  if v_display_name = '' then
    raise exception 'Display name is required.';
  end if;
  if exists (
    select 1
    from public.profiles
    where id <> auth.uid() and lower(username) = lower(v_username)
  ) then
    raise exception 'Username is already taken.';
  end if;

  update public.profiles
  set
    display_name = v_display_name,
    username = v_username,
    updated_at = now()
  where id = auth.uid();
exception
  when unique_violation then
    raise exception 'Username is already taken.';
end;
$$;

revoke all on function public.check_username_available(text) from public;
revoke all on function public.update_my_member_profile(text, text) from public;
grant execute on function public.check_username_available(text) to anon, authenticated;
grant execute on function public.update_my_member_profile(text, text) to authenticated;
