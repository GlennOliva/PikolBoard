-- In-session player management.
--
-- The club Sessions tab can add roster players to a session, but the organizer
-- also needs to do that from the live session screen: add several existing
-- players and check them in, create a brand-new player without leaving the
-- session, check in a group, and remove somebody who has left.
--
-- These are separate RPCs rather than extra overloads of add_session_players.
-- Adding a defaulted parameter to an existing function would leave two callable
-- overloads in Postgres, which makes PostgREST resolution ambiguous.
--
-- Every function locks the session first, re-checks authorization, and refuses
-- a completed or cancelled session. A player with an unresolved match row can
-- never be checked in or removed: that is what keeps a lineup from containing a
-- person who was quietly returned to the queue.

begin;

-- Add existing club players to a session, optionally checking them in.
--
-- Returns the number of players that were newly added or moved into the queue.
-- A player already waiting is left exactly where they are, so re-submitting the
-- same dialog cannot silently move somebody to the back of the queue.
create or replace function public.add_players_to_session(
  p_session_id uuid,
  p_player_ids uuid[],
  p_check_in boolean default true
)
returns integer
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_session public.sessions%rowtype;
  v_requested record;
  v_sp public.session_players%rowtype;
  v_position integer;
  v_changed integer := 0;
begin
  select * into v_session
  from public.sessions
  where id = p_session_id
  for update;

  if v_session.id is null then
    raise exception 'Session not found' using errcode = 'P0002';
  end if;

  if not private.is_club_admin(v_session.club_id) then
    raise exception 'Only club organizers can add players to a session'
      using errcode = '42501';
  end if;

  if v_session.status in ('completed', 'cancelled') then
    raise exception 'This session is closed' using errcode = '22023';
  end if;

  if coalesce(cardinality(p_player_ids), 0) = 0 then
    return 0;
  end if;

  -- Validate the whole batch before writing anything, matching 0006's
  -- add_session_players behaviour: a cross-club id must fail loudly, not vanish.
  if exists (
    select 1
    from unnest(p_player_ids) as requested(player_id)
    where not exists (
      select 1
      from public.players p
      where p.id = requested.player_id
        and p.club_id = v_session.club_id
    )
  ) then
    raise exception
      'Every player must belong to the club that owns this session'
      using errcode = '22023';
  end if;

  for v_requested in
    select requested.player_id
    from unnest(p_player_ids) as requested(player_id)
  loop
    select * into v_sp
    from public.session_players
    where session_id = p_session_id
      and player_id = v_requested.player_id
    for update;

    if v_sp.id is null then
      v_position := case
        when p_check_in then private.next_queue_position(p_session_id)
        else null
      end;

      insert into public.session_players (
        session_id, player_id, attendance_status, queue_position,
        checked_in_at, last_enqueued_at
      )
      values (
        p_session_id,
        v_requested.player_id,
        case when p_check_in then 'waiting'::public.attendance_status else 'checked_out'::public.attendance_status end,
        v_position,
        case when p_check_in then now() else null end,
        case when p_check_in then now() else null end
      );

      v_changed := v_changed + 1;

      if p_check_in then
        perform private.log_queue_event(
          p_session_id, null, v_requested.player_id, 'check_in',
          null, 'waiting',
          jsonb_build_object('queue_position', v_position, 'source', 'session_add')
        );
      end if;

      continue;
    end if;

    -- Existing rows only move when the organizer explicitly asked to check in
    -- somebody who is not currently in the rotation. Waiting, on break, staged,
    -- and playing rows keep their current state and queue position.
    if p_check_in
       and (
         v_sp.attendance_status in ('checked_out', 'finished', 'break')
         or (v_sp.attendance_status = 'waiting' and v_sp.queue_position is null)
       )
    then
      v_position := private.next_queue_position(p_session_id);

      update public.session_players
      set attendance_status = 'waiting',
          queue_position = v_position,
          checked_in_at = coalesce(checked_in_at, now()),
          last_enqueued_at = now()
      where id = v_sp.id;

      v_changed := v_changed + 1;

      perform private.log_queue_event(
        p_session_id, v_sp.id, v_requested.player_id, 'check_in',
        v_sp.attendance_status, 'waiting',
        jsonb_build_object('queue_position', v_position, 'source', 'session_add')
      );
    end if;
  end loop;

  return v_changed;
end;
$$;

-- Create a club player and put them straight into this session.
--
-- Returns the new players.id. The player remains on the club roster, so future
-- sessions can reuse them; this is not a session-only/guest record.
create or replace function public.create_player_for_session(
  p_session_id uuid,
  p_display_name text,
  p_skill_level integer,
  p_division text default null,
  p_check_in boolean default true
)
returns uuid
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_session public.sessions%rowtype;
  v_player_id uuid;
  v_position integer;
  v_name text;
