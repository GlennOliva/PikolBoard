-- 0016: Preparation -> Up Next -> Staged lineup stages.
--
-- The rotation a player actually experiences is longer than "staged or
-- playing". Before anybody walks onto a court there are two more steps:
--
--   preparing  the matchmaker has built a lineup and the players are told to
--              get ready. No court yet.
--   up_next    the lineup is confirmed and waiting for a court. Still no court.
--   staged     a court has been allocated and the players are on it, unstarted.
--   playing    started.
--
-- All four share the `match_status` enum that already existed; migration 0015
-- added the two new labels. A separate queue-stage column was not introduced
-- because every one of these states is a property of a match that already has a
-- status, a court, a lineup, and a session, and splitting them would have left
-- two sources of truth that have to be reconciled on every write.
--
-- Every transition is a single security-definer function that locks the session
-- row first. That is the whole concurrency story: two organizers clicking
-- "Move to Up Next" at the same moment serialize on the session lock, and the
-- second one sees the first one's result rather than racing it. Two database
-- constraints then make a lost update impossible rather than merely unlikely:
--
--   matches_one_up_next_per_session  at most one lineup is Up Next
--   match_players_one_unresolved_per_player  (from 0000) a player holds at
--                                        most one unresolved lineup row
--
-- Forward-only. Nothing here rewrites or deletes an existing row.

begin;

-- ---------------------------------------------------------------------------
-- Remember where each lineup slot came from, so a player who is removed or
-- cancelled lands back on the queue slot they held rather than at the back of
-- it. Without this, editing a lineup silently resets somebody's wait.
-- ---------------------------------------------------------------------------

alter table public.match_players
  add column if not exists origin_queue_position integer;

comment on column public.match_players.origin_queue_position is
  'queue_position the player held when this lineup was created, used to put them back where they were.';

-- ---------------------------------------------------------------------------
-- A lineup has no court until it is staged.
--
-- Guards the invariant the RPCs depend on: `court_id is null` is what makes
-- "waiting for a court" mean something, so a preparing or up_next lineup can
-- never be mistaken for one that already has a court.
-- ---------------------------------------------------------------------------

do $$
declare
  v_offenders text;
begin
  select string_agg(id::text, ', ' order by id) into v_offenders
  from public.matches
  where court_id is null
    and status not in ('preparing', 'up_next', 'cancelled');

  if v_offenders is not null then
    raise exception
      'matches_court_required_for_court_stages cannot be added: these matches have no court and are not preparing or up_next: %',
      v_offenders;
  end if;
end $$;

alter table public.matches
  drop constraint if exists matches_court_required_for_court_stages;

-- 'cancelled' is included because cancelling a lineup that never reached a
-- court leaves court_id null, and that row has to remain recordable.
alter table public.matches
  add constraint matches_court_required_for_court_stages
  check (court_id is not null or status in ('preparing', 'up_next', 'cancelled'));

-- ---------------------------------------------------------------------------
-- One Up Next lineup per session.
--
-- This is the constraint that makes concurrent promotion safe. Two promoters
-- can both pass their "is anything Up Next" check under the session lock, but
-- only one of them can write the row, because the second would violate this.
-- The loser gets a unique-violation instead of silently creating a second head
-- of the queue.
-- ---------------------------------------------------------------------------

create unique index if not exists matches_one_up_next_per_session
  on public.matches (session_id)
  where status = 'up_next';

-- The rotation is read in stage order: oldest preparing first, then the one
-- Up Next. Matches in a terminal state are excluded, so this stays small on a
-- long session.
create index if not exists matches_lineup_pipeline_idx
  on public.matches (session_id, staged_at, match_number)
  where status in ('preparing', 'up_next');

-- ---------------------------------------------------------------------------
-- Queue helpers
-- ---------------------------------------------------------------------------

-- How many players a lineup needs in this session's format.
create or replace function private.expected_lineup_size(p_format public.session_format)
returns integer
language sql
immutable
as $$
  select case when p_format = 'singles' then 2 else 4 end;
$$;

-- Put a returning player back on the queue slot they held, without losing
-- anybody else's relative order.
--
-- Everyone from that slot onwards shifts back one place, so the slot is free
-- and the line behind it is unchanged. Falling back to the end only happens
-- when the original slot is unknown, which means the player was never in the
-- queue to begin with.
create or replace function private.reclaim_queue_slot(
  p_session_id uuid,
  p_preferred integer
)
returns integer
language plpgsql
set search_path = public, private, pg_temp
as $$
begin
  if p_preferred is null or p_preferred < 1 then
    return private.next_queue_position(p_session_id);
  end if;

  update public.session_players
  set queue_position = queue_position + 1
  where session_id = p_session_id
    and attendance_status = 'waiting'
    and queue_position is not null
    and queue_position >= p_preferred;

  return p_preferred;
end;
$$;

-- Return every player on a lineup to the waiting queue.
--
-- checked_in_at and last_enqueued_at are deliberately not touched. Those two
-- columns are the fairness record: the engine's starvation rule reads
-- last_enqueued_at, and the organizer UI reads it for "Waiting: 18 minutes".
-- Rewriting either to now() on release is what used to make an edited lineup
-- quietly jump the queue.
--
-- Callers hold the session lock. This takes its own row locks on the players so
-- two releases for the same player cannot interleave.
create or replace function private.release_lineup_players(
  p_session_id uuid,
  p_match_id uuid,
  p_event_type text,
  p_metadata jsonb default '{}'::jsonb
)
returns void
language plpgsql
set search_path = public, private, pg_temp
as $$
declare
  v_row record;
  v_sp public.session_players%rowtype;
  v_position integer;
