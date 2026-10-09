-- ---------------------------------------------------------------------------
-- add_session_players: reject ineligible ids instead of dropping them
-- ---------------------------------------------------------------------------
-- The previous version filtered with `p.club_id = v_session.club_id` and then
-- inserted whatever survived, so a cross-club player id (or one that does not
-- exist) was silently skipped. The organizer saw a smaller number come back and
-- no explanation, which looks identical to "already on the session".
--
-- The filter stays, so the insert is still scoped to the owning club. What is
-- new is an explicit pre-check that every requested id belongs to that club, so
-- a wrong club fails loudly and atomically instead of partially succeeding.
--
-- Eligibility is checked against players.id, matching the column the RPC
-- callers pass. The session_players row id is never a valid argument here.
-- ---------------------------------------------------------------------------
create or replace function public.add_session_players(
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
  v_inserted integer;
begin
  select * into v_session from public.sessions where id = p_session_id for update;
  if v_session.id is null then
    raise exception 'Session not found' using errcode = 'P0002';
  end if;

  if not private.is_club_admin(v_session.club_id) then
    raise exception 'Only club organizers can add players to a session' using errcode = '42501';
  end if;

  if v_session.status in ('completed', 'cancelled') then
    raise exception 'This session is closed' using errcode = '22023';
  end if;

  -- Reject the whole batch if any id is not a player of the owning club. Doing
  -- this before the insert keeps it atomic: the organizer either gets every
  -- player they asked for, or an error.
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

  insert into public.session_players (session_id, player_id, attendance_status)
  select p_session_id, p.id, 'checked_out'
  from public.players p
  where p.id = any(p_player_ids) and p.club_id = v_session.club_id
  on conflict (session_id, player_id) do nothing;

  get diagnostics v_inserted = row_count;
  return v_inserted;
end;
$$;