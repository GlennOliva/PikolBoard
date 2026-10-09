-- 0004: sanitized public read models.
--
-- These views are the ONLY thing an unauthenticated visitor can read. They run
-- with the view owner's privileges (the default for Postgres views), so RLS on
-- the base tables does not apply to them -- which is exactly why each view
-- carries an explicit `is_public` filter instead of relying on RLS.
--
-- Nothing here exposes an email address, an auth user id, or audit metadata.
-- Ranking, strength of schedule, and partner averages are computed in
-- lib/domain/leaderboard from these rows so the logic is unit tested rather
-- than duplicated in SQL.


create or replace view public.public_clubs as
select
  c.id,
  c.slug,
  c.name,
  c.location,
  c.timezone,
  c.logo_url
from public.clubs c
where c.is_public;

comment on view public.public_clubs is
  'Published clubs. Safe for anonymous visitors.';

-- ---------------------------------------------------------------------------

create or replace view public.public_live_sessions as
select
  s.id,
  s.club_id,
  s.name,
  s.status,
  s.format,
  s.matching_mode,
  s.target_score,
  s.win_by,
  s.court_count,
  s.started_at,
  s.ended_at,
  s.results_published,
  c.slug as club_slug,
  c.name as club_name,
  c.location as club_location
from public.sessions s
join public.clubs c on c.id = s.club_id
where s.is_public
  and c.is_public
  and (
    s.status = 'active'
    or (s.status = 'completed' and s.results_published)
  );

comment on view public.public_live_sessions is
  'Active published sessions, plus completed sessions whose results were published.';

-- ---------------------------------------------------------------------------
-- One row per player per completed match. This single read model powers both
-- the session standings and the all-time club leaderboard, including the
-- date-range and minimum-games filters (applied after aggregation in TS).
-- ---------------------------------------------------------------------------

create or replace view public.public_match_results as
select
  vs.club_id,
  m.session_id,
  m.id as match_id,
  m.completed_at,
  mp.team_number,
  mp.player_id,
  pl.display_name,
  pl.skill_level,
  (mp.team_number = m.winning_team) as won,
  mp.points_for,
  mp.points_against,
  coalesce(
    (select sum(opp.skill_snapshot)
       from public.match_players opp
      where opp.match_id = mp.match_id
        and opp.team_number <> mp.team_number),
    0
  ) as opponent_skill_total,
  (select count(*)
     from public.match_players opp
    where opp.match_id = mp.match_id
      and opp.team_number <> mp.team_number
  ) as opponent_count
from public.match_players mp
join public.matches m on m.id = mp.match_id
join public.sessions s on s.id = m.session_id
join public.clubs c on c.id = s.club_id
join public.players pl on pl.id = mp.player_id
join (
  select s2.id as session_id, s2.club_id
  from public.sessions s2
  join public.clubs c2 on c2.id = s2.club_id
  where s2.is_public
    and c2.is_public
    and (
      s2.status = 'active'
      or (s2.status = 'completed' and s2.results_published)
    )
) vs on vs.session_id = m.session_id
where m.status = 'completed'
  and m.completed_at is not null
  and mp.result in ('win', 'loss')
  and mp.points_for is not null
  and mp.points_against is not null;

comment on view public.public_match_results is
  'Per-player completed match results for published sessions. No auth ids, no emails.';

-- ---------------------------------------------------------------------------

create or replace view public.public_session_standings as
select
  r.session_id,
  r.club_id,
  r.player_id,
  r.display_name,
  r.skill_level,
  count(*)::integer as games_played,
  count(*) filter (where r.won)::integer as wins,
  count(*) filter (where not r.won)::integer as losses,
  sum(r.points_for)::integer as points_for,
  sum(r.points_against)::integer as points_against,
  min(r.completed_at) as first_game_at,
  max(r.completed_at) as last_game_at
from public.public_match_results r
group by r.session_id, r.club_id, r.player_id, r.display_name, r.skill_level;

comment on view public.public_session_standings is
  'Per-session W/L/points totals for published sessions. Ranking is applied in the app.';

-- ---------------------------------------------------------------------------
-- Grants come after creation: a view must exist before it can be granted.
-- The anon role is the only role given unauthenticated read access, and only
-- on these four sanitized views.
-- ---------------------------------------------------------------------------
grant select on public.public_clubs to anon, authenticated;
grant select on public.public_live_sessions to anon, authenticated;
grant select on public.public_match_results to anon, authenticated;
grant select on public.public_session_standings to anon, authenticated;