begin
  for v_row in
    select mp.player_id, mp.origin_queue_position
    from public.match_players mp
    where mp.match_id = p_match_id
    order by mp.team_number, mp.slot_number
  loop
    select * into v_sp
    from public.session_players
    where session_id = p_session_id and player_id = v_row.player_id
    for update;

    if v_sp.id is null then
      -- The player left the session while they were in the lineup. There is no
      -- row to return, and inventing one would resurrect a checked-out player.
      continue;
    end if;

    -- Already back in the queue (a double release): leave the slot alone
    -- rather than pushing the whole queue back a second time.
    if v_sp.attendance_status = 'waiting' and v_sp.queue_position is not null then
      continue;
    end if;

    v_position := private.reclaim_queue_slot(p_session_id, v_row.origin_queue_position);

    update public.session_players
    set attendance_status = 'waiting',
        queue_position = v_position
    where id = v_sp.id;

    perform private.log_queue_event(
      p_session_id, v_sp.id, v_row.player_id, p_event_type,
      v_sp.attendance_status, 'waiting',
      coalesce(p_metadata, '{}'::jsonb)
        || jsonb_build_object('queue_position', v_position)
    );
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Eligibility
-- ---------------------------------------------------------------------------

-- Reject any incoming player who cannot legally be in this lineup.
--
-- p_match_id is the lineup being edited, or null while creating one. A player
-- already on that same lineup is allowed (that is an edit, not a collision);
-- a player on any other unresolved lineup is not, and that is the rule that
-- stops one person appearing in two places at once.
create or replace function private.assert_lineup_players_selectable(
  p_session_id uuid,
  p_club_id uuid,
  p_match_id uuid,
  p_player_ids uuid[]
)
returns void
language plpgsql
set search_path = public, private, pg_temp
as $$
declare
  v_name text;
  v_reason text;
begin
  for v_name, v_reason in
    select coalesce(p.display_name, 'That player'),
      case
        -- Ordered so the message names the actual problem: a player who is
        -- both off-roster and not-checked-in should not be told only that they
        -- are not checked in.
        when p.id is null or p.club_id <> p_club_id then 'not_on_roster'
        when sp.id is null or sp.attendance_status = 'checked_out' then 'not_checked_in'
        when sp.attendance_status not in ('waiting', 'staged') then 'not_waiting'
        when exists (
          select 1 from public.match_players mp
          where mp.player_id = sel.pid
            and mp.result is null
            and (p_match_id is null or mp.match_id <> p_match_id)
        ) then 'on_another_lineup'
        else null
      end
    from unnest(p_player_ids) as sel(pid)
    left join public.players p on p.id = sel.pid
    left join public.session_players sp
      on sp.session_id = p_session_id and sp.player_id = sel.pid
    where p.id is null
      or p.club_id <> p_club_id
      or sp.id is null
      or sp.attendance_status not in ('waiting', 'staged')
      or exists (
        select 1 from public.match_players mp
        where mp.player_id = sel.pid
          and mp.result is null
          and (p_match_id is null or mp.match_id <> p_match_id)
      )
  loop
    raise exception '%', case v_reason
      when 'not_checked_in' then v_name || ' is not checked in for this session'
      when 'not_on_roster' then v_name || ' is not on this club roster'
      when 'not_waiting' then v_name || ' is not waiting to play'
      else v_name || ' is already in another lineup'
    end
      using errcode = '22023';
  end loop;
end;
$$;

-- A lineup may only move on once it holds exactly the right number of
-- distinct players: two for singles, four for doubles.
create or replace function private.assert_lineup_ready(
  p_session_id uuid,
  p_match_id uuid,
  p_format public.session_format
)
returns void
language plpgsql
set search_path = public, private, pg_temp
as $$
declare
  v_expected integer := private.expected_lineup_size(p_format);
  v_count integer;
  v_distinct integer;
begin
  select count(*), count(distinct player_id)
    into v_count, v_distinct
  from public.match_players
  where match_id = p_match_id;

  if v_count <> v_expected or v_distinct <> v_expected then
    raise exception
      'A % lineup needs exactly % unique players before it can move on (this one has %)',
      case when p_format = 'singles' then 'singles' else 'doubles' end,
      v_expected,
      v_count
      using errcode = '22023';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Automatic promotion
-- ---------------------------------------------------------------------------

-- Promote the oldest complete Preparation lineup, but only if nothing is
-- already Up Next.
--
-- Callers hold the session row lock, which is what makes the check and the
-- write a single atomic step against every other transition. The unique index
-- matches_one_up_next_per_session is the second line of defence for the case
-- where a future caller forgets the lock.
--
-- Incomplete lineups are skipped rather than promoted: the organizer is
-- halfway through an edit, and putting a lineup with three of four players in
-- front of everybody would be worse than waiting.
create or replace function private.promote_oldest_preparation(p_session_id uuid)
returns uuid
language plpgsql
set search_path = public, private, pg_temp
as $$
declare
  v_expected integer;
  v_match_id uuid;
begin
  if exists (
    select 1 from public.matches
    where session_id = p_session_id and status = 'up_next'
  ) then
    return null;
  end if;

  select private.expected_lineup_size(s.format) into v_expected
  from public.sessions s where s.id = p_session_id;

  select m.id into v_match_id
  from public.matches m
  where m.session_id = p_session_id
    and m.status = 'preparing'
    and (
      select count(*) from public.match_players mp where mp.match_id = m.id
    ) = v_expected
  order by m.staged_at asc, m.match_number asc
  limit 1
  for update;

  if v_match_id is null then
    return null;
  end if;

  update public.matches set status = 'up_next' where id = v_match_id;

  perform private.log_queue_event(
    p_session_id, null, null, 'lineup_promoted', null, null,
    jsonb_build_object('match_id', v_match_id, 'from', 'preparing', 'to', 'up_next')
  );

  return v_match_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- RPC: create a Preparation lineup
