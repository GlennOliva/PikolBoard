-- Keep an already-public Live Board available as final results after ending.
--
-- A public active session exposes its court and standings data throughout play.
-- Hiding the exact same data the instant end_session runs makes every scanned
-- phone fall back to "not started" instead of the required final-results state.
-- Public sessions therefore publish their final results atomically with ending;
-- private sessions remain private and keep their current publication setting.

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
  select * into v_session from public.sessions where id = p_session_id for update;
  if v_session.id is null then
    raise exception 'Session not found' using errcode = 'P0002';
  end if;

  if not private.is_club_admin(v_session.club_id) then
    raise exception 'Only club organizers can end a session' using errcode = '42501';
  end if;

  if v_session.status = 'completed' then
    return;
  end if;

  select count(*) into v_open
  from public.matches
  where session_id = p_session_id and status in ('staged', 'playing');

  if v_open > 0 and not p_force then
    raise exception
      '% match(es) are still staged or in play. Finish them first, or end anyway.',
      v_open
      using errcode = '22023';
  end if;

  if v_open > 0 then
    update public.matches
    set status = 'cancelled', updated_at = now()
    where session_id = p_session_id and status in ('staged', 'playing');

    update public.match_players mp
    set result = 'cancelled'
    where mp.session_id = p_session_id and mp.result is null;

    update public.courts
    set status = 'available'
    where session_id = p_session_id and status in ('staged', 'playing');
  end if;

  update public.sessions
  set status = 'completed',
      ended_at = now(),
      results_published = case
        when is_public then true
        else results_published
      end
  where id = p_session_id;
end;
$$;

comment on function public.end_session(uuid, boolean) is
  'Ends a session; a public session remains published as final Live Board results.';
