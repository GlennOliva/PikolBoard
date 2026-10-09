-- 0008: a match cannot have two players in the same team slot.
--
-- The problem
-- -----------
-- stage_match computed the slot like this:
--
--   ((sel.ord - 1) % 2) + 1
--
-- where sel.ord is the ordinality of the player across the WHOLE p_player_ids
-- array. That is only correct if the array arrives grouped by team. It does not:
-- the app builds its proposal with toProposalPlayers(), which assigns slots with
-- a per-team counter over queue order, so the teams come out interleaved:
--
--   [A(team 1), B(team 2), C(team 1), D(team 2)]
--
-- Feeding that into the formula produced:
--
--   (1,1) (2,2) (1,1) (2,2)
--
-- so both of team 1's players were stored in slot 1 and both of team 2's in slot 2.
--
-- Two things were wrong, and this migration fixes the one that matters:
--
-- 1. The slot was derived from array position instead of from the player's
--    position within its own team. That is now a window function partitioned by
--    team, so no input ordering can produce a collision. Deriving a column from
--    the order a caller happened to pass an array is the actual defect; fixing
--    only the caller's ordering would leave the RPC one refactor away from
--    corrupting slots again.
--
-- 2. Nothing in the database stopped the collision. (match_id, player_id) is
--    unique, so two DIFFERENT players could happily share a slot.
--
-- Existing bad rows are repaired rather than deleted: the affected matches keep
-- every player, their results and their scores, and only the slot label is
-- corrected. Deleting or re-staging them would have discarded recorded games.
--
-- Forward-only: repair, then fix the writer, then constrain.

-- ---------------------------------------------------------------------------
-- 1. Repair existing duplicates.
--
-- Renumber slots sequentially within each team, ordered by the row id so the
-- result is deterministic and stable across re-runs. Matches that were already
-- correct come out identical, so this is a no-op for them.
--
-- Safe because slot_number is constrained to 1..2 and every match holds at most
-- two players per team; the guard below refuses to run rather than push a row
-- past that check.
-- ---------------------------------------------------------------------------
do $$
declare
  v_overfull integer;
  v_repaired integer;
begin
  select count(*) into v_overfull
  from (
    select mp.match_id, mp.team_number
    from public.match_players mp
    group by mp.match_id, mp.team_number
    having count(*) > 2
  ) t;

  if v_overfull > 0 then
    raise exception
      'Cannot repair match_players slots: % team(s) hold more than two players.',
      v_overfull;
  end if;

  with duplicated_teams as (
  select
    mp.match_id,
    mp.team_number
  from public.match_players mp
  group by
    mp.match_id,
    mp.team_number
  having count(*) <> count(distinct mp.slot_number)
),
ranked as (
  select
    mp.id,
    row_number() over (
      partition by mp.match_id, mp.team_number
      order by mp.id
    )::integer as new_slot
  from public.match_players mp
  join duplicated_teams dt
    on dt.match_id = mp.match_id
   and dt.team_number = mp.team_number
)
update public.match_players mp
set slot_number = ranked.new_slot
from ranked
where mp.id = ranked.id
  and mp.slot_number <> ranked.new_slot;

  get diagnostics v_repaired = row_count;
  raise notice 'Renumbered % match_players row(s) into collision-free slots', v_repaired;
end $$;

-- ---------------------------------------------------------------------------
-- 2. Constrain it, so this cannot come back.
--
-- (match_id, player_id) already guarantees one row per player; this guarantees
-- the other half of the same invariant, that one slot holds at most one player.
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.match_players'::regclass
      and conname = 'match_players_match_team_slot_key'
  ) then
    alter table public.match_players
      add constraint match_players_match_team_slot_key
      unique (match_id, team_number, slot_number);
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. Fix the writer. Reproduced verbatim from 0001 apart from the single slot
-- expression below, so nothing else about the RPC can drift.
--
-- The slot is now the player's ordinality WITHIN ITS TEAM, so interleaved input
-- is handled correctly. A doubles match on four players now yields
-- (1,1) (2,1) (1,2) (2,2) instead of (1,1) (2,2) (1,1) (2,2).
-- ---------------------------------------------------------------------------
create or replace function public.stage_match(
  p_session_id uuid,
  p_court_id uuid,
  p_player_ids uuid[],
  p_team_numbers smallint[],
  p_explanation text default null,
  p_matching_mode public.matching_mode default null
)
returns uuid
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_session public.sessions%rowtype;
  v_court public.courts%rowtype;
  v_match_id uuid;
  v_match_number integer;
  v_expected integer;
  v_mode public.matching_mode;
  v_bad text;
