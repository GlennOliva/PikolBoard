-- Add opponent/partner id arrays to the public results view.
--
-- Why a new migration: 20260101000003 is already applied to the linked cloud
-- project, and applied migrations are immutable. The club leaderboard needs the
-- opponent and partner ids per game so the ranking logic can live in the
-- tested TypeScript module (lib/domain/leaderboard) instead of being
-- re-derived in SQL.
--
-- CREATE OR REPLACE VIEW cannot reorder or drop columns, and
-- public_session_standings reads from public_match_results, so both views are
-- dropped and recreated here. Grants are re-applied at the end, after creation.

drop view if exists public.public_session_standings;
drop view if exists public.public_match_results;

-- ---------------------------------------------------------------------------
-- public_match_results
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
  ) as opponent_count,
  -- Opponent and partner ids, so the app can compute strength of schedule and
  -- average partner skill with the unit-tested ranking module. These are ids of
  -- players who already appear by name in the public standings, so the arrays
  -- expose nothing new.
  coalesce(
    (select array_agg(opp.player_id order by opp.slot_number)
       from public.match_players opp
      where opp.match_id = mp.match_id
        and opp.team_number <> mp.team_number),
    '{}'::uuid[]
  ) as opponent_ids,
  coalesce(
    (select array_agg(pt.player_id order by pt.slot_number)
       from public.match_players pt
      where pt.match_id = mp.match_id
        and pt.team_number = mp.team_number
        and pt.player_id <> mp.player_id),
    '{}'::uuid[]
  ) as partner_ids,
  coalesce(
    (select sum(pt.skill_snapshot)
       from public.match_players pt
      where pt.match_id = mp.match_id
        and pt.team_number = mp.team_number
        and pt.player_id <> mp.player_id),
    0
  ) as partner_skill_total
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
-- public_session_standings
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
-- Grants after creation: a view must exist before it can be granted. Only the
-- four sanitized views are readable by anon.
-- ---------------------------------------------------------------------------

grant select on public.public_clubs to anon, authenticated;
grant select on public.public_live_sessions to anon, authenticated;
grant select on public.public_match_results to anon, authenticated;
grant select on public.public_session_standings to anon, authenticated;