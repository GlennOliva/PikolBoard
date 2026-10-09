-- Keep anonymous Realtime payloads inside the same sanitized boundary as the
-- public views, and publish session lifecycle changes.
--
-- Realtime listens to base tables because Postgres does not emit change events
-- for views. RLS filters rows, but column grants still matter: a broad SELECT on
-- session_players or match_players lets a socket receive avoidable player ids
-- even when the UI callback ignores the payload. Grant only the columns needed
-- to authorize/filter the subscription and render already-public state.

revoke select on public.clubs from anon;
grant select (
  id, name, slug, location, timezone, logo_url, is_public
) on public.clubs to anon;

revoke select on public.courts from anon;
grant select (
  session_id, court_number, name, status, ladder_position
) on public.courts to anon;

revoke select on public.session_players from anon;
grant select (
  id, session_id, attendance_status, queue_position, games_played,
  checked_in_at, last_enqueued_at
) on public.session_players to anon;

revoke select on public.match_players from anon;
grant select (
  id, match_id, session_id, team_number, slot_number, result,
  points_for, points_against
) on public.match_players to anon;

-- The Live Board subscribes to sessions so draft -> active and active ->
-- completed transitions refresh immediately. Duplicate publication membership
-- is harmless and intentionally ignored for projects where it was added by hand.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin
      alter publication supabase_realtime add table public.sessions;
    exception when duplicate_object then null;
    end;
  end if;
end $$;
