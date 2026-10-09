-- Public Live Board read model and running-score support.
--
-- Forward-only. Existing public views remain publish-gated and keep every
-- existing column in the same order; new columns are appended so current
-- PostgREST clients keep working. The new presence view exposes only the fields
-- a spectator needs to understand the queue. It contains no user id, email,
-- membership, audit, or private settings data.

-- ---------------------------------------------------------------------------
-- 1. Session header: append aggregate duration for estimated queue wait.
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
  c.location as club_location,
  stats.avg_match_minutes,
  stats.completed_match_count
from public.sessions s
join public.clubs c on c.id = s.club_id
left join lateral (
  select
    round(avg(extract(epoch from (m.completed_at - m.started_at))) / 60.0)::integer
      as avg_match_minutes,
    count(*)::integer as completed_match_count
  from public.matches m
  where m.session_id = s.id
    and m.status = 'completed'
    and m.started_at is not null
    and m.completed_at is not null
    and m.completed_at >= m.started_at
) stats on true
where s.is_public
  and c.is_public
  and (
    s.status = 'active'
    or (s.status = 'completed' and s.results_published)
  );

comment on view public.public_live_sessions is
  'Published live session headers with aggregate match duration. No auth ids, emails, or private settings.';

grant select on public.public_live_sessions to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. Court state: append the score currently persisted on the match.
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
  m.completed_at as match_completed_at,
  m.team1_score,
  m.team2_score
from public.sessions s
join public.clubs cl on cl.id = s.club_id
join public.courts c on c.session_id = s.id
left join public.matches m
  on m.court_id = c.id
 and (m.id is null or m.status in ('staged', 'playing'))
where s.is_public
  and cl.is_public
  and (
    s.status = 'active'
    or (s.status = 'completed' and s.results_published)
  );

comment on view public.public_live_courts is
  'Court status, current match state, and running score for published sessions. No internal ids or auth data.';

grant select on public.public_live_courts to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. Sanitized player presence for the public queue/status board.
-- ---------------------------------------------------------------------------

create or replace view public.public_session_presence as
select
  sp.session_id,
  p.display_name,
  p.skill_level,
  sp.attendance_status,
  sp.queue_position,
  sp.games_played,
  sp.checked_in_at,
  sp.last_enqueued_at,
  -- Stable React identity. This is the session_players surrogate row id, not a
  -- player, user, membership, or auth id.
  sp.id as presence_id
from public.session_players sp
join public.sessions s on s.id = sp.session_id
join public.clubs c on c.id = s.club_id
join public.players p on p.id = sp.player_id
where p.is_active
  and s.is_public
  and c.is_public
  and (
    s.status = 'active'
    or (s.status = 'completed' and s.results_published)
  );

comment on view public.public_session_presence is
  'Sanitized attendance and queue state for published sessions. No player, user, membership, or auth ids.';

revoke all on public.public_session_presence from public;
grant select on public.public_session_presence to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. Standings: start from the full session roster, including zero games.
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
where p.is_active
  and s.is_public
  and c.is_public
  and (
    s.status = 'active'
    or (s.status = 'completed' and s.results_published)
  );

comment on view public.public_session_standings is
  'Published session standings starting from every rostered player, including zero completed games. No auth ids or emails.';

revoke all on public.public_session_standings from public;
grant select on public.public_session_standings to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 5. Organizer-only running score.
-- ---------------------------------------------------------------------------

create or replace function public.set_running_score(
  p_match_id uuid,
  p_team1_score integer,
  p_team2_score integer
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_match public.matches%rowtype;
  v_session public.sessions%rowtype;
  v_session_id uuid;
begin
  if p_team1_score is null or p_team2_score is null
     or p_team1_score < 0 or p_team2_score < 0 then
    raise exception 'Scores must be whole numbers of 0 or more'
      using errcode = '22023';
  end if;

  -- Match the lock order used by start_match and complete_match: session first,
  -- then match. This avoids deadlocks with a final score arriving at the same
  -- instant as a running-score update.
  select session_id into v_session_id
  from public.matches
  where id = p_match_id;

  if v_session_id is null then
    raise exception 'Match not found' using errcode = 'P0002';
  end if;

  select * into v_session
  from public.sessions
  where id = v_session_id
  for update;

  select * into v_match
  from public.matches
  where id = p_match_id
  for update;

  if not private.is_club_admin(v_session.club_id) then
    raise exception 'Only club organizers can update a running score'
      using errcode = '42501';
  end if;

  if v_match.status <> 'playing' then
    raise exception 'Only a playing match has a running score'
      using errcode = '22023';
  end if;

  -- Once a score is a legal win it belongs through complete_match, which also
  -- updates results, queue positions, standings, and the audit trail atomically.
  if greatest(p_team1_score, p_team2_score) >= v_match.target_score
     and abs(p_team1_score - p_team2_score) >= v_match.win_by then
    raise exception 'That is a final score. Use "Record score" to complete the match.'
      using errcode = '22023';
  end if;

  update public.matches
  set team1_score = p_team1_score,
      team2_score = p_team2_score
  where id = p_match_id;

  return jsonb_build_object(
    'match_id', p_match_id,
    'team1_score', p_team1_score,
    'team2_score', p_team2_score
  );
end;
$$;

comment on function public.set_running_score(uuid, integer, integer) is
  'Organizer-only running score update. Final results still go through complete_match.';

revoke all on function public.set_running_score(uuid, integer, integer) from public;
revoke all on function public.set_running_score(uuid, integer, integer) from anon;
grant execute on function public.set_running_score(uuid, integer, integer) to authenticated;
