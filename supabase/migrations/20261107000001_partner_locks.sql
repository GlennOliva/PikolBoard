-- Partner locks for doubles sessions.
--
-- A lock is an organizer-owned, session-scoped promise that two players are
-- selected and placed on the same team. It survives completed and cancelled
-- matches. The row is never deleted so the history of who was locked with whom
-- remains available to organizers; releasing a lock only flips it inactive.
--
-- All writes are RPC-only. The table has no INSERT/UPDATE/DELETE policy, and
-- every RPC takes the session row lock first, which serializes lock changes
-- with queue, lineup, and attendance mutations for that session.

begin;

create table if not exists public.session_partner_locks (
  id uuid primary key default extensions.gen_random_uuid(),
  session_id uuid not null references public.sessions (id) on delete cascade,
  player_a_id uuid not null references public.players (id) on delete cascade,
  player_b_id uuid not null references public.players (id) on delete cascade,
  active boolean not null default true,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  released_at timestamptz,
  released_by uuid references auth.users (id) on delete set null,
  constraint session_partner_locks_distinct_players
    check (player_a_id <> player_b_id),
  -- Canonical ordering makes a reverse pair impossible to store as a second row.
  constraint session_partner_locks_canonical_pair
    check (player_a_id < player_b_id),
  constraint session_partner_locks_release_consistent
    check (
      (active and released_at is null)
      or (not active and released_at is not null)
    )
);

create unique index if not exists session_partner_locks_active_pair_key
  on public.session_partner_locks (session_id, player_a_id, player_b_id)
  where active;

create index if not exists session_partner_locks_session_active_idx
  on public.session_partner_locks (session_id, created_at)
  where active;
create index if not exists session_partner_locks_player_a_active_idx
  on public.session_partner_locks (player_a_id)
  where active;
create index if not exists session_partner_locks_player_b_active_idx
  on public.session_partner_locks (player_b_id)
  where active;

-- One player can be in at most one active pair. The canonical pair index above
-- catches an exact repeat; this trigger also catches a player appearing on the
-- other side of a different pair. RPCs serialize per session, so two concurrent
-- lock writes cannot slip between the check and the insert.
create or replace function private.enforce_one_active_partner_lock()
returns trigger
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
begin
  if not new.active then
    return new;
  end if;

  if exists (
    select 1
    from public.session_partner_locks l
    where l.session_id = new.session_id
      and l.active
      and l.id <> new.id
      and (
        l.player_a_id in (new.player_a_id, new.player_b_id)
        or l.player_b_id in (new.player_a_id, new.player_b_id)
      )
  ) then
    raise exception 'One of those players already has an active partner lock'
      using errcode = '23505';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_one_active_partner_lock
  on public.session_partner_locks;
create trigger trg_one_active_partner_lock
  before insert or update on public.session_partner_locks
  for each row execute function private.enforce_one_active_partner_lock();

-- A lineup may omit a locked pair entirely, but it may not include one partner
-- without the other, and it may not put them on opposite teams. This trigger is
-- the durable backstop for every lineup write path, including future RPCs that
-- forget to re-check locks. AFTER ROW triggers run after the whole statement, so
-- a four-row INSERT is visible in full when the first row is checked.
create or replace function private.enforce_partner_locks_on_lineups()
returns trigger
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_match_id uuid;
  v_session_id uuid;
  v_lock record;
  v_has_a boolean;
  v_has_b boolean;
  v_teams integer;
begin
  if tg_op = 'DELETE' then
    v_match_id := old.match_id;
  else
    v_match_id := new.match_id;
  end if;

  select session_id into v_session_id
  from public.matches
  where id = v_match_id;

  if v_session_id is null then
    return null;
  end if;

  for v_lock in
    select player_a_id, player_b_id
    from public.session_partner_locks
    where session_id = v_session_id and active
  loop
    select
      exists (
        select 1 from public.match_players
        where match_id = v_match_id and player_id = v_lock.player_a_id
      ),
      exists (
        select 1 from public.match_players
        where match_id = v_match_id and player_id = v_lock.player_b_id
      )
    into v_has_a, v_has_b;

    if v_has_a <> v_has_b then
      raise exception 'Locked partners must be selected together in a lineup'
        using errcode = '22023';
    end if;

    if v_has_a and v_has_b then
      select count(distinct team_number) into v_teams
      from public.match_players
      where match_id = v_match_id
        and player_id in (v_lock.player_a_id, v_lock.player_b_id);

      if v_teams <> 1 then
        raise exception 'Locked partners must play on the same team'
          using errcode = '22023';
      end if;
    end if;
  end loop;

  return null;
end;
$$;

drop trigger if exists trg_enforce_partner_locks_on_lineups
  on public.match_players;