begin
  select * into v_session from public.sessions where id = p_session_id for update;
  if v_session.id is null then
    raise exception 'Session not found' using errcode = 'P0002';
  end if;

  if not private.is_club_admin(v_session.club_id) then
    raise exception 'Only club organizers can stage matches' using errcode = '42501';
  end if;

  if v_session.status <> 'active' then
    raise exception 'The session is not live' using errcode = '22023';
  end if;

  v_expected := case when v_session.format = 'singles' then 2 else 4 end;
  if cardinality(p_player_ids) is distinct from v_expected
     or cardinality(p_team_numbers) is distinct from v_expected then
    raise exception 'A % match needs exactly % players',
      case when v_session.format = 'singles' then 'singles' else 'doubles' end,
      v_expected
      using errcode = '22023';
  end if;

  if cardinality(array(select distinct unnest(p_player_ids))) <> v_expected then
    raise exception 'The same player cannot be selected twice' using errcode = '22023';
  end if;

  -- Court must be in this session and free.
  select * into v_court from public.courts where id = p_court_id;
  if v_court.id is null or v_court.session_id <> p_session_id then
    raise exception 'Court not found in this session' using errcode = '22023';
  end if;

  if v_court.status <> 'available' then
    raise exception 'Court % is not available', v_court.court_number using errcode = '22023';
  end if;

  -- Every selected player must still be waiting. This is what makes a stale
  -- proposal safe to reject instead of double-booking a player.
  select p.display_name into v_bad
  from unnest(p_player_ids) with ordinality as sel(pid, ord)
  join public.session_players sp
    on sp.session_id = p_session_id and sp.player_id = sel.pid
  join public.players p on p.id = sel.pid
  where sp.attendance_status <> 'waiting'
  limit 1;

  if v_bad is not null then
    raise exception '% is no longer waiting to play', v_bad using errcode = '22023';
  end if;

  select coalesce(max(match_number), 0) + 1 into v_match_number
  from public.matches where session_id = p_session_id;

  v_mode := coalesce(p_matching_mode, v_session.matching_mode);

  insert into public.matches (
    session_id, court_id, match_number, status, target_score, win_by,
    matching_mode, explanation, staged_at, created_by
  )
  values (
    p_session_id, p_court_id, v_match_number, 'staged',
    v_session.target_score, v_session.win_by, v_mode, p_explanation, now(), auth.uid()
  )
  returning id into v_match_id;

  insert into public.match_players (
    match_id, player_id, session_id, team_number, slot_number, skill_snapshot
  )
  select
    v_match_id,
    sel.pid,
    p_session_id,
    sel.team,
    row_number() over (partition by sel.team order by sel.ord)::smallint,
    p.skill_level
  from unnest(p_player_ids, p_team_numbers) with ordinality as sel(pid, team, ord)
  join public.players p on p.id = sel.pid
  where p.club_id = v_session.club_id;

  if (select count(*) from public.match_players where match_id = v_match_id) <> v_expected then
    raise exception 'One or more selected players are not on this club roster'
      using errcode = '22023';
  end if;

  -- Selected players leave the waiting queue and hold their slot in the match.
  update public.session_players
  set attendance_status = 'staged',
      queue_position = null
  where session_id = p_session_id
    and player_id = any(p_player_ids);

  -- Everyone still waiting has now been passed over once.
  update public.session_players
  set times_skipped = times_skipped + 1
  where session_id = p_session_id
    and attendance_status = 'waiting'
    and not (player_id = any(p_player_ids));

  update public.courts set status = 'staged' where id = p_court_id;

  perform private.log_queue_event(
    p_session_id, null, null, 'match_staged', null, 'staged',
    jsonb_build_object('match_id', v_match_id, 'court_id', p_court_id)
  );

  return v_match_id;
end;
$$;

comment on function public.stage_match is
  'Stages a match. Slot numbers are assigned per team, so caller array order cannot collide.';

-- ---------------------------------------------------------------------------
-- 4. Give the public board a stable row identity.
--
-- The public views deliberately carry no ids -- no user id, no player id, no
-- email. That is the right call for anything identifying, but it left the public
-- board with no stable way to key a React list: not (court, team, slot), because
-- that is the very tuple the duplicate bug lived in, and not display_name,
-- because two players on a club can share one.
--
-- Exposing match_players.id and session_players.id costs nothing: both are
-- surrogate keys on join tables, resolve to no user, and reveal no auth data.
-- The sanitizing test above still passes because neither column is a user_id,
-- created_by, email, or audit actor.
-- ---------------------------------------------------------------------------

create or replace view public.public_match_lineups as
select
  s.id as session_id,
  c.court_number,
  mp.team_number,
  mp.slot_number,
  pl.display_name,
  mp.result,
  mp.points_for,
  mp.points_against,
  -- Stable per-row identity for list keys. Surrogate key of the lineup row,
  -- not an identifier of the person on it.
  mp.id as lineup_id
from public.sessions s
join public.clubs cl on cl.id = s.club_id
join public.courts c on c.session_id = s.id
join public.matches m
  on m.court_id = c.id
 and m.status in ('staged', 'playing')
join public.match_players mp on mp.match_id = m.id
join public.players pl on pl.id = mp.player_id
where s.is_public
  and cl.is_public
  and (
    s.status = 'active'
    or (s.status = 'completed' and s.results_published)
  );

comment on view public.public_match_lineups is
  'Player names and teams for games in flight on published sessions. No user, player, or auth ids; lineup_id is a surrogate row key.';

create or replace view public.public_session_queue as
select
  sp.session_id,
  p.display_name,
  p.skill_level,
  sp.queue_position,
  -- Stable per-row identity for list keys. Surrogate key of the queue row.
  sp.id as queue_entry_id
from public.session_players sp
join public.sessions s on s.id = sp.session_id
join public.clubs c on c.id = s.club_id
join public.players p on p.id = sp.player_id
where sp.attendance_status = 'waiting'
  and sp.queue_position is not null
  and p.is_active
  and s.is_public
  and c.is_public
  and (
    s.status = 'active'
    or (s.status = 'completed' and s.results_published)
  );

comment on view public.public_session_queue is
  'Waiting queue for published sessions. Display names, positions, and a surrogate row key only.';

grant select on public.public_match_lineups to anon, authenticated;
grant select on public.public_session_queue to anon, authenticated;
