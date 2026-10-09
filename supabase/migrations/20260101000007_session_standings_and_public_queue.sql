-- 0007: session standings that include players who have not finished a game,
-- plus a sanitized waiting queue for the public live board.
--
-- The problem this fixes
-- ---------------------
-- public_session_standings was `select ... from public_match_results group by`.
-- public_match_results only holds a row per player per *completed* match, so a
-- checked-in player with no completed game produced no row at all and simply
-- disappeared from the leaderboard. On a freshly started session that is every
-- player, so the board rendered its empty state until the first match was
-- scored -- the opposite of what a live board should do.
--
-- Every view below starts from public.session_players and LEFT JOINs the
-- aggregated completed-match totals, so an arrived player with zero games is a
-- real row of zeroes rather than a missing row. Nothing is invented in the UI:
-- the zeros come from coalesce() over a genuine roster row.
--
-- Who may read what
-- -----------------
-- Two different mechanisms, on purpose:
--
-- * session_standings is NOT publish-gated. It serves the organizer view of any
--   session the caller may read, so it is declared security_invoker and the RLS
--   policies on session_players / matches / match_players / players do the
--   filtering. anon has no grant on it at all.
--
-- * public_session_standings and public_session_queue are the sanitized,
--   publish-gated ones, and they follow the convention documented in 0003: a
--   plain view runs with the owner's privileges, so RLS is skipped and the
--   view's own is_public filter IS the boundary. They cannot be declared
--   security_invoker, because that would check the anonymous caller's
--   privileges on sessions, matches and players -- exactly the tables the
--   sanitized-view design exists to withhold.
--
-- The completed-match aggregate is therefore written out twice instead of being
-- shared through a helper view, and that duplication is forced rather than lazy:
--
-- * session_standings is security_invoker, so the aggregate has to be built from
--   the base tables directly. security_invoker checks the CALLER's privileges on
--   every relation the view reads, so reading a `private` helper view -- which
--   deliberately has no grant, because it aggregates every session in the
--   database with no RLS of its own -- would fail outright with
--   "permission denied". Granting authenticated on it instead would work, but
--   would hand every signed-in user an unfiltered per-player, per-session
--   history for sessions they are not a member of. Inlining keeps every row of
--   the aggregate inside the caller's RLS reach, which is the point of the view.
--
-- * public_session_standings runs as its owner and has no such constraint, so it
--   reads the `private` helper directly. anon gets the totals through the view's
--   own publish filter, never through a grant on the helper.

-- ---------------------------------------------------------------------------
-- Completed-match totals per session and player.
--
-- Lives in `private` because only the owner-privilege public view reads it. It
-- is never granted to anon or authenticated, and the private schema is not
-- exposed through the Data API. Rows here are NOT RLS-filtered, so nothing that
-- a signed-in user can select should depend on this view directly -- see the
-- header note for why session_standings inlines the same aggregate.
-- ---------------------------------------------------------------------------
create or replace view private.session_match_totals as
select
  m.session_id,
  mp.player_id,
  count(*)::integer as games_played,
  count(*) filter (where mp.result = 'win')::integer as wins,
  count(*) filter (where mp.result = 'loss')::integer as losses,
  coalesce(sum(mp.points_for), 0)::integer as points_for,
  coalesce(sum(mp.points_against), 0)::integer as points_against,
  min(m.completed_at) as first_game_at,
  max(m.completed_at) as last_game_at
from public.match_players mp
join public.matches m on m.id = mp.match_id
where m.status = 'completed'
  and m.completed_at is not null
  and mp.result in ('win', 'loss')
group by m.session_id, mp.player_id;

comment on view private.session_match_totals is
  'Per-player completed match totals, keyed by session. Internal helper, no RLS, never granted.';

