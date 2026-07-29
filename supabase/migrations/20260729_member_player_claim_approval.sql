-- Player profiles use a two-way linking workflow:
-- 1. Members request their player record and an admin reviews it.
-- 2. Admins can directly assign a player record without a member request.

alter table public.member_player_claims
  add column if not exists status text,
  add column if not exists requested_at timestamptz,
  add column if not exists reviewed_at timestamptz,
  add column if not exists reviewed_by uuid references public.profiles(id) on delete set null;

-- Preserve links created by the earlier self-serve workflow.
update public.member_player_claims
set
  status = 'approved',
  requested_at = coalesce(requested_at, linked_at),
  reviewed_at = coalesce(reviewed_at, linked_at)
where status is null;

update public.member_player_claims
set requested_at = coalesce(requested_at, linked_at)
where requested_at is null;

update public.member_player_claims
set reviewed_at = coalesce(reviewed_at, linked_at)
where status in ('approved', 'rejected')
  and reviewed_at is null;

-- An older self-serve deployment may have linked one player to several accounts.
-- Do not guess which account is correct: remove every ambiguous link from the
-- active set so each member can submit a fresh request.
with duplicated_players as (
  select player_id
  from public.member_player_claims
  where status = 'approved'
  group by player_id
  having count(*) > 1
)
update public.member_player_claims as claim
set
  status = 'rejected',
  is_primary = false,
  reviewed_at = now(),
  reviewed_by = null
from duplicated_players
where duplicated_players.player_id = claim.player_id;

update public.member_player_claims
set is_primary = false;

with ranked_primary_links as (
  select
    user_id,
    player_id,
    row_number() over (
      partition by user_id
      order by linked_at desc, player_id asc
    ) as primary_rank
  from public.member_player_claims
  where status = 'approved'
)
update public.member_player_claims as claim
set is_primary = true
from ranked_primary_links
where ranked_primary_links.user_id = claim.user_id
  and ranked_primary_links.player_id = claim.player_id
  and ranked_primary_links.primary_rank = 1;

alter table public.member_player_claims
  alter column status set default 'pending',
  alter column status set not null,
  alter column requested_at set default now(),
  alter column requested_at set not null;

alter table public.member_player_claims
  drop constraint if exists member_player_claims_status_check;
alter table public.member_player_claims
  add constraint member_player_claims_status_check
  check (status in ('pending', 'approved', 'rejected'));

alter table public.member_player_claims
  drop constraint if exists member_player_claims_primary_status_check;
alter table public.member_player_claims
  add constraint member_player_claims_primary_status_check
  check (not is_primary or status = 'approved');

create unique index if not exists member_player_claims_approved_player_idx
  on public.member_player_claims (player_id)
  where status = 'approved';

create unique index if not exists member_player_claims_pending_user_idx
  on public.member_player_claims (user_id)
  where status = 'pending';

create or replace function public.request_member_player_claim(
  p_player_external_id text default null,
  p_player_id uuid default null
) returns public.member_player_claims
language plpgsql
security definer set search_path = public
as $$
declare
  v_player_id uuid;
  v_claim public.member_player_claims;
begin
  if auth.uid() is null then
    raise exception 'Sign in before requesting a player profile.';
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

  if exists (
    select 1
    from public.member_player_claims
    where player_id = v_player_id
      and status = 'approved'
      and user_id <> auth.uid()
  ) then
    raise exception 'That player profile is already linked to another account.';
  end if;

  if exists (
    select 1
    from public.member_player_claims
    where user_id = auth.uid()
      and status = 'pending'
      and player_id <> v_player_id
  ) then
    raise exception 'You already have a player-link request awaiting review.';
  end if;

  insert into public.member_player_claims (
    user_id,
    player_id,
    status,
    is_primary,
    requested_at,
    reviewed_at,
    reviewed_by,
    linked_at
  )
  values (
    auth.uid(),
    v_player_id,
    'pending',
    false,
    now(),
    null,
    null,
    now()
  )
  on conflict (user_id, player_id) do update set
    status = case
      when public.member_player_claims.status = 'approved' then 'approved'
      else 'pending'
    end,
    requested_at = case
      when public.member_player_claims.status = 'approved'
        then public.member_player_claims.requested_at
      else now()
    end,
    reviewed_at = case
      when public.member_player_claims.status = 'approved'
        then public.member_player_claims.reviewed_at
      else null
    end,
    reviewed_by = case
      when public.member_player_claims.status = 'approved'
        then public.member_player_claims.reviewed_by
      else null
    end
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
        and status = 'approved'
      order by linked_at desc
      limit 1
    );
  end if;
end;
$$;

create or replace function public.assert_player_link_admin(
  p_actor_id uuid,
  p_user_id uuid
) returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_actor_role text;
  v_target_role text;
  v_owner_id uuid;
begin
  select role into v_actor_role from public.profiles where id = p_actor_id;
  select role into v_target_role from public.profiles where id = p_user_id;

  if v_actor_role is distinct from 'admin' then
    raise exception 'Admin access is required.';
  end if;
  if v_target_role is null then
    raise exception 'That member account no longer exists.';
  end if;

  if v_target_role = 'admin' and p_user_id is distinct from p_actor_id then
    select id into v_owner_id
    from public.profiles
    where role = 'admin'
    order by created_at asc
    limit 1;

    if p_actor_id is distinct from v_owner_id then
      raise exception 'Only the account owner can manage another admin.';
    end if;
  end if;