-- ---------------------------------------------------------------------------

create or replace function public.create_preparation_lineup(
  p_session_id uuid,
  p_player_ids uuid[],
  p_team_numbers smallint[],
  p_slot_numbers smallint[] default null,
  p_explanation text default null,
  p_matching_mode public.matching_mode default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_session public.sessions%rowtype;
  v_match_id uuid;
  v_match_number integer;
  v_expected integer;
  v_mode public.matching_mode;
  v_inserted integer;
  v_promoted uuid;
begin
  select * into v_session
  from public.sessions where id = p_session_id for update;

  if v_session.id is null then
    raise exception 'Session not found' using errcode = 'P0002';
  end if;

  if not private.is_club_admin(v_session.club_id) then
    raise exception 'Only club organizers can create lineups' using errcode = '42501';
  end if;

  if v_session.status <> 'active' then
    raise exception 'The session is not live' using errcode = '22023';
  end if;

  v_expected := private.expected_lineup_size(v_session.format);

  if cardinality(p_player_ids) is distinct from v_expected
     or cardinality(p_team_numbers) is distinct from v_expected then
    raise exception 'A % lineup needs exactly % players',
      case when v_session.format = 'singles' then 'singles' else 'doubles' end,
      v_expected
      using errcode = '22023';
  end if;

  if cardinality(array(select distinct unnest(p_player_ids))) <> v_expected then
    raise exception 'The same player cannot be selected twice' using errcode = '22023';
  end if;

  if exists (
    select 1 from unnest(p_team_numbers) as t(team)
    where t.team is null or t.team not in (1, 2)
  ) then
    raise exception 'Each player must be on team 1 or team 2' using errcode = '22023';
  end if;

  -- Team balance is checked before the insert, not after. Slots run 1-2, so an
  -- uneven split would otherwise fail as a slot_number constraint violation --
  -- technically correct, but it tells the organizer nothing about what to fix.
  if exists (
    select 1 from unnest(p_team_numbers) as t(team)
    group by t.team
    having count(*) <> (case when v_session.format = 'singles' then 1 else 2 end)
  ) then
    raise exception 'Each team needs the same number of players'
      using errcode = '22023';
  end if;

  perform private.assert_lineup_players_selectable(
    v_session.id, v_session.club_id, null, p_player_ids
  );

  select coalesce(max(match_number), 0) + 1 into v_match_number
  from public.matches where session_id = p_session_id;

  v_mode := coalesce(p_matching_mode, v_session.matching_mode);

  -- The lineup is created in Preparation, never Up Next and never on a court.
  -- Promotion is a separate, separately locked step below, so the row the
  -- organizer sees first is always the one the matchmaker produced.
  insert into public.matches (
    session_id, court_id, match_number, status, target_score, win_by,
    matching_mode, explanation, staged_at, created_by
  )
  values (
    p_session_id, null, v_match_number, 'preparing',
    v_session.target_score, v_session.win_by, v_mode, p_explanation, now(), auth.uid()
  )
  returning id into v_match_id;

  insert into public.match_players (
    match_id, player_id, session_id, team_number, slot_number,
    skill_snapshot, origin_queue_position
  )
  select
    v_match_id,
    sel.pid,
    p_session_id,
    sel.team,
    coalesce(sel.slot, row_number() over (
      partition by sel.team order by sel.ord
    )::smallint),
    p.skill_level,
    sp.queue_position
  from unnest(p_player_ids, p_team_numbers, p_slot_numbers)
    with ordinality as sel(pid, team, slot, ord)
  join public.players p
    on p.id = sel.pid and p.club_id = v_session.club_id
  join public.session_players sp
    on sp.session_id = p_session_id and sp.player_id = sel.pid;

  get diagnostics v_inserted = row_count;

  if v_inserted <> v_expected then
    raise exception 'One or more selected players are not on this club roster'
      using errcode = '22023';
  end if;

  -- Players leave the waiting queue and hold their slot in this lineup. The
  -- timestamps that record when they arrived are left untouched, which is what
  -- lets a removal put them back where they were.
  update public.session_players
  set attendance_status = 'staged',
      queue_position = null
  where session_id = p_session_id
    and player_id = any(p_player_ids);

  -- Everybody still waiting has now been passed over once.
  update public.session_players
  set times_skipped = times_skipped + 1
  where session_id = p_session_id
    and attendance_status = 'waiting'
    and not (player_id = any(p_player_ids));

  perform private.log_queue_event(
    p_session_id, null, null, 'lineup_created', null, 'staged',
    jsonb_build_object(
      'match_id', v_match_id, 'match_number', v_match_number, 'stage', 'preparing'
    )
  );

  -- Requirement: when nothing is Up Next, the oldest Preparation lineup takes
  -- that slot. Doing it here, inside the same transaction and under the same
  -- lock as the insert, means there is no window where the board shows two
  -- Preparation lineups and no Up Next.
  v_promoted := private.promote_oldest_preparation(p_session_id);

  return jsonb_build_object(
    'match_id', v_match_id,
    'match_number', v_match_number,
    'status', case when v_promoted = v_match_id then 'up_next' else 'preparing' end,
    'promoted_match_id', v_promoted
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- RPC: promote a Preparation lineup to Up Next
-- ---------------------------------------------------------------------------

create or replace function public.promote_preparation_match(p_match_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_session public.sessions%rowtype;
  v_match public.matches%rowtype;
begin
  select session_id into v_session.id
  from public.matches where id = p_match_id;

  if v_session.id is null then
    raise exception 'Match not found' using errcode = 'P0002';
  end if;

  select * into v_session from public.sessions where id = v_session.id for update;
  select * into v_match from public.matches where id = p_match_id for update;

  if not private.is_club_admin(v_session.club_id) then
    raise exception 'Only club organizers can move lineups' using errcode = '42501';
  end if;

  if v_match.status = 'up_next' then
    return jsonb_build_object('match_id', p_match_id, 'status', 'up_next');
  end if;

  if v_match.status <> 'preparing' then
    raise exception 'Only a lineup in Preparation can be moved to Up Next'
      using errcode = '22023';
  end if;

  if exists (
    select 1 from public.matches
    where session_id = v_match.session_id and status = 'up_next'
  ) then
    raise exception 'Another lineup is already Up Next' using errcode = '22023';
  end if;

  -- Revalidate here rather than trusting what the organizer screen showed.
  -- The lineup may have been sitting in Preparation for a while, and a player
  -- can have been checked out from the attendance panel in the meantime.
  perform private.assert_lineup_ready(
    v_match.session_id, p_match_id, v_session.format
  );
  perform private.assert_lineup_players_selectable(
    v_match.session_id, v_session.club_id, p_match_id,
    array(select player_id from public.match_players where match_id = p_match_id)
  );

  update public.matches set status = 'up_next' where id = p_match_id;

  perform private.log_queue_event(
    v_match.session_id, null, null, 'lineup_promoted', null, null,
    jsonb_build_object('match_id', p_match_id, 'from', 'preparing', 'to', 'up_next')
  );

  return jsonb_build_object('match_id', p_match_id, 'status', 'up_next');
end;
$$;

-- ---------------------------------------------------------------------------
-- start_match must refuse a lineup that is short of players.
--
-- Lineup editing is legal right up to the moment a game begins, which means the
-- organizer can leave a doubles lineup on three players and then press Start.
-- 0009 allowed that, because before this migration every staged lineup had been
-- built by stage_match, which always wrote four. The only way to reach a staged
-- short lineup now is update_lineup_players, so the guard belongs here.
--
-- Additive: a complete lineup starts exactly as it did.
-- ---------------------------------------------------------------------------

create or replace function public.start_match(p_match_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_match public.matches%rowtype;
  v_session public.sessions%rowtype;
begin
  select session_id into v_session.id
  from public.matches where id = p_match_id;

  if v_session.id is null then
    raise exception 'Match not found' using errcode = 'P0002';
  end if;

  select * into v_session
  from public.sessions where id = v_session.id for update;
  select * into v_match
  from public.matches where id = p_match_id for update;

  if not private.is_club_admin(v_session.club_id) then
    raise exception 'Only club organizers can start matches' using errcode = '42501';
  end if;

  if v_match.status = 'playing' then
    return jsonb_build_object('match_id', p_match_id, 'status', 'playing');
  end if;

  if v_match.status <> 'staged' then
    raise exception 'Only a staged match can be started' using errcode = '22023';
  end if;

  perform private.assert_lineup_ready(
    v_match.session_id, p_match_id, v_session.format
  );

  -- coalesce, not now(): a start must never move a clock that is already
  -- running. The status guard above already prevents a second start, but
  -- keeping the guarantee in the write means relaxing that guard later cannot
  -- silently reset every game time.
  update public.matches
  set status = 'playing',
      started_at = coalesce(started_at, now())
  where id = p_match_id;

  update public.session_players
  set attendance_status = 'playing', last_played_at = now()
  where session_id = v_match.session_id
    and player_id in (
      select player_id from public.match_players where match_id = p_match_id
    );

  if v_match.court_id is not null then
    update public.courts set status = 'playing' where id = v_match.court_id;
  end if;

  perform private.log_queue_event(
    v_match.session_id, null, null, 'match_started', 'staged', 'playing',
    jsonb_build_object('match_id', p_match_id)
  );

  return jsonb_build_object('match_id', p_match_id, 'status', 'playing');
end;
$$;

-- ---------------------------------------------------------------------------
-- RPC: send an Up Next lineup back to Preparation
-- ---------------------------------------------------------------------------

create or replace function public.demote_up_next_match(p_match_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_session public.sessions%rowtype;
  v_match public.matches%rowtype;
begin
  select session_id into v_session.id
  from public.matches where id = p_match_id;

  if v_session.id is null then
    raise exception 'Match not found' using errcode = 'P0002';
  end if;

  select * into v_session from public.sessions where id = v_session.id for update;
  select * into v_match from public.matches where id = p_match_id for update;

  if not private.is_club_admin(v_session.club_id) then
    raise exception 'Only club organizers can move lineups' using errcode = '42501';
  end if;

  if v_match.status <> 'up_next' then
    raise exception 'Only the Up Next lineup can be sent back to Preparation'
      using errcode = '22023';
  end if;

  update public.matches set status = 'preparing' where id = p_match_id;

  perform private.log_queue_event(
    v_match.session_id, null, null, 'lineup_demoted', null, null,
    jsonb_build_object('match_id', p_match_id, 'from', 'up_next', 'to', 'preparing')
  );

  -- Deliberately no automatic promotion here. Sending a lineup back is the
  -- organizer saying "this one is not right yet", and immediately promoting
  -- some other lineup would leave the demoted one unable to come back up
  -- without first clearing Up Next again. Preparation waits until the lineup is
  -- fixed and promoted, or until a court frees up.
  return jsonb_build_object('match_id', p_match_id, 'status', 'preparing');
end;
$$;

-- ---------------------------------------------------------------------------
-- RPC: assign a lineup to an available court
-- ---------------------------------------------------------------------------

create or replace function public.assign_lineup_to_court(
  p_match_id uuid,
  p_court_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_session public.sessions%rowtype;
  v_match public.matches%rowtype;
  v_court public.courts%rowtype;
  v_promoted uuid;
begin
  select session_id into v_session.id
  from public.matches where id = p_match_id;

  if v_session.id is null then
    raise exception 'Match not found' using errcode = 'P0002';
  end if;

  select * into v_session from public.sessions where id = v_session.id for update;
  select * into v_match from public.matches where id = p_match_id for update;
  select * into v_court from public.courts where id = p_court_id for update;

  if not private.is_club_admin(v_session.club_id) then
    raise exception 'Only club organizers can assign a court' using errcode = '42501';
  end if;

  if v_court.id is null or v_court.session_id <> v_match.session_id then
    raise exception 'Court not found in this session' using errcode = '22023';
  end if;

  if v_match.status not in ('preparing', 'up_next') then
    raise exception 'Only a lineup waiting for a court can be assigned to one'
      using errcode = '22023';
  end if;

  if v_court.status <> 'available' then
    raise exception 'Court % is not available', v_court.court_number
      using errcode = '22023';
  end if;

  if exists (
    select 1 from public.matches
    where court_id = p_court_id
      and id <> p_match_id
      and status in ('preparing', 'up_next', 'staged', 'playing')
  ) then
    raise exception 'Court % already has a lineup on it', v_court.court_number
      using errcode = '22023';
  end if;

  perform private.assert_lineup_ready(
    v_match.session_id, p_match_id, v_session.format
  );
  perform private.assert_lineup_players_selectable(
    v_match.session_id, v_session.club_id, p_match_id,
    array(select player_id from public.match_players where match_id = p_match_id)
  );

  update public.matches
  set court_id = p_court_id,
      status = 'staged'
  where id = p_match_id;

  update public.courts set status = 'staged' where id = p_court_id;

  perform private.log_queue_event(
    v_match.session_id, null, null, 'lineup_assigned', 'staged', 'staged',
    jsonb_build_object(
      'match_id', p_match_id,
      'court_id', p_court_id,
      'court_number', v_court.court_number,
      'from', v_match.status,
      'to', 'staged'
    )
  );

  -- The court is taken, so the pipeline advances: whatever has been waiting in
  -- Preparation longest becomes the new Up Next.
  v_promoted := private.promote_oldest_preparation(v_match.session_id);

  return jsonb_build_object(
    'match_id', p_match_id,
    'status', 'staged',
    'court_id', p_court_id,
    'court_number', v_court.court_number,
    'promoted_match_id', v_promoted
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- RPC: edit the players on a lineup
-- ---------------------------------------------------------------------------

-- Works on a lineup in Preparation, Up Next, or staged on a court. Never on a
-- playing, completed, or cancelled match: changing who is on a match that has
-- already been played would rewrite recorded results and the leaderboard they
-- feed, so those states are rejected rather than quietly accepted.
create or replace function public.update_lineup_players(
  p_match_id uuid,
  p_player_ids uuid[],
  p_team_numbers smallint[],
  p_slot_numbers smallint[]
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_session public.sessions%rowtype;
  v_match public.matches%rowtype;
  v_dropped uuid[];
  v_dropped_origins integer[];
  v_incoming_ids uuid[];
  v_incoming_origins integer[];
  v_added uuid[];
  v_size integer;
  v_index integer;
  v_sp public.session_players%rowtype;
  v_position integer;
begin
  select session_id into v_session.id
  from public.matches where id = p_match_id;

  if v_session.id is null then
    raise exception 'Match not found' using errcode = 'P0002';
  end if;

  select * into v_session from public.sessions where id = v_session.id for update;
  select * into v_match from public.matches where id = p_match_id for update;

  if not private.is_club_admin(v_session.club_id) then
    raise exception 'Only club organizers can edit lineups' using errcode = '42501';
  end if;

  if v_match.status not in ('preparing', 'up_next', 'staged') then
    raise exception
      'Players can only be changed before a game starts. This lineup is %', v_match.status
      using errcode = '22023';
  end if;

  v_size := cardinality(p_player_ids);

  if cardinality(p_team_numbers) is distinct from v_size
     or cardinality(p_slot_numbers) is distinct from v_size then
    raise exception 'Each player needs a team and a slot' using errcode = '22023';
  end if;

  if v_size > 0 and cardinality(array(select distinct unnest(p_player_ids))) <> v_size then
    raise exception 'The same player cannot be selected twice' using errcode = '22023';
  end if;

  if exists (
    select 1 from unnest(p_team_numbers) as t(team)
    where t.team is null or t.team not in (1, 2)
  ) or exists (
    select 1 from unnest(p_slot_numbers) as s(slot)
    where s.slot is null or s.slot not in (1, 2)
  ) then
    raise exception 'Each player needs a team of 1 or 2 and a slot of 1 or 2'
      using errcode = '22023';
  end if;

  -- Slots must be unique within a team, or two players would share a slot and
  -- every list keyed by slot would duplicate keys again.
  if v_size > 0 and exists (
    select 1
    from unnest(p_team_numbers, p_slot_numbers) as sel(team, slot)
    group by sel.team, sel.slot
    having count(*) > 1
  ) then
    raise exception 'Two players cannot share the same team and slot' using errcode = '22023';
  end if;

  perform private.assert_lineup_players_selectable(
    v_match.session_id, v_session.club_id, p_match_id, p_player_ids
  );

  -- Snapshot before anything is written.
  --
  -- Whoever is being dropped goes back to the queue on the slot they held.
  -- Incoming players keep the slot they already had on this lineup, and a
  -- newcomer keeps the queue position they are giving up right now. Both have
  -- to be read before the rows are deleted and before the queue is cleared,
  -- which is the ordering that makes a later removal fair.
  select
    coalesce(
      array_agg(mp.player_id order by mp.team_number, mp.slot_number),
      '{}'::uuid[]
    ),
    coalesce(
      array_agg(mp.origin_queue_position order by mp.team_number, mp.slot_number),
      '{}'::integer[]
    )
    into v_dropped, v_dropped_origins
  from public.match_players mp
  where mp.match_id = p_match_id
    and not (mp.player_id = any(coalesce(p_player_ids, '{}'::uuid[])));

  select
    coalesce(array_agg(src.player_id order by src.player_id), '{}'::uuid[]),
    coalesce(array_agg(src.origin_queue_position order by src.player_id), '{}'::integer[]),
    coalesce(array_agg(src.player_id order by src.player_id)
      filter (where src.was_on_lineup is false), '{}'::uuid[])
    into v_incoming_ids, v_incoming_origins, v_added
  from (
    select
      sel.pid as player_id,
      coalesce(mp.origin_queue_position, sp.queue_position) as origin_queue_position,
      (mp.id is not null) as was_on_lineup
    from unnest(coalesce(p_player_ids, '{}'::uuid[])) as sel(pid)
    join public.session_players sp
      on sp.session_id = v_match.session_id and sp.player_id = sel.pid
    left join public.match_players mp
      on mp.match_id = p_match_id and mp.player_id = sel.pid
  ) src;

  -- Incoming players leave the waiting queue and hold their slot in the lineup.
  update public.session_players
  set attendance_status = 'staged',
      queue_position = null
  where session_id = v_match.session_id
    and player_id = any(coalesce(p_player_ids, '{}'::uuid[]));

  -- Delete then insert rather than update in place. A partner swap moves two
  -- players into each other's slot, and a row-at-a-time update would collide
  -- with the unique (match_id, team_number, slot_number) constraint halfway
  -- through the swap.
  delete from public.match_players where match_id = p_match_id;

  if v_size > 0 then
    insert into public.match_players (
      match_id, player_id, session_id, team_number, slot_number,
      skill_snapshot, origin_queue_position
    )
    select
      p_match_id,
      sel.pid,
      v_match.session_id,
      sel.team,
      sel.slot,
      p.skill_level,
      saved.queue_slot
    from unnest(p_player_ids, p_team_numbers, p_slot_numbers)
      with ordinality as sel(pid, team, slot, ord)
    join public.players p
      on p.id = sel.pid and p.club_id = v_session.club_id
    join (
      select * from unnest(v_incoming_ids, v_incoming_origins) as t(player_id, queue_slot)
    ) saved on saved.player_id = sel.pid;
  end if;

  -- Dropped players are returned after the insert, so reclaiming a slot cannot
  -- hand it to somebody who is still on this lineup.
  v_index := 1;
  while v_index <= coalesce(array_length(v_dropped, 1), 0) loop
    select * into v_sp
    from public.session_players
    where session_id = v_match.session_id
      and player_id = v_dropped[v_index]
    for update;

    if v_sp.id is not null
       and not (v_sp.attendance_status = 'waiting' and v_sp.queue_position is not null)
    then
      v_position := private.reclaim_queue_slot(
        v_match.session_id, v_dropped_origins[v_index]
      );

      update public.session_players
      set attendance_status = 'waiting',
          queue_position = v_position
      where id = v_sp.id;

      perform private.log_queue_event(
        v_match.session_id, v_sp.id, v_sp.player_id,
        'lineup_player_removed', v_sp.attendance_status, 'waiting',
        jsonb_build_object(
          'match_id', p_match_id,
          'queue_position', v_position,
          -- Proof the wait survived the round trip: this is the timestamp the
          -- player went to the back of the queue.
          'last_enqueued_at', v_sp.last_enqueued_at
        )
      );
    end if;

    v_index := v_index + 1;
  end loop;

  perform private.log_queue_event(
    v_match.session_id, null, null, 'lineup_edited', null, null,
    jsonb_build_object(
      'match_id', p_match_id,
      'removed', to_jsonb(v_dropped),
      'added', to_jsonb(v_added)
    )
  );

  return jsonb_build_object(
    'match_id', p_match_id,
    'player_ids', to_jsonb(coalesce(p_player_ids, '{}'::uuid[])),
    'removed', to_jsonb(v_dropped),
    'added', to_jsonb(v_added)
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- RPC: cancel a lineup and return its players to the queue
-- ---------------------------------------------------------------------------

create or replace function public.cancel_lineup(
  p_match_id uuid,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_session public.sessions%rowtype;
  v_match public.matches%rowtype;
  v_promoted uuid;
begin
  select session_id into v_session.id
  from public.matches where id = p_match_id;

  if v_session.id is null then
    raise exception 'Match not found' using errcode = 'P0002';
  end if;

  select * into v_session from public.sessions where id = v_session.id for update;
  select * into v_match from public.matches where id = p_match_id for update;

  if not private.is_club_admin(v_session.club_id) then
    raise exception 'Only club organizers can cancel lineups' using errcode = '42501';
  end if;

  if v_match.status in ('completed', 'cancelled') then
    raise exception 'That lineup is already finished' using errcode = '22023';
  end if;

  perform private.release_lineup_players(
    v_match.session_id, p_match_id, 'lineup_cancelled',
    jsonb_build_object('match_id', p_match_id, 'reason', p_reason)
  );

  -- result = 'cancelled' releases the player from
  -- match_players_one_unresolved_per_player, which is what lets them be picked
  -- again. The rows stay as the record of who was pulled out of the lineup.
  update public.match_players
  set result = 'cancelled'
  where match_id = p_match_id and result is null;

  update public.matches
  set status = 'cancelled',
      completed_at = null
  where id = p_match_id;

  if v_match.court_id is not null then
    update public.courts set status = 'available' where id = v_match.court_id;
  end if;

  perform private.log_queue_event(
    v_match.session_id, null, null, 'lineup_cancelled', null, null,
    jsonb_build_object('match_id', p_match_id, 'reason', p_reason)
  );

  -- Cancelling the Up Next lineup leaves a hole in the pipeline, so the next
  -- one steps up rather than the board sitting empty.
  v_promoted := private.promote_oldest_preparation(v_match.session_id);

  return jsonb_build_object(
    'match_id', p_match_id,
    'status', 'cancelled',
    'promoted_match_id', v_promoted
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- A lineup waiting for a court blocks its own court reassignment, but a match
-- that has been sent back to Preparation must also free the court it once held
-- if the organizer edited it into a queueable state. Handled in
-- update_lineup_players? No: that would silently move players off a court the
-- organizer put them on. Left explicit on purpose.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- end_session has to know about the two new stages, otherwise a session can be
-- ended while a Preparation lineup is still holding players in "Getting ready".
-- Additive only: no existing behaviour changes.
-- ---------------------------------------------------------------------------

create or replace function public.end_session(
  p_session_id uuid,
  p_force boolean default false
)
returns void
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_session public.sessions%rowtype;
  v_open integer;
begin
  select * into v_session
  from public.sessions where id = p_session_id for update;
  if v_session.id is null then
    raise exception 'Session not found' using errcode = 'P0002';
  end if;

  if not private.is_club_admin(v_session.club_id) then
    raise exception 'Only club organizers can end a session' using errcode = '42501';
  end if;

  if v_session.status = 'completed' then return; end if;

  select count(*) into v_open from public.matches
  where session_id = p_session_id
    and status in ('preparing', 'up_next', 'staged', 'playing');

  if v_open > 0 and not p_force then
    raise exception
      '% lineup(s) are still open. Finish or cancel them first, or end anyway.',
      v_open using errcode = '22023';
  end if;

  if v_open > 0 then
    perform private.release_lineup_players(
      p_session_id, open_lineups.id, 'session_ended',
      jsonb_build_object('match_id', open_lineups.id, 'reason', 'session ended')
    )
    from (
      select id
      from public.matches
      where session_id = p_session_id
        and status in ('preparing', 'up_next', 'staged', 'playing')
    ) open_lineups;

    update public.matches set status = 'cancelled', updated_at = now()
    where session_id = p_session_id
      and status in ('preparing', 'up_next', 'staged', 'playing');

    update public.match_players set result = 'cancelled'
    where session_id = p_session_id and result is null;

    update public.courts set status = 'available'
    where session_id = p_session_id and status in ('staged', 'playing');
  end if;

  update public.sessions
  set status = 'completed',
      ended_at = now(),
      results_published = case
        when player_live_enabled or is_public then true
        else results_published
      end
  where id = p_session_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Public board: the two queue stages have no court, so public_match_lineups
-- (which joins through courts) cannot carry them. They arrive through the
-- token-scoped RPC instead, keyed by match_number rather than a uuid, so the
-- anonymous payload still exposes no row ids for a lineup.
-- ---------------------------------------------------------------------------

create or replace function public.get_player_live_board(p_public_token uuid)
returns jsonb
language sql
stable
security definer
set search_path = public, private, pg_temp
as $$
  with selected as (
    select s.*, c.name as club_name, c.slug as club_slug,
      c.location as club_location, c.logo_url as club_logo_url
    from public.sessions s
    join public.clubs c on c.id = s.club_id
    where s.public_live_token = p_public_token
      and (
        s.status = 'draft'
        or (s.player_live_enabled and s.status = 'active')
        or (
          s.player_live_enabled
          and s.status = 'completed'
          and s.results_published
        )
      )
    limit 1
  ), duration_stats as (
    select
      round(avg(extract(epoch from (m.completed_at - m.started_at))) / 60.0)::integer
        as avg_match_minutes,
      count(*)::integer as completed_match_count
    from public.matches m
    join selected s on s.id = m.session_id
    where m.status = 'completed'
      and m.started_at is not null
      and m.completed_at is not null
      and m.completed_at >= m.started_at
  ), queued as (
    -- Preparation and Up Next lineups. One entry per match, carrying its whole
    -- roster, so the public board can render a complete card from a single row
    -- without a second query.
    select
      coalesce(jsonb_agg(lineup order by lineup ->> 'prepared_at') filter (where lineup ->> 'stage' = 'up_next'), '[]'::jsonb) as up_next,
      coalesce(jsonb_agg(lineup order by lineup ->> 'prepared_at') filter (where lineup ->> 'stage' = 'preparing'), '[]'::jsonb) as preparation
    from (
      select jsonb_build_object(
        'match_id', m.id,
        'match_number', m.match_number,
        'display_name', coalesce(nullif(btrim(m.display_name), ''), 'Match ' || m.match_number),
        'matching_mode', m.matching_mode,
        'stage', m.status,
        'prepared_at', m.staged_at,
        'players', (
          select coalesce(jsonb_agg(jsonb_build_object(
            'team_number', mp.team_number,
            'slot_number', mp.slot_number,
            'display_name', p.display_name,
            'skill_level', p.skill_level,
            'lineup_id', mp.id
          ) order by mp.team_number, mp.slot_number), '[]'::jsonb)
          from public.match_players mp
          join public.players p on p.id = mp.player_id
          where mp.match_id = m.id
        )
      ) as lineup
      from public.matches m
      join selected s on s.id = m.session_id
      where m.status in ('preparing', 'up_next')
    ) rows
  )
  select jsonb_build_object(
    'session', jsonb_build_object(
      'id', s.id,
      'club_id', s.club_id,
      'name', s.name,
      'status', s.status,
      'format', s.format,
      'matching_mode', s.matching_mode,
      'target_score', s.target_score,
      'win_by', s.win_by,
      'court_count', s.court_count,
      'started_at', s.started_at,
      'ended_at', s.ended_at,
      'results_published', s.results_published,
      'club_slug', s.club_slug,
      'club_name', s.club_name,
      'club_location', s.club_location,
      'club_logo_url', s.club_logo_url,
      'avg_match_minutes', ds.avg_match_minutes,
      'completed_match_count', ds.completed_match_count,
      'player_live_enabled', s.player_live_enabled
    ),
    'courts', coalesce((
      select jsonb_agg(jsonb_build_object(
        'session_id', s.id,
        'club_id', s.club_id,
        'court_number', c.court_number,
        'court_name', c.name,
        'court_status', c.status,
        'ladder_position', c.ladder_position,
        'match_status', m.status,
        'match_number', m.match_number,
        'display_name', m.display_name,
        'winning_team', m.winning_team,
        'target_score', m.target_score,
        'match_started_at', m.started_at,
        'match_completed_at', m.completed_at,
        'team1_score', m.team1_score,
        'team2_score', m.team2_score
      ) order by c.ladder_position, c.court_number)
      from public.courts c
      left join lateral (
        select mx.* from public.matches mx
        where mx.court_id = c.id and mx.status in ('staged', 'playing')
        order by mx.match_number desc limit 1
      ) m on true
      where c.session_id = s.id
    ), '[]'::jsonb),
    'lineups', coalesce((
      select jsonb_agg(jsonb_build_object(
        'session_id', s.id,
        'court_number', c.court_number,
        'team_number', mp.team_number,
        'slot_number', mp.slot_number,
        'display_name', p.display_name,
        'result', mp.result,
        'points_for', mp.points_for,
        'points_against', mp.points_against,
        'lineup_id', mp.id
      ) order by c.court_number, mp.team_number, mp.slot_number)
      from public.matches m
      join public.courts c on c.id = m.court_id
      join public.match_players mp on mp.match_id = m.id
      join public.players p on p.id = mp.player_id
      where m.session_id = s.id and m.status in ('staged', 'playing')
    ), '[]'::jsonb),
    'up_next', q.up_next,
    'preparation', q.preparation,
    'presence', coalesce((
      select jsonb_agg(jsonb_build_object(
        'session_id', s.id,
        'display_name', p.display_name,
        'skill_level', p.skill_level,
        'attendance_status', sp.attendance_status,
        'queue_position', sp.queue_position,
        'games_played', sp.games_played,
        'checked_in_at', sp.checked_in_at,
        'last_enqueued_at', sp.last_enqueued_at,
        'presence_id', sp.id
      ) order by sp.queue_position nulls last, p.display_name)
      from public.session_players sp
      join public.players p on p.id = sp.player_id
      where sp.session_id = s.id and p.is_active
    ), '[]'::jsonb),
    'standings', coalesce((
      select jsonb_agg(jsonb_build_object(
        'session_id', s.id,
        'club_id', s.club_id,
        'player_id', sp.id,
        'display_name', p.display_name,
        'skill_level', p.skill_level,
        'games_played', coalesce(t.games_played, 0),
        'wins', coalesce(t.wins, 0),
        'losses', coalesce(t.losses, 0),
        'points_for', coalesce(t.points_for, 0),
        'points_against', coalesce(t.points_against, 0),
        'first_game_at', t.first_game_at,
        'last_game_at', t.last_game_at
      ) order by coalesce(t.wins, 0) desc,
                 coalesce(t.points_for, 0) desc,
                 p.display_name)
      from public.session_players sp
      join public.players p on p.id = sp.player_id
      left join private.session_match_totals t
        on t.session_id = sp.session_id and t.player_id = sp.player_id
      where sp.session_id = s.id and p.is_active
    ), '[]'::jsonb)
  )
  from selected s
  cross join duration_stats ds
  cross join queued q;
$$;

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------

-- Every function created after migration 0001's blanket
-- `revoke all on all functions in schema public` gets Postgres's default
-- EXECUTE grant to PUBLIC, which includes anon. Each new RPC is therefore
-- revoked by name before the single authenticated grant below. Without this a
-- spectator could promote and cancel lineups from the browser: the functions
-- are SECURITY DEFINER, so the role check inside them would run as the definer
-- rather than as the caller.
revoke all on function
  public.create_preparation_lineup(uuid, uuid[], smallint[], smallint[], text, public.matching_mode),
  public.promote_preparation_match(uuid),
  public.demote_up_next_match(uuid),
  public.assign_lineup_to_court(uuid, uuid),
  public.update_lineup_players(uuid, uuid[], smallint[], smallint[]),
  public.cancel_lineup(uuid, text)
from public;

grant execute on function
  public.create_preparation_lineup(uuid, uuid[], smallint[], smallint[], text, public.matching_mode),
  public.promote_preparation_match(uuid),
  public.demote_up_next_match(uuid),
  public.assign_lineup_to_court(uuid, uuid),
  public.update_lineup_players(uuid, uuid[], smallint[], smallint[]),
  public.cancel_lineup(uuid, text)
to authenticated;

revoke all on function public.get_player_live_board(uuid) from public;
grant execute on function public.get_player_live_board(uuid) to anon, authenticated;

-- The internal helpers are not callable from the Data API. The private schema
-- is not exposed, but revoking makes that explicit rather than incidental.
revoke all on function
  private.expected_lineup_size(public.session_format),
  private.reclaim_queue_slot(uuid, integer),
  private.release_lineup_players(uuid, uuid, text, jsonb),
  private.assert_lineup_players_selectable(uuid, uuid, uuid, uuid[]),
  private.assert_lineup_ready(uuid, uuid, public.session_format),
  private.promote_oldest_preparation(uuid)
from public, anon, authenticated;

commit;