begin
  select * into v_session
  from public.sessions
  where id = p_session_id
  for update;

  if v_session.id is null then
    raise exception 'Session not found' using errcode = 'P0002';
  end if;

  if not private.is_club_admin(v_session.club_id) then
    raise exception 'Only club organizers can add players to a session'
      using errcode = '42501';
  end if;

  if v_session.status in ('completed', 'cancelled') then
    raise exception 'This session is closed' using errcode = '22023';
  end if;

  v_name := btrim(coalesce(p_display_name, ''));
  if char_length(v_name) < 1 or char_length(v_name) > 60 then
    raise exception 'Player name must be between 1 and 60 characters'
      using errcode = '22023';
  end if;

  if p_skill_level is null or p_skill_level < 1 or p_skill_level > 6 then
    raise exception 'Skill level must be between 1 and 6'
      using errcode = '22023';
  end if;

  insert into public.players (club_id, display_name, skill_level, division)
  values (
    v_session.club_id,
    v_name,
    p_skill_level,
    nullif(btrim(coalesce(p_division, '')), '')
  )
  returning id into v_player_id;

  v_position := case
    when p_check_in then private.next_queue_position(p_session_id)
    else null
  end;

  insert into public.session_players (
    session_id, player_id, attendance_status, queue_position,
    checked_in_at, last_enqueued_at
  )
  values (
    p_session_id,
    v_player_id,
    case when p_check_in then 'waiting'::public.attendance_status else 'checked_out'::public.attendance_status end,
    v_position,
    case when p_check_in then now() else null end,
    case when p_check_in then now() else null end
  );

  if p_check_in then
    perform private.log_queue_event(
      p_session_id, null, v_player_id, 'check_in',
      null, 'waiting',
      jsonb_build_object('queue_position', v_position, 'source', 'session_create_player')
    );
  end if;

  return v_player_id;
end;
$$;

-- Check in a batch of session players. All-or-nothing: if one is in a match,
-- the whole call raises and no queue position is consumed.
create or replace function public.check_in_session_players(
  p_session_id uuid,
  p_player_ids uuid[]
)
returns integer
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_session public.sessions%rowtype;
  v_requested record;
  v_sp public.session_players%rowtype;
  v_position integer;
  v_changed integer := 0;
begin
  select * into v_session
  from public.sessions
  where id = p_session_id
  for update;

  if v_session.id is null then
    raise exception 'Session not found' using errcode = 'P0002';
  end if;

  if not private.is_club_admin(v_session.club_id) then
    raise exception 'Only club organizers can check players in'
      using errcode = '42501';
  end if;

  if v_session.status in ('completed', 'cancelled') then
    raise exception 'This session is closed' using errcode = '22023';
  end if;

  if coalesce(cardinality(p_player_ids), 0) = 0 then
    return 0;
  end if;

  for v_requested in
    select requested.player_id
    from unnest(p_player_ids) as requested(player_id)
  loop
    select * into v_sp
    from public.session_players
    where session_id = p_session_id
      and player_id = v_requested.player_id
    for update;

    if v_sp.id is null then
      raise exception 'That player is not in this session' using errcode = '22023';
    end if;

    if v_sp.attendance_status in ('playing', 'staged')
       or exists (
         select 1
         from public.match_players mp
         where mp.session_id = p_session_id
           and mp.player_id = v_requested.player_id
           and mp.result is null
       )
    then
      raise exception 'That player is currently in a match. Finish or cancel it first.'
        using errcode = '22023';
    end if;

    if v_sp.attendance_status = 'waiting' and v_sp.queue_position is not null then
      continue;
    end if;

    v_position := private.next_queue_position(p_session_id);

    update public.session_players
    set attendance_status = 'waiting',
        queue_position = v_position,
        checked_in_at = coalesce(checked_in_at, now()),
        last_enqueued_at = now()
    where id = v_sp.id;

    v_changed := v_changed + 1;

    perform private.log_queue_event(
      p_session_id, v_sp.id, v_requested.player_id, 'check_in',
      v_sp.attendance_status, 'waiting',
      jsonb_build_object('queue_position', v_position, 'source', 'session_bulk_check_in')
    );
  end loop;

  return v_changed;
end;
$$;

-- Remove somebody from the session. The old version only looked at the
-- attendance label, but the lineup pipeline marks every stage as 'staged'
-- (including Preparation and Up Next). An unresolved match_players row is the
-- durable fact, so that is what this now checks before deleting anything.
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

-- New functions default to EXECUTE for PUBLIC in Postgres. Match the rest of
-- the write API: no anonymous execution, authenticated organizers only.
revoke all on function
  public.add_players_to_session(uuid, uuid[], boolean),
  public.create_player_for_session(uuid, text, integer, text, boolean),
  public.check_in_session_players(uuid, uuid[]),
  public.remove_session_player(uuid, uuid)
from public, anon;

grant execute on function
  public.add_players_to_session(uuid, uuid[], boolean),
  public.create_player_for_session(uuid, text, integer, text, boolean),
  public.check_in_session_players(uuid, uuid[]),
  public.remove_session_player(uuid, uuid)
to authenticated;

commit;