create trigger trg_enforce_partner_locks_on_lineups
  after insert or delete or update of match_id, player_id, team_number
  on public.match_players
  for each row execute function private.enforce_partner_locks_on_lineups();

-- ---------------------------------------------------------------------------
-- RPCs
-- ---------------------------------------------------------------------------

create or replace function public.create_partner_lock(
  p_session_id uuid,
  p_player_a_id uuid,
  p_player_b_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_session public.sessions%rowtype;
  v_a public.session_players%rowtype;
  v_b public.session_players%rowtype;
  v_a_id uuid;
  v_b_id uuid;
  v_lock_id uuid;
begin
  select * into v_session
  from public.sessions
  where id = p_session_id
  for update;

  if v_session.id is null then
    raise exception 'Session not found' using errcode = 'P0002';
  end if;

  if not private.is_club_admin(v_session.club_id) then
    raise exception 'Only club organizers can lock partners'
      using errcode = '42501';
  end if;

  if v_session.status <> 'active' then
    raise exception 'Partner locks can only be created in a live session'
      using errcode = '22023';
  end if;

  if v_session.format <> 'doubles' then
    raise exception 'Partner locks are only available for doubles sessions'
      using errcode = '22023';
  end if;

  if p_player_a_id is null or p_player_b_id is null then
    raise exception 'Choose two players to lock together'
      using errcode = '22023';
  end if;

  if p_player_a_id = p_player_b_id then
    raise exception 'A player cannot be locked with themselves'
      using errcode = '22023';
  end if;

  -- Store the pair in a canonical order. Reverse input is accepted; the table
  -- constraint and unique index make the reverse pair the same lock.
  if p_player_a_id < p_player_b_id then
    v_a_id := p_player_a_id;
    v_b_id := p_player_b_id;
  else
    v_a_id := p_player_b_id;
    v_b_id := p_player_a_id;
  end if;

  select * into v_a
  from public.session_players
  where session_id = p_session_id and player_id = v_a_id
  for update;

  select * into v_b
  from public.session_players
  where session_id = p_session_id and player_id = v_b_id
  for update;

  if v_a.id is null or v_b.id is null then
    raise exception 'Both players must be in this session'
      using errcode = '22023';
  end if;

  if exists (
    select 1
    from public.players p
    where p.id in (v_a_id, v_b_id)
      and p.club_id <> v_session.club_id
  ) then
    raise exception 'Both players must belong to this club'
      using errcode = '22023';
  end if;

  if v_a.attendance_status <> 'waiting' or v_b.attendance_status <> 'waiting' then
    raise exception
      'Both players must be checked in and waiting before you can lock them'
      using errcode = '22023';
  end if;

  if exists (
    select 1
    from public.match_players mp
    where mp.session_id = p_session_id
      and mp.player_id in (v_a_id, v_b_id)
      and mp.result is null
  ) then
    raise exception
      'A player in a match or lineup cannot be locked. Finish or cancel it first.'
      using errcode = '22023';
  end if;

  if exists (
    select 1
    from public.session_partner_locks l
    where l.session_id = p_session_id
      and l.active
      and (
        l.player_a_id in (v_a_id, v_b_id)
        or l.player_b_id in (v_a_id, v_b_id)
      )
  ) then
    raise exception 'One of those players already has an active partner lock'
      using errcode = '23505';
  end if;

  insert into public.session_partner_locks (
    session_id, player_a_id, player_b_id, created_by
  )
  values (p_session_id, v_a_id, v_b_id, auth.uid())
  returning id into v_lock_id;

  -- Realtime pages watch session_players, not this table. Touching both roster
  -- rows makes organizers and the public board refresh immediately without
  -- giving anonymous readers a direct grant on the lock table.
  update public.session_players
  set updated_at = now()
  where session_id = p_session_id
    and player_id in (v_a_id, v_b_id);

  return v_lock_id;
end;
$$;

create or replace function public.release_partner_lock(
  p_session_id uuid,
  p_lock_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_session public.sessions%rowtype;
  v_lock public.session_partner_locks%rowtype;
begin
  select * into v_session
  from public.sessions
  where id = p_session_id
  for update;

  if v_session.id is null then
    raise exception 'Session not found' using errcode = 'P0002';
  end if;

  if not private.is_club_admin(v_session.club_id) then
    raise exception 'Only club organizers can release partner locks'
      using errcode = '42501';
  end if;

  select * into v_lock
  from public.session_partner_locks
  where id = p_lock_id and session_id = p_session_id
  for update;

  if v_lock.id is null then
    raise exception 'Partner lock not found' using errcode = 'P0002';
  end if;

  if not v_lock.active then
    return;
  end if;

  if exists (
    select 1
    from public.match_players mp
    where mp.session_id = p_session_id
      and mp.player_id in (v_lock.player_a_id, v_lock.player_b_id)
      and mp.result is null
  ) then
    raise exception
      'Those partners are in a match or lineup. Finish or cancel it before unlocking them.'
      using errcode = '22023';
  end if;

  update public.session_partner_locks
  set active = false,
      released_at = now(),
      released_by = auth.uid()
  where id = v_lock.id;

  update public.session_players
  set updated_at = now()
  where session_id = p_session_id
    and player_id in (v_lock.player_a_id, v_lock.player_b_id);
end;
$$;

-- Removing a roster row while its partner lock is active would leave the other
-- partner locked to somebody who is no longer in the session. Force an explicit
-- unlock first, which also makes the consequence visible to the organizer.
create or replace function public.remove_session_player(
  p_session_id uuid,
  p_player_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_session public.sessions%rowtype;
  v_sp public.session_players%rowtype;
begin
  select * into v_session
  from public.sessions
  where id = p_session_id
  for update;

  if v_session.id is null then
    raise exception 'Session not found' using errcode = 'P0002';
  end if;

  if not private.is_club_admin(v_session.club_id) then
    raise exception 'Only club organizers can change the roster'
      using errcode = '42501';
  end if;

  if v_session.status in ('completed', 'cancelled') then
    raise exception 'This session is closed' using errcode = '22023';
  end if;

  select * into v_sp
  from public.session_players
  where session_id = p_session_id
    and player_id = p_player_id
  for update;

  if v_sp.id is null then
    return;
  end if;

  if exists (
    select 1
    from public.session_partner_locks l
    where l.session_id = p_session_id
      and l.active
      and p_player_id in (l.player_a_id, l.player_b_id)
  ) then
    raise exception
      'That player has an active partner lock. Unlock the pair before removing them.'
      using errcode = '22023';
  end if;

  if exists (
    select 1
    from public.match_players mp
    where mp.session_id = p_session_id
      and mp.player_id = p_player_id
      and mp.result is null
  ) then
    raise exception
      'That player is in a match or lineup. Finish or cancel it before removing them.'
      using errcode = '22023';
  end if;

  if v_sp.attendance_status in ('playing', 'staged') then
    raise exception
      'That player is in a match. Finish or cancel it before removing them.'
      using errcode = '22023';
  end if;

  delete from public.session_players
  where id = v_sp.id;

  perform private.log_queue_event(
    p_session_id, null, p_player_id, 'session_player_removed',
    v_sp.attendance_status, null
  );
end;
$$;

-- Read-only public partner-lock display. No player ids, auth ids, or lock ids
-- cross this boundary; the public board only needs the names and levels of the
-- pair that is promised to play together.
create or replace function public.get_public_partner_locks(p_public_token uuid)
returns jsonb
language sql
stable
security definer
set search_path = public, private, pg_temp
as $$
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'display_name_a', pa.display_name,
        'skill_level_a', pa.skill_level,
        'display_name_b', pb.display_name,
        'skill_level_b', pb.skill_level
      )
      order by l.created_at, pa.display_name
    ),
    '[]'::jsonb
  )
  from public.sessions s
  join public.session_partner_locks l
    on l.session_id = s.id and l.active
  join public.players pa on pa.id = l.player_a_id
  join public.players pb on pb.id = l.player_b_id
  where s.public_live_token = p_public_token
    and (
      (s.player_live_enabled and s.status = 'active')
      or (
        s.player_live_enabled
        and s.status = 'completed'
        and s.results_published
      )
    );
$$;

-- ---------------------------------------------------------------------------
-- RLS and grants
-- ---------------------------------------------------------------------------

alter table public.session_partner_locks enable row level security;

drop policy if exists session_partner_locks_select on public.session_partner_locks;
create policy session_partner_locks_select on public.session_partner_locks
  for select to authenticated
  using (
    exists (
      select 1
      from public.sessions s
      where s.id = session_partner_locks.session_id
        and private.is_club_admin(s.club_id)
    )
  );

revoke all on table public.session_partner_locks from public, anon, authenticated;
grant select on table public.session_partner_locks to authenticated;

revoke all on function
  public.create_partner_lock(uuid, uuid, uuid),
  public.release_partner_lock(uuid, uuid)
from public, anon;

grant execute on function
  public.create_partner_lock(uuid, uuid, uuid),
  public.release_partner_lock(uuid, uuid)
to authenticated;

revoke all on function public.get_public_partner_locks(uuid) from public;
grant execute on function public.get_public_partner_locks(uuid)
  to anon, authenticated;

commit;
