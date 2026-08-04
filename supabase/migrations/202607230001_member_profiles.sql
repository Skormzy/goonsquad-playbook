create table if not exists public.member_player_claims (
  user_id uuid not null references public.profiles(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete restrict,
  is_primary boolean not null default false,
  linked_at timestamptz not null default now(),
  primary key (user_id, player_id)
);

-- Keep the foundational table safe to rerun. Later migrations may extend the
-- claim workflow, so this migration must never remove newer columns or history.
alter table public.member_player_claims
  add column if not exists linked_at timestamptz not null default now();

-- A member can link several historical league identities, with one primary record.
create unique index if not exists member_player_claims_primary_user_idx
  on public.member_player_claims (user_id)
  where is_primary;

alter table public.member_player_claims enable row level security;

drop policy if exists "Members read own player claims" on public.member_player_claims;
create policy "Members read own player claims" on public.member_player_claims
  for select using (auth.uid() = user_id);

drop policy if exists "Team managers read player claims" on public.member_player_claims;
drop policy if exists "Team managers read member profiles" on public.profiles;

create or replace function public.request_member_player_claim(
  p_player_external_id text default null,
  p_player_id uuid default null
) returns public.member_player_claims
language plpgsql
security definer set search_path = public
as $$
declare
  v_player_id uuid;
  v_has_primary boolean;
  v_claim public.member_player_claims;
begin
  if auth.uid() is null then
    raise exception 'Sign in before linking a squad player.';
  end if;

  v_player_id := p_player_id;
  if v_player_id is null and nullif(trim(coalesce(p_player_external_id, '')), '') is not null then
    select id into v_player_id
    from public.players
    where source = 'league' and external_id = trim(p_player_external_id)
    order by active desc, created_at desc
    limit 1;
  end if;

  if v_player_id is null or not exists (select 1 from public.players where id = v_player_id) then
    raise exception 'That squad player could not be found.';
  end if;

  select exists (
    select 1 from public.member_player_claims where user_id = auth.uid() and is_primary
  ) into v_has_primary;

  insert into public.member_player_claims (user_id, player_id, is_primary, linked_at)
  values (auth.uid(), v_player_id, not v_has_primary, now())
  on conflict (user_id, player_id) do update set linked_at = public.member_player_claims.linked_at
  returning * into v_claim;

  return v_claim;
end;
$$;

create or replace function public.release_member_player_claim(
  p_player_id uuid
) returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_was_primary boolean;
begin
  if auth.uid() is null then
    raise exception 'Sign in before updating your squad profile.';
  end if;

  select is_primary into v_was_primary
  from public.member_player_claims
  where user_id = auth.uid() and player_id = p_player_id;

  delete from public.member_player_claims
  where user_id = auth.uid() and player_id = p_player_id;

  if coalesce(v_was_primary, false) then
    update public.member_player_claims
    set is_primary = true
    where (user_id, player_id) = (
      select user_id, player_id
      from public.member_player_claims
      where user_id = auth.uid()
      order by linked_at asc
      limit 1
    );
  end if;
end;
$$;

grant execute on function public.request_member_player_claim(text, uuid) to authenticated;
grant execute on function public.release_member_player_claim(uuid) to authenticated;