-- ---------------------------------------------------------------------------
-- session_standings: organizer / club-member read model, RLS-filtered.
--
-- security_invoker means the totals below are computed under the caller's own
-- privileges, so RLS on matches / match_players also filters the aggregate: a
-- club member cannot accumulate stats from a session they cannot read.
-- ---------------------------------------------------------------------------
create or replace view public.session_standings
with (security_invoker = true)
as
with totals as (
  select
    m.session_id,
    mp.player_id,
    count(*)::integer as games_played,
    count(*) filter (where mp.result = 'win')::integer as wins,
    count(*) filter (where mp.result = 'loss')::integer as losses,
    coalesce(sum(mp.points_for), 0)::integer as points_for,
    coalesce(sum(mp.points_against), 0)::integer as points_against,
    min(m.completed_at) as first_game_at,
    max(m.completed_at) as last_game_at
  from public.match_players mp
  join public.matches m on m.id = mp.match_id
  where m.status = 'completed'
    and m.completed_at is not null
    and mp.result in ('win', 'loss')
  group by m.session_id, mp.player_id
)
select
  sp.session_id,
  s.club_id,
  sp.player_id,
  p.display_name,
  p.skill_level,
  coalesce(t.games_played, 0)::integer as games_played,
  coalesce(t.wins, 0)::integer as wins,
  coalesce(t.losses, 0)::integer as losses,
  coalesce(t.points_for, 0)::integer as points_for,
  coalesce(t.points_against, 0)::integer as points_against,
  t.first_game_at,
  t.last_game_at
from public.session_players sp
join public.sessions s on s.id = sp.session_id
join public.players p on p.id = sp.player_id
left join totals t
  on t.session_id = sp.session_id
 and t.player_id = sp.player_id
where (
    -- Anyone who has arrived shows up, even with no games.
    sp.attendance_status <> 'checked_out'
    -- Someone who checked back out still keeps their completed games on the
    -- board; otherwise a mid-session checkout would erase their record.
    or t.player_id is not null
  )
  and p.is_active;

comment on view public.session_standings is
  'Session standings including arrived players with zero completed games. RLS-filtered via security_invoker, including the totals aggregate.';

-- ---------------------------------------------------------------------------
-- public_session_standings: the same shape, publish-gated for spectators.
-- ---------------------------------------------------------------------------
create or replace view public.public_session_standings as
select
  sp.session_id,
  s.club_id,
  sp.player_id,
  p.display_name,
  p.skill_level,
  coalesce(t.games_played, 0)::integer as games_played,
  coalesce(t.wins, 0)::integer as wins,
  coalesce(t.losses, 0)::integer as losses,
  coalesce(t.points_for, 0)::integer as points_for,
  coalesce(t.points_against, 0)::integer as points_against,
  t.first_game_at,
  t.last_game_at
from public.session_players sp
join public.sessions s on s.id = sp.session_id
join public.clubs c on c.id = s.club_id
join public.players p on p.id = sp.player_id
left join private.session_match_totals t
  on t.session_id = sp.session_id
 and t.player_id = sp.player_id
where (
    sp.attendance_status <> 'checked_out'
    or t.player_id is not null
  )
  and p.is_active
  and s.is_public
  and c.is_public
  and (
    s.status = 'active'
    or (s.status = 'completed' and s.results_published)
  );

comment on view public.public_session_standings is
  'Published session standings, zero-game arrived players included. No auth ids, no emails.';

-- ---------------------------------------------------------------------------
-- public_session_queue: who is waiting, for the anonymous live board.
--
-- Display name, skill level and queue position only. No player_id, no email,
-- nothing that identifies someone off the board.
-- ---------------------------------------------------------------------------
create or replace view public.public_session_queue as
select
  sp.session_id,
  p.display_name,
  p.skill_level,
  sp.queue_position
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
  'Waiting queue for published sessions. Display names and positions only.';

-- ---------------------------------------------------------------------------
-- Grants come last: a view must exist before it can be granted.
-- ---------------------------------------------------------------------------
revoke all on public.session_standings from anon;
grant select on public.session_standings to authenticated;

revoke all on public.public_session_standings from anon;
grant select on public.public_session_standings to anon, authenticated;

grant select on public.public_session_queue to anon, authenticated;