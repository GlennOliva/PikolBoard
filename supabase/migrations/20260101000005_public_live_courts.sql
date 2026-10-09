-- Public court state and lineups.
--
-- The earlier public views covered the club, the session header, and results,
-- but not what each court is doing right now. The SOP's shareable live board
-- needs that, and it must not be assembled by reading private tables from the
-- server: anon has no grants there.
--
-- Two more sanitized views, both keyed by (session_id, court_number) so no row
-- ids leak. Court names and player display names are already public via the
-- club page and standings, so nothing new is exposed.

-- ---------------------------------------------------------------------------
-- public_live_courts
-- ---------------------------------------------------------------------------

create or replace view public.public_live_courts as
select
  s.id as session_id,
  s.club_id,
  c.court_number,
  c.name as court_name,
  c.status as court_status,
  c.ladder_position,
  m.status as match_status,
  m.winning_team,
  m.target_score,
  m.started_at as match_started_at,
  m.completed_at as match_completed_at
from public.sessions s
join public.clubs cl on cl.id = s.club_id
join public.courts c on c.session_id = s.id
left join public.matches m
  on m.court_id = c.id
 -- A cancelled match must not resurrect the court as "in play".
 and (m.id is null or m.status in ('staged', 'playing'))
where s.is_public
  and cl.is_public
  and (
    s.status = 'active'
    or (s.status = 'completed' and s.results_published)
  );

comment on view public.public_live_courts is
  'Court status and current match state for published sessions. No ids, no auth data.';

-- ---------------------------------------------------------------------------
-- public_match_lineups
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
  mp.points_against
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
  'Player names and teams for games in flight on published sessions. No ids.';

-- ---------------------------------------------------------------------------
-- Grants after creation.
-- ---------------------------------------------------------------------------

grant select on public.public_live_courts to anon, authenticated;
grant select on public.public_match_lineups to anon, authenticated;