end;
$$;

create or replace function public.review_member_player_claim(
  p_actor_id uuid,
  p_user_id uuid,
  p_player_id uuid,
  p_decision text
) returns public.member_player_claims
language plpgsql
security definer set search_path = public
as $$
declare
  v_claim public.member_player_claims;
begin
  perform public.assert_player_link_admin(p_actor_id, p_user_id);

  if p_decision not in ('approved', 'rejected') then
    raise exception 'Review decision must be approved or rejected.';
  end if;

  select * into v_claim
  from public.member_player_claims
  where user_id = p_user_id and player_id = p_player_id
  for update;

  if v_claim.user_id is null then
    raise exception 'That player-link request no longer exists.';
  end if;

  if p_decision = 'approved' then
    if exists (
      select 1
      from public.member_player_claims
      where player_id = p_player_id
        and status = 'approved'
        and user_id <> p_user_id
    ) then
      raise exception 'That player profile is already linked to another account.';
    end if;

    update public.member_player_claims
    set is_primary = false
    where user_id = p_user_id and status = 'approved';

    update public.member_player_claims
    set
      status = 'rejected',
      is_primary = false,
      reviewed_at = now(),
      reviewed_by = p_actor_id
    where player_id = p_player_id
      and status = 'pending'
      and user_id <> p_user_id;
  end if;

  update public.member_player_claims
  set
    status = p_decision,
    is_primary = p_decision = 'approved',
    reviewed_at = now(),
    reviewed_by = p_actor_id,
    linked_at = case when p_decision = 'approved' then now() else linked_at end
  where user_id = p_user_id and player_id = p_player_id
  returning * into v_claim;

  return v_claim;
end;
$$;

create or replace function public.assign_member_player_claim(
  p_actor_id uuid,
  p_user_id uuid,
  p_player_id uuid
) returns public.member_player_claims
language plpgsql
security definer set search_path = public
as $$
declare
  v_claim public.member_player_claims;
begin
  perform public.assert_player_link_admin(p_actor_id, p_user_id);

  if not exists (select 1 from public.players where id = p_player_id) then
    raise exception 'That squad player could not be found.';
  end if;

  if exists (
    select 1
    from public.member_player_claims
    where player_id = p_player_id
      and status = 'approved'
      and user_id <> p_user_id
  ) then
    raise exception 'That player profile is already linked to another account.';
  end if;

  update public.member_player_claims
  set is_primary = false
  where user_id = p_user_id and status = 'approved';

  update public.member_player_claims
  set
    status = 'rejected',
    is_primary = false,
    reviewed_at = now(),
    reviewed_by = p_actor_id
  where user_id = p_user_id and status = 'pending';

  update public.member_player_claims
  set
    status = 'rejected',
    is_primary = false,
    reviewed_at = now(),
    reviewed_by = p_actor_id
  where player_id = p_player_id
    and status = 'pending'
    and user_id <> p_user_id;

  insert into public.member_player_claims (
    user_id,
    player_id,
    status,
    is_primary,
    requested_at,
    reviewed_at,
    reviewed_by,
    linked_at
  )
  values (
    p_user_id,
    p_player_id,
    'approved',
    true,
    now(),
    now(),
    p_actor_id,
    now()
  )
  on conflict (user_id, player_id) do update set
    status = 'approved',
    is_primary = true,
    reviewed_at = now(),
    reviewed_by = p_actor_id,
    linked_at = now()
  returning * into v_claim;

  return v_claim;
end;
$$;

create or replace function public.unassign_member_player_claim(
  p_actor_id uuid,
  p_user_id uuid,
  p_player_id uuid
) returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_was_primary boolean;
begin
  perform public.assert_player_link_admin(p_actor_id, p_user_id);

  select is_primary into v_was_primary
  from public.member_player_claims
  where user_id = p_user_id and player_id = p_player_id;

  delete from public.member_player_claims
  where user_id = p_user_id and player_id = p_player_id;

  if coalesce(v_was_primary, false) then
    update public.member_player_claims
    set is_primary = true
    where (user_id, player_id) = (
      select user_id, player_id
      from public.member_player_claims
      where user_id = p_user_id and status = 'approved'
      order by linked_at desc
      limit 1
    );
  end if;
end;
$$;

revoke execute on function public.review_member_player_claim(uuid, uuid, uuid, text)
  from public, anon, authenticated;
revoke execute on function public.assign_member_player_claim(uuid, uuid, uuid)
  from public, anon, authenticated;
revoke execute on function public.unassign_member_player_claim(uuid, uuid, uuid)
  from public, anon, authenticated;
revoke execute on function public.assert_player_link_admin(uuid, uuid)
  from public, anon, authenticated;

grant execute on function public.request_member_player_claim(text, uuid) to authenticated;
grant execute on function public.release_member_player_claim(uuid) to authenticated;
grant execute on function public.review_member_player_claim(uuid, uuid, uuid, text) to service_role;
grant execute on function public.assign_member_player_claim(uuid, uuid, uuid) to service_role;
grant execute on function public.unassign_member_player_claim(uuid, uuid, uuid) to service_role;
grant execute on function public.assert_player_link_admin(uuid, uuid) to service_role;
