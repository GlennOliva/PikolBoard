-- Fictional demo data for PickleBoard.
--
-- Safe to run repeatedly: every insert is idempotent.
--
-- The organizer is NOT hardcoded. Pass the id of an existing auth user:
--
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 \
--     -v organizer_id='<auth-user-uuid>' -f supabase/seed.sql
--
-- or from psql:
--
--   \set organizer_id '<auth-user-uuid>'
--   select set_config('pickleboard.organizer_id', :'organizer_id', false);
--   \i supabase/seed.sql
--
-- Create the auth user first (Dashboard > Authentication > Users > "Add user",
-- or `npm run e2e:setup-account`). Without it this file exits with a notice and
-- creates nothing.
--
-- Every name below is fictional demo data.

do $$
declare
  v_owner uuid := nullif(current_setting('pickleboard.organizer_id', true), '')::uuid;
  v_prev_claims text;
  v_club uuid := '00000000-0000-4000-8000-0000000000c1';
  v_session uuid := '00000000-0000-4000-8000-0000000000ce';
  v_active uuid := '00000000-0000-4000-8000-0000000000ac';
  v_court uuid;
  v_match uuid;
  v_i integer;
begin
  if v_owner is null then
    raise notice
      'Skipping PickleBoard seed: organizer_id not set. See the header of this file.';
    return;
  end if;

  if not exists (select 1 from auth.users where id = v_owner) then
    raise exception
      'organizer_id % does not exist in auth.users. Create the user first.', v_owner;
  end if;

  -- ---------------------------------------------------------------------
  -- Club + owner membership + settings
  -- ---------------------------------------------------------------------
  insert into public.clubs (id, name, slug, location, timezone, is_public, created_by)
  values (
    v_club, 'Harbour Street Pickleball', 'harbour-street-pickleball',
    'Pier 4, Harbour Street', 'Australia/Sydney', true, v_owner
  )
  on conflict (id) do nothing;

  insert into public.club_members (club_id, user_id, role, status)
  values (v_club, v_owner, 'owner', 'active')
  on conflict (club_id, user_id) do nothing;

  insert into public.club_settings (club_id, min_games_for_leaderboard, default_match_minutes)
  values (v_club, 3, 15)
  on conflict (club_id) do nothing;

  -- ---------------------------------------------------------------------
  -- Roster: 12 fictional players, skills spread across 1-6
  -- ---------------------------------------------------------------------
  insert into public.players (id, club_id, display_name, skill_level, division) values
    ('00000000-0000-4000-8000-000000000101', v_club, 'Ava Lindqvist',  4, null),
    ('00000000-0000-4000-8000-000000000102', v_club, 'Ben Okafor',     3, null),
    ('00000000-0000-4000-8000-000000000103', v_club, 'Carla Mendez',   2, null),
    ('00000000-0000-4000-8000-000000000104', v_club, 'Devi Raman',     5, null),
    ('00000000-0000-4000-8000-000000000105', v_club, 'Eli Fontaine',   3, null),
    ('00000000-0000-4000-8000-000000000106', v_club, 'Freya Nakamura', 6, null),
    ('00000000-0000-4000-8000-000000000107', v_club, 'Gus Alvarez',    1, null),
    ('00000000-0000-4000-8000-000000000108', v_club, 'Hana Petrova',   4, null),
    ('00000000-0000-4000-8000-000000000109', v_club, 'Iris Kavanagh',  2, null),
    ('00000000-0000-4000-8000-00000000010a', v_club, 'Jonah Weiss',    5, null),
    ('00000000-0000-4000-8000-00000000010b', v_club, 'Kai Oyelaran',   3, null),
    ('00000000-0000-4000-8000-00000000010c', v_club, 'Lena Sorensen',  6, null)
  on conflict (id) do nothing;

  -- ---------------------------------------------------------------------
  -- One published, completed session with a short match history
  -- ---------------------------------------------------------------------
  insert into public.sessions (
    id, club_id, name, status, format, matching_mode, target_score, win_by,
    court_count, is_public, results_published, started_at, ended_at, created_by
  )
  values (
    v_session, v_club, 'Saturday Sunset Doubles', 'completed', 'doubles', 'balanced',
    11, 2, 2, true, true,
    now() - interval '2 days', now() - interval '2 days' + interval '2 hours',
    v_owner
  )
  on conflict (id) do nothing;

  insert into public.courts (id, session_id, court_number, name, ladder_position)
  values
    ('00000000-0000-4000-8000-000000000201', v_session, 1, 'Court 1', 1),
    ('00000000-0000-4000-8000-000000000202', v_session, 2, 'Court 2', 2)
  on conflict (session_id, court_number) do nothing;

  insert into public.session_players (session_id, player_id, attendance_status, checked_in_at)
  select v_session, p.id, 'finished', now() - interval '2 days'
  from public.players p
  where p.club_id = v_club
  on conflict (session_id, player_id) do nothing;

  -- Two finished matches. Written directly because the seed runs as the table
  -- owner rather than through complete_match().
  insert into public.matches (
    id, session_id, court_id, match_number, status, team1_score, team2_score,
    target_score, win_by, winning_team, matching_mode, explanation,
    staged_at, started_at, completed_at, created_by
  )
  values
    (
      '00000000-0000-4000-8000-000000000401', v_session,
      '00000000-0000-4000-8000-000000000201', 1, 'completed', 11, 7,
      11, 2, 1, 'balanced',
      'Closest skill pairing from the four longest-waiting players.',
      now() - interval '2 days' + interval '10 minutes',
      now() - interval '2 days' + interval '11 minutes',
      now() - interval '2 days' + interval '26 minutes', v_owner
    ),
    (
      '00000000-0000-4000-8000-000000000402', v_session,
      '00000000-0000-4000-8000-000000000202', 2, 'completed', 9, 11,
      11, 2, 2, 'skill_separated',
      'Smallest skill range available; nobody starved past the threshold.',
      now() - interval '2 days' + interval '28 minutes',
      now() - interval '2 days' + interval '29 minutes',
      now() - interval '2 days' + interval '44 minutes', v_owner
    )
  on conflict (id) do nothing;

  -- Match 1: team 1 = Ava(4) + Gus(1); team 2 = Freya(6) + Carl(2)
  insert into public.match_players (
    match_id, player_id, session_id, team_number, slot_number, skill_snapshot,
    result, points_for, points_against
  )
  select
    m.id, p.id, v_session,
    case when p.display_name in ('Ava Lindqvist', 'Gus Alvarez') then 1 else 2 end,
    case when p.display_name in ('Ava Lindqvist', 'Freya Nakamura') then 1 else 2 end,
    p.skill_level,
    (case when p.display_name in ('Ava Lindqvist', 'Gus Alvarez') then 'win' else 'loss' end)::public.match_result,
    case when p.display_name in ('Ava Lindqvist', 'Gus Alvarez') then m.team1_score else m.team2_score end,
    case when p.display_name in ('Ava Lindqvist', 'Gus Alvarez') then m.team2_score else m.team1_score end
  from public.matches m
  cross join public.players p
  where m.session_id = v_session
    and m.match_number = 1
    and p.club_id = v_club
    and p.display_name in ('Ava Lindqvist', 'Gus Alvarez', 'Freya Nakamura', 'Carla Mendez')
  on conflict (match_id, player_id) do nothing;

  -- Match 2: team 1 = Devi(5) + Hana(4); team 2 = Jonah(5) + Kai(3)
  insert into public.match_players (
    match_id, player_id, session_id, team_number, slot_number, skill_snapshot,
    result, points_for, points_against
  )
  select
    m.id, p.id, v_session,
    case when p.display_name in ('Devi Raman', 'Hana Petrova') then 1 else 2 end,
    case when p.display_name in ('Devi Raman', 'Jonah Weiss') then 1 else 2 end,
    p.skill_level,
    (case when p.display_name in ('Devi Raman', 'Hana Petrova') then 'loss' else 'win' end)::public.match_result,
    case when p.display_name in ('Devi Raman', 'Hana Petrova') then m.team1_score else m.team2_score end,
    case when p.display_name in ('Devi Raman', 'Hana Petrova') then m.team2_score else m.team1_score end
  from public.matches m
  cross join public.players p
  where m.session_id = v_session
    and m.match_number = 2
    and p.club_id = v_club
    and p.display_name in ('Devi Raman', 'Hana Petrova', 'Jonah Weiss', 'Kai Oyelaran')
  on conflict (match_id, player_id) do nothing;

  -- Roll the per-player stats up from the seeded match results.
  update public.session_players sp
  set
    games_played = s.games,
    wins = s.wins,
    losses = s.losses,
    points_for = s.points_for,
    points_against = s.points_against
  from (
    select
      mp.player_id,
      count(*)::integer as games,
      count(*) filter (where mp.result = 'win')::integer as wins,
      count(*) filter (where mp.result = 'loss')::integer as losses,
      sum(mp.points_for)::integer as points_for,
      sum(mp.points_against)::integer as points_against
    from public.match_players mp
    where mp.session_id = v_session
    group by mp.player_id
  ) s
  where sp.session_id = v_session and sp.player_id = s.player_id;

  -- ---------------------------------------------------------------------
  -- One live session so the public live page has something to show
  -- ---------------------------------------------------------------------
  insert into public.sessions (
    id, club_id, name, status, format, matching_mode, target_score, win_by,
    court_count, is_public, results_published, started_at, created_by
  )
  values (
    v_active, v_club, 'Wednesday Twilight Open Play', 'active', 'doubles',
    'balanced', 11, 2, 2, true, false, now() - interval '35 minutes', v_owner
  )
  on conflict (id) do nothing;

  insert into public.courts (id, session_id, court_number, name, ladder_position)
  values
    ('00000000-0000-4000-8000-000000000301', v_active, 1, 'Court 1', 1),
    ('00000000-0000-4000-8000-000000000302', v_active, 2, 'Court 2', 2)
  on conflict (session_id, court_number) do nothing;

  -- Six players waiting. row_number assigns each a distinct queue position:
  -- a plain cross join with the values (1..6) would give every player all six
  -- positions, so the seed would show six players per queue slot.
  insert into public.session_players (
    session_id, player_id, attendance_status, queue_position, checked_in_at, last_enqueued_at
  )
  select v_active, p.id, 'waiting', p.rn,
         now() - interval '35 minutes', now() - interval '35 minutes'
  from (
    select id, row_number() over (order by display_name)::integer as rn
    from public.players
    where club_id = v_club
    order by display_name
    limit 6
  ) p
  on conflict (session_id, player_id) do nothing;

  -- Put one match on court 1 so the live page shows an in-progress game.
  --
  -- stage_match and start_match re-check authorization with
  -- private.is_club_admin(), which reads auth.uid() from the request JWT. Seeding
  -- runs as the table owner with no request, so auth.uid() would be null and both
  -- calls would be rejected. Set the organizer's claims for the duration, then
  -- restore whatever was there.
  v_prev_claims := current_setting('request.jwt.claims', true);

  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', v_owner, 'role', 'authenticated')::text,
    true
  );

  select id into v_court
  from public.courts where session_id = v_active and court_number = 1;

  v_match := public.stage_match(
    v_active,
    v_court,
    array[
      '00000000-0000-4000-8000-000000000101',
      '00000000-0000-4000-8000-000000000102',
      '00000000-0000-4000-8000-000000000103',
      '00000000-0000-4000-8000-000000000104'
    ]::uuid[],
    array[1, 1, 2, 2]::smallint[],
    'Seed demo: earliest four waiting players, teams balanced by skill.',
    'fifo'
  );

  perform public.start_match(v_match);

  if v_prev_claims is null then
    perform set_config('request.jwt.claims', '', true);
  else
    perform set_config('request.jwt.claims', v_prev_claims, true);
  end if;

  raise notice
    'PickleBoard seed complete: club %, completed session %, live session %.',
    v_club, v_session, v_active;
end $$;