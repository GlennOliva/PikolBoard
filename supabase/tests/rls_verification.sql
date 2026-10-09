-- RLS + authorization verification suite.
--
-- Runs entirely inside a transaction that is rolled back, so it never leaves
-- fixtures behind in your project.
--
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/rls_verification.sql
--   -- or paste into the Supabase SQL editor and run once.
--
-- Every assertion prints PASS/FAIL. Any FAIL aborts with ON_ERROR_STOP.

-- Runs as a single transaction under both psql and `supabase db query`, so the
-- fixtures below roll back on their own and leave the database untouched.
-- Note: no psql meta-commands (\set, \gset, :'var') anywhere in this file, so
-- the Supabase CLI's SQL runner can execute it against the cloud project too.

begin;

-- ---------------------------------------------------------------------------
-- assertion helper (created before any role switch so it stays callable)
-- ---------------------------------------------------------------------------
create or replace function pg_temp.pb_assert(p_condition boolean, p_label text)
returns void
language plpgsql
as $$
begin
  if p_condition is null or p_condition is false then
    raise exception 'FAIL: %', p_label;
  end if;
  raise notice 'PASS: %', p_label;
end;
$$;

-- ---------------------------------------------------------------------------
-- Fixtures (all fictional). Fixed ids keep the assertions readable.
-- ---------------------------------------------------------------------------
-- users
insert into auth.users (id, email) values
  ('11111111-1111-4111-8111-111111111111', 'owner-a@example.test'),
  ('22222222-2222-4222-8222-222222222222', 'admin-b@example.test'),
  ('33333333-3333-4333-8333-333333333333', 'player-a@example.test'),
  ('44444444-4444-4444-8444-444444444444', 'outsider@example.test');

-- The handle_new_user trigger should have created a profile per user.
--
-- Scoped to the four fixture users: this suite also runs against the linked
-- cloud project, where real signups already own rows in these tables.
do $$
begin
  perform pg_temp.pb_assert(
    (select count(*) from public.profiles where id in (
      '11111111-1111-4111-8111-111111111111',
      '22222222-2222-4222-8222-222222222222',
      '33333333-3333-4333-8333-333333333333',
      '44444444-4444-4444-8444-444444444444'
    )) = 4,
    'handle_new_user creates one profile per auth user'
  );
end $$;

-- clubs
insert into public.clubs (id, name, slug, is_public, created_by) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Harbour Pickle Club', 'harbour-pickle-club', false, '11111111-1111-4111-8111-111111111111'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'Riverside Open Play', 'riverside-open-play', true, '22222222-2222-4222-8222-222222222222');

-- memberships: owner/admin of A, owner of B, plain player of A
insert into public.club_members (club_id, user_id, role) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '11111111-1111-4111-8111-111111111111', 'owner'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '33333333-3333-4333-8333-333333333333', 'player'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '22222222-2222-4222-8222-222222222222', 'owner');

-- roster. Players five and six exist purely to hold queue slots while the
-- first four are in a match, so the "returning players join behind" rule below
-- has something to be behind.
insert into public.players (id, club_id, display_name, skill_level) values
  ('a0000000-0000-4000-8000-000000000001', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Test Player One', 3),
  ('a0000000-0000-4000-8000-000000000002', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Test Player Two', 4),
  ('a0000000-0000-4000-8000-000000000003', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Test Player Three', 2),
  ('a0000000-0000-4000-8000-000000000004', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Test Player Four', 5),
  ('a0000000-0000-4000-8000-000000000005', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Test Player Five', 3),
  ('a0000000-0000-4000-8000-000000000006', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Test Player Six', 3);

-- Players seven to ten are reserved for the live-board section, which needs a
-- doubles match of its own. The one-unresolved-match-per-player index is global
-- across sessions, so an earlier section that deliberately leaves a staged
-- match holding players one to four would otherwise block that match.
insert into public.players (id, club_id, display_name, skill_level) values
  ('a0000000-0000-4000-8000-000000000007', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Test Player Seven', 3),
  ('a0000000-0000-4000-8000-000000000008', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Test Player Eight', 4),
  ('a0000000-0000-4000-8000-000000000009', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Test Player Nine', 2),
  ('a0000000-0000-4000-8000-00000000000a', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Test Player Ten', 5);

-- A player owned by a different club, used to prove add_session_players
-- refuses cross-club ids instead of silently dropping them.
insert into public.players (id, club_id, display_name, skill_level) values
  ('a0000000-0000-4000-8000-0000000000b1', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'Other Club Player', 3);

-- private (unpublished) session in club A
insert into public.sessions (
  id, club_id, name, status, format, matching_mode, is_public, created_by
) values (
  'c0000000-0000-4000-8000-000000000001',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'Private Friday Session',
  'draft',
  'doubles',
  'balanced',
  false,
  '11111111-1111-4111-8111-111111111111'
);

-- A second draft session, left empty, for the roster relationship regression
-- block below. It stays in draft so courts are never created for it.
insert into public.sessions (
  id, club_id, name, status, format, matching_mode, is_public, created_by
) values (
  'c0000000-0000-4000-8000-000000000009',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'Roster Regression Session',
  'draft',
  'doubles',
  'balanced',
  false,
  '11111111-1111-4111-8111-111111111111'
);

do $$
begin
  perform pg_temp.pb_assert(
    (select count(*) from public.courts
      where session_id = 'c0000000-0000-4000-8000-000000000001') = 0,
    'courts are created when the session starts, not at creation'
  );
end $$;

-- Check in four players, then start the session.
--
-- Order matters twice over: start_session requires players to already be
-- checked in, and every RPC re-checks authorization with private.is_club_admin(),
-- so auth.uid() must be populated first. The fixtures above were inserted
-- directly as the table owner to bypass RLS, but these calls go through the
-- RPCs, so they need the owner identity.
set local request.jwt.claims = '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}';

do $$
declare
  v_court uuid;
begin
  perform pg_temp.pb_assert(
    public.check_in_player('c0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001') = 1,
    'first check-in takes queue position 1'
  );
  perform pg_temp.pb_assert(
    public.check_in_player('c0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000002') = 2,
    'second check-in takes queue position 2'
  );
  perform pg_temp.pb_assert(
    public.check_in_player('c0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000003') = 3,
    'third check-in takes queue position 3'
  );
  perform pg_temp.pb_assert(
    public.check_in_player('c0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000004') = 4,
    'fourth check-in takes queue position 4'
  );

  -- Two more players wait behind them while the first four are matched.
  perform pg_temp.pb_assert(
    public.check_in_player('c0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000005') = 5,
    'fifth check-in takes queue position 5'
  );
  perform pg_temp.pb_assert(
    public.check_in_player('c0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000006') = 6,
    'sixth check-in takes queue position 6'
  );

  perform public.start_session('c0000000-0000-4000-8000-000000000001');

  select id into v_court from public.courts
  where session_id = 'c0000000-0000-4000-8000-000000000001';

  perform pg_temp.pb_assert(v_court is not null, 'starting a session creates its courts');
end $$;

-- Stage a match and keep its id in a temp table. Plain SQL rather than psql
-- \gset / :'var' interpolation, so the same file runs through `psql -f` locally
-- and `supabase db query --linked` against the cloud project.
--
-- The suite reads the id back after switching roles, so the temp table needs
-- explicit grants: a temp table is owned by the creating role and is otherwise
-- invisible to anon/authenticated.
create temporary table pb_match on commit drop as
select public.stage_match(
  'c0000000-0000-4000-8000-000000000001',
  (select id from public.courts where session_id = 'c0000000-0000-4000-8000-000000000001' limit 1),
  array[
    'a0000000-0000-4000-8000-000000000001',
    'a0000000-0000-4000-8000-000000000002',
    'a0000000-0000-4000-8000-000000000003',
    'a0000000-0000-4000-8000-000000000004'
  ]::uuid[],
  array[1, 1, 2, 2]::smallint[],
  'verification fixture',
  'fifo'
) as id;

grant select on pg_temp.pb_match to anon, authenticated;

select public.start_match((select id from pb_match));

-- ===========================================================================
-- 1. Anonymous visitors
-- ===========================================================================
set local role anon;
select set_config('request.jwt.claims', '{"sub":"44444444-4444-4444-8444-444444444444","role":"anon"}', true);

do $$
begin
  perform pg_temp.pb_assert(
    (select count(*) from public.clubs where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa') = 0,
    'anon cannot read a private (unpublished) club'
  );
  perform pg_temp.pb_assert(
    (select count(*) from public.clubs where id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb') = 1,
    'anon can read a published club'
  );
  perform pg_temp.pb_assert(
    (select count(*) from public.sessions where id = 'c0000000-0000-4000-8000-000000000009') = 0,
    'anon cannot read a private draft session'
  );
  perform pg_temp.pb_assert(
    (select count(*) from public.public_live_sessions) = 0,
    'anon sees no unpublished session in the public view'
  );
end $$;

-- the information_schema trick: confirm the anon role has no grant at all on
-- private tables, even though RLS would also block it
do $$
begin
  perform pg_temp.pb_assert(
    has_table_privilege('anon', 'public.profiles', 'select') = false,
    'anon has no SELECT grant on profiles'
  );
  perform pg_temp.pb_assert(
    has_table_privilege('anon', 'public.club_members', 'select') = false,
    'anon has no SELECT grant on club_members'
  );
  perform pg_temp.pb_assert(
    has_table_privilege('anon', 'public.queue_events', 'select') = false,
    'anon has no SELECT grant on queue_events'
  );
  perform pg_temp.pb_assert(
    has_table_privilege('anon', 'public.score_audit_log', 'select') = false,
    'anon has no SELECT grant on score_audit_log'
  );
end $$;

reset role;

-- ===========================================================================
-- 2. Outsigned signed-in user (not a member of club A)
-- ===========================================================================
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"44444444-4444-4444-8444-444444444444","role":"authenticated"}', true);

do $$
begin
  perform pg_temp.pb_assert(
    (select count(*) from public.clubs where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa') = 0,
    'a non-member cannot read a private club'
  );
  perform pg_temp.pb_assert(
    (select count(*) from public.players where club_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa') = 0,
    'a non-member cannot read a private club roster'
  );
  perform pg_temp.pb_assert(
    (select count(*) from public.sessions where id = 'c0000000-0000-4000-8000-000000000009') = 0,
    'a non-member cannot read a private draft session'
  );
end $$;

-- must not be able to write at all
do $$
declare
  v_raised boolean := false;
begin
  v_raised := false;
  begin
    insert into public.players (club_id, display_name, skill_level)
    values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Injected', 3);
  exception when others then
    v_raised := true;
  end;
  perform pg_temp.pb_assert(v_raised, 'a non-member cannot insert a roster player');
end $$;

do $$
declare
  v_raised boolean := false;
begin
  v_raised := false;
  begin
    update public.matches
    set team1_score = 99
    where id = (select id from pb_match);
  exception when others then
    v_raised := true;
  end;
  perform pg_temp.pb_assert(v_raised, 'a non-member cannot write a score');
end $$;

-- ===========================================================================
-- 3. Plain player of club A: reads own club, cannot promote self, cannot score
-- ===========================================================================
select set_config('request.jwt.claims', '{"sub":"33333333-3333-4333-8333-333333333333","role":"authenticated"}', true);

do $$
begin
  perform pg_temp.pb_assert(
    (select count(*) from public.clubs where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa') = 1,
    'a member can read their own club'
  );
  perform pg_temp.pb_assert(
    (select count(*) from public.club_members where club_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb') = 0,
    'a member of club A cannot list club B members'
  );
end $$;

do $$
declare
  v_raised boolean := false;
begin
  v_raised := false;
  begin
    update public.club_members set role = 'owner'
    where club_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
      and user_id = '33333333-3333-4333-8333-333333333333';
  exception when others then
    v_raised := true;
  end;
  perform pg_temp.pb_assert(v_raised, 'a player cannot promote themselves');

  v_raised := false;
  begin
    perform public.set_club_member_role(
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      '33333333-3333-4333-8333-333333333333',
      'admin'
    );
  exception when others then
    v_raised := true;
  end;
  perform pg_temp.pb_assert(v_raised, 'a player cannot change their own role via RPC');
end $$;

do $$
declare
  v_raised boolean := false;
begin
  v_raised := false;
  begin
    perform public.complete_match((select id from pb_match), 11, 9);
  exception when others then
    v_raised := true;
  end;
  perform pg_temp.pb_assert(v_raised, 'a player cannot record a score');
end $$;

do $$
declare
  v_raised boolean := false;
begin
  v_raised := false;
  begin
    update public.session_players
    set attendance_status = 'checked_out'
    where session_id = 'c0000000-0000-4000-8000-000000000001'
      and player_id = 'a0000000-0000-4000-8000-000000000002';
  exception when others then
    v_raised := true;
  end;
  perform pg_temp.pb_assert(v_raised, 'a player cannot move another player in the queue');
end $$;

-- ===========================================================================
-- 4. Admin of club B must not touch club A
-- ===========================================================================
select set_config('request.jwt.claims', '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated"}', true);

do $$
declare
  v_raised boolean := false;
begin
  perform pg_temp.pb_assert(
    (select count(*) from public.sessions where id = 'c0000000-0000-4000-8000-000000000009') = 0,
    'an admin of club B cannot read club A private drafts'
  );

  v_raised := false;
  begin
    perform public.complete_match((select id from pb_match), 11, 9);
  exception when others then
    v_raised := true;
  end;
  perform pg_temp.pb_assert(v_raised, 'an admin of club B cannot score in club A');

  v_raised := false;
  begin
    perform public.check_in_player(
      'c0000000-0000-4000-8000-000000000001',
      'a0000000-0000-4000-8000-000000000004'
    );
  exception when others then
    v_raised := true;
  end;
  perform pg_temp.pb_assert(v_raised, 'an admin of club B cannot mutate club A sessions');

  v_raised := false;
  begin
    perform public.create_player(
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Sneaky', 3, null, null
    );
  exception when others then
    v_raised := true;
  end;
  perform pg_temp.pb_assert(v_raised, 'an admin of club B cannot write the club A roster');
end $$;

-- ===========================================================================
-- 5. Organizer of club A runs their own session correctly
-- ===========================================================================
select set_config('request.jwt.claims', '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}', true);

do $$
begin
  perform pg_temp.pb_assert(
    (select count(*) from public.sessions where id = 'c0000000-0000-4000-8000-000000000001') = 1,
    'the organizer can read their own session'
  );

  perform public.complete_match((select id from pb_match), 11, 9);

  perform pg_temp.pb_assert(
    (select status from public.matches where id = (select id from pb_match)) = 'completed',
    'the organizer can complete their own match'
  );
  perform pg_temp.pb_assert(
    (select winning_team from public.matches where id = (select id from pb_match)) = 1,
    'the server derives the winning team from the score'
  );
  perform pg_temp.pb_assert(
    (select status from public.courts where session_id = 'c0000000-0000-4000-8000-000000000001') = 'available',
    'completing a match frees the court'
  );
  perform pg_temp.pb_assert(
    (select bool_and(attendance_status = 'waiting') from public.session_players
      where session_id = 'c0000000-0000-4000-8000-000000000001') = true,
    'completing a match returns every player to the queue'
  );
  perform pg_temp.pb_assert(
    (select min(queue_position) from public.session_players
      where session_id = 'c0000000-0000-4000-8000-000000000001'
        and attendance_status = 'waiting') = 5,
    'returning players join behind everyone already waiting'
  );
  perform pg_temp.pb_assert(
    (select games_played from public.session_players
      where session_id = 'c0000000-0000-4000-8000-000000000001'
        and player_id = 'a0000000-0000-4000-8000-000000000001') = 1,
    'the winner games_played is incremented once'
  );
  perform pg_temp.pb_assert(
    (select wins from public.session_players
      where session_id = 'c0000000-0000-4000-8000-000000000001'
        and player_id = 'a0000000-0000-4000-8000-000000000001') = 1,
    'the winner gets one win'
  );
  perform pg_temp.pb_assert(
    (select points_for from public.session_players
      where session_id = 'c0000000-0000-4000-8000-000000000001'
        and player_id = 'a0000000-0000-4000-8000-000000000001') = 11,
    'points for are recorded from the team score'
  );
  perform pg_temp.pb_assert(
    (select win_streak from public.session_players
      where session_id = 'c0000000-0000-4000-8000-000000000001'
        and player_id = 'a0000000-0000-4000-8000-000000000001') = 1,
    'win streak is set to 1 after a first win'
  );
end $$;

-- ===========================================================================
-- 6. Completing the same match twice must not double count
-- ===========================================================================
do $$
declare
  v_raised boolean := false;
begin
  v_raised := false;
  begin
    perform public.complete_match((select id from pb_match), 11, 4);
  exception when others then
    v_raised := true;
  end;
  perform pg_temp.pb_assert(v_raised, 'completing an already completed match is rejected');

  perform pg_temp.pb_assert(
    (select games_played from public.session_players
      where session_id = 'c0000000-0000-4000-8000-000000000001'
        and player_id = 'a0000000-0000-4000-8000-000000000001') = 1,
    'the rejected repeat did not double count games_played'
  );
  perform pg_temp.pb_assert(
    (select wins from public.session_players
      where session_id = 'c0000000-0000-4000-8000-000000000001'
        and player_id = 'a0000000-0000-4000-8000-000000000001') = 1,
    'the rejected repeat did not double count wins'
  );
  perform pg_temp.pb_assert(
    (select points_for from public.session_players
      where session_id = 'c0000000-0000-4000-8000-000000000001'
        and player_id = 'a0000000-0000-4000-8000-000000000001') = 11,
    'the rejected repeat did not double count points'
  );
end $$;

-- ===========================================================================
-- 7. Score validation and single-booking invariants
-- ===========================================================================
do $$
declare
  v_raised boolean := false;
begin
  -- invalid scores are rejected
  v_raised := false;
  begin
    perform public.correct_match_score(
      (select id from pb_match), 10, 8, 'too low to win'
    );
  exception when others then
    v_raised := true;
  end;
  perform pg_temp.pb_assert(v_raised, 'a score below the target is rejected');

  v_raised := false;
  begin
    perform public.correct_match_score(
      (select id from pb_match), 11, 10, 'win by one not allowed'
    );
  exception when others then
    v_raised := true;
  end;
  perform pg_temp.pb_assert(v_raised, 'win_by is enforced on correction');

  v_raised := false;
  begin
    perform public.correct_match_score(
      (select id from pb_match), 11, 11, 'tie not allowed'
    );
  exception when others then
    v_raised := true;
  end;
  perform pg_temp.pb_assert(v_raised, 'a tied score is rejected');

  -- a correction without a reason is rejected
  v_raised := false;
  begin
    perform public.correct_match_score((select id from pb_match), 11, 7, '');
  exception when others then
    v_raised := true;
  end;
  perform pg_temp.pb_assert(v_raised, 'a score correction requires a reason');

  -- a real correction flips the winner and is audited
  perform public.correct_match_score(
    (select id from pb_match), 9, 11, 'score was entered on the wrong team'
  );

  perform pg_temp.pb_assert(
    (select winning_team from public.matches where id = (select id from pb_match)) = 2,
    'a correction can flip the winning team'
  );
  perform pg_temp.pb_assert(
    (select count(*) from public.score_audit_log where match_id = (select id from pb_match)) = 1,
    'every correction writes an audit row'
  );
  -- The match was staged as team 1 = {one, two} and team 2 = {three, four},
  -- originally scored 11-9 for team 1. The correction to 9-11 hands the win to
  -- team 2, so three and four gain a win and one and two lose theirs.
  perform pg_temp.pb_assert(
    (select wins from public.session_players
      where session_id = 'c0000000-0000-4000-8000-000000000001'
        and player_id = 'a0000000-0000-4000-8000-000000000003') = 1,
    'a corrected winner gains the win instead of the old winner'
  );
  perform pg_temp.pb_assert(
    (select wins from public.session_players
      where session_id = 'c0000000-0000-4000-8000-000000000001'
        and player_id = 'a0000000-0000-4000-8000-000000000001') = 0,
    'a corrected loser loses the previously counted win'
  );
  perform pg_temp.pb_assert(
    (select points_against from public.session_players
      where session_id = 'c0000000-0000-4000-8000-000000000001'
        and player_id = 'a0000000-0000-4000-8000-000000000001') = 11,
    'a correction moves points against as well as points for'
  );
  perform pg_temp.pb_assert(
    (select points_for from public.session_players
      where session_id = 'c0000000-0000-4000-8000-000000000001'
        and player_id = 'a0000000-0000-4000-8000-000000000001') = 9,
    'a correction moves points for to the corrected team score'
  );
end $$;

do $$
declare
  v_court uuid;
  v_match uuid;
  v_raised boolean := false;
begin
  select id into v_court from public.courts
  where session_id = 'c0000000-0000-4000-8000-000000000001' limit 1;

  v_match := public.stage_match(
    'c0000000-0000-4000-8000-000000000001',
    v_court,
    array[
      'a0000000-0000-4000-8000-000000000001',
      'a0000000-0000-4000-8000-000000000002',
      'a0000000-0000-4000-8000-000000000003',
      'a0000000-0000-4000-8000-000000000004'
    ]::uuid[],
    array[1, 1, 2, 2]::smallint[],
    'second fixture',
    'fifo'
  );

  -- a second staged match for the same players must be impossible
  v_raised := false;
  begin
    perform public.stage_match(
      'c0000000-0000-4000-8000-000000000001',
      v_court,
      array[
        'a0000000-0000-4000-8000-000000000001',
        'a0000000-0000-4000-8000-000000000002',
        'a0000000-0000-4000-8000-000000000003',
        'a0000000-0000-4000-8000-000000000004'
      ]::uuid[],
      array[1, 1, 2, 2]::smallint[],
      'duplicate attempt',
      'fifo'
    );
  exception when others then
    v_raised := true;
  end;
  perform pg_temp.pb_assert(v_raised, 'a player cannot be staged in two matches');

  -- fewer eligible players than the format needs is rejected
  v_raised := false;
  begin
    perform public.stage_match(
      'c0000000-0000-4000-8000-000000000001',
      v_court,
      array[
        'a0000000-0000-4000-8000-000000000001',
        'a0000000-0000-4000-8000-000000000002'
      ]::uuid[],
      array[1, 2]::smallint[],
      'too few players',
      'fifo'
    );
  exception when others then
    v_raised := true;
  end;
  perform pg_temp.pb_assert(v_raised, 'staging fewer players than the format needs is rejected');
end $$;

-- ===========================================================================
-- 8. Queue events are append-only and audit rows are organizer-only
-- ===========================================================================
do $$
declare
  v_event bigint;
  v_raised boolean := false;
begin
  select id into v_event from public.queue_events order by id limit 1;

  v_raised := false;
  begin
    update public.queue_events set event_type = 'tampered' where id = v_event;
  exception when others then
    v_raised := true;
  end;
  perform pg_temp.pb_assert(v_raised, 'queue_events is append-only');

  v_raised := false;
  begin
    delete from public.queue_events where id = v_event;
  exception when others then
    v_raised := true;
  end;
  perform pg_temp.pb_assert(v_raised, 'queue_events cannot be deleted');
end $$;

-- ===========================================================================
-- 8b. Roster relationship: players.id, not the session_players row id
-- ===========================================================================
-- Regression cover for the bug where the session screen sent
-- session_players.id where check_in_player expected players.id. The database
-- answered "That player is not on this club roster" even though every row was
-- valid, which made a correct roster look broken.
--
-- These assertions run as the club owner of club A, who administers both the
-- session and the players involved.
reset role;

set local request.jwt.claims = '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}';

do $$
declare
  v_session constant uuid := 'c0000000-0000-4000-8000-000000000009';
  v_club_player constant uuid := 'a0000000-0000-4000-8000-000000000001';
  v_other_club_player constant uuid := 'a0000000-0000-4000-8000-0000000000b1';
  v_sp_id uuid;
  v_status public.attendance_status;
  v_raised boolean := false;
begin
  -- Adding a player of the owning club succeeds.
  perform pg_temp.pb_assert(
    public.add_session_players(v_session, array[v_club_player]) = 1,
    'a same-club roster player can be added to a draft session'
  );

  -- Adding is not check-in: the row starts checked out with no queue slot.
  select id, attendance_status into v_sp_id, v_status
  from public.session_players
  where session_id = v_session and player_id = v_club_player;

  perform pg_temp.pb_assert(
    v_sp_id is not null and v_status = 'checked_out',
    'an added player appears as not checked in'
  );

  perform pg_temp.pb_assert(
    (select queue_position from public.session_players where id = v_sp_id) is null,
    'an added player has no queue position until they check in'
  );

  -- The session_players row id is a different value from players.id. Passing
  -- it to an attendance RPC is the exact defect, so pin it down.
  perform pg_temp.pb_assert(
    v_sp_id <> v_club_player,
    'the session_players row id differs from the player id'
  );

  v_raised := false;
  begin
    perform public.check_in_player(v_session, v_sp_id);
  exception when others then
    v_raised := true;
  end;
  perform pg_temp.pb_assert(v_raised, 'check-in with the session_players row id is rejected, not silently accepted');

  -- The real player id checks in and moves to waiting.
  perform pg_temp.pb_assert(
    public.check_in_player(v_session, v_club_player) = 1,
    'an organizer can check a same-club player in by players.id'
  );

  select attendance_status into v_status
  from public.session_players
  where session_id = v_session and player_id = v_club_player;

  perform pg_temp.pb_assert(
    v_status = 'waiting',
    'a checked-in player changes to waiting'
  );

  perform pg_temp.pb_assert(
    (select queue_position from public.session_players
      where session_id = v_session and player_id = v_club_player) = 1,
    'a checked-in player is given queue position 1'
  );

  -- Cross-club ids are refused for the whole batch, not quietly dropped.
  v_raised := false;
  begin
    perform public.add_session_players(v_session, array[v_other_club_player]);
  exception when others then
    v_raised := true;
  end;
  perform pg_temp.pb_assert(v_raised, 'a cross-club player is rejected');

  perform pg_temp.pb_assert(
    not exists (
      select 1 from public.session_players
      where session_id = v_session and player_id = v_other_club_player
    ),
    'the rejected cross-club player was not added'
  );

  -- A bad id in the batch must not let the good ones through either.
  v_raised := false;
  begin
    perform public.add_session_players(
      v_session,
      array['a0000000-0000-4000-8000-000000000005', v_other_club_player]
    );
  exception when others then
    v_raised := true;
  end;
  perform pg_temp.pb_assert(v_raised, 'a batch containing a cross-club player is rejected');

  perform pg_temp.pb_assert(
    not exists (
      select 1 from public.session_players
      where session_id = v_session
        and player_id = 'a0000000-0000-4000-8000-000000000005'
    ),
    'a rejected batch adds none of its players'
  );
end $$;

-- ===========================================================================
-- 9. Published data is sanitized
-- ===========================================================================
reset role;

update public.sessions set is_public = true, results_published = true
where id = 'c0000000-0000-4000-8000-000000000001';

update public.clubs set is_public = true
where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

set local role anon;
select set_config('request.jwt.claims', '{"sub":"44444444-4444-4444-8444-444444444444","role":"anon"}', true);

do $$
begin
  perform pg_temp.pb_assert(
    (select count(*) from public.public_live_sessions) = 1,
    'a published session appears in the public view'
  );
  -- Six players checked in for this session and only the first four have a
  -- completed match, so the board carries six rows: the two who have not played
  -- yet are exactly the rows the old completed-matches-only view dropped.
  perform pg_temp.pb_assert(
    (select count(*) from public.public_session_standings where session_id = 'c0000000-0000-4000-8000-000000000001') = 6,
    'the public standings view shows one row per arrived player, played or not'
  );
  perform pg_temp.pb_assert(
    (select count(*) from public.public_session_standings
      where session_id = 'c0000000-0000-4000-8000-000000000001'
        and games_played = 0) = 2,
    'the public standings view keeps the arrived players who have not played'
  );
end $$;

-- no public read model may expose an auth id or an email
do $$
declare
  v_cols text;
begin
  select string_agg(column_name, ',') into v_cols
  from information_schema.columns
  where table_schema = 'public'
    and table_name in (
      'public_clubs', 'public_live_sessions', 'public_match_results',
      'public_session_standings', 'public_live_courts', 'public_match_lineups',
      'public_session_queue'
    )
    and column_name in ('user_id', 'created_by', 'email', 'actor_id', 'encrypted_password');

  perform pg_temp.pb_assert(
    v_cols is null,
    'public views expose no auth id, email, or audit actor column'
  );
end $$;

-- Realtime consumes base tables, so their column grants must be as narrow as
-- the views. RLS alone filters rows, not columns in an allowed row.
do $$
begin
  perform pg_temp.pb_assert(
    not has_column_privilege('anon', 'public.clubs', 'created_by', 'select'),
    'anon cannot read a club creator id from the Realtime base table'
  );
  perform pg_temp.pb_assert(
    not has_column_privilege('anon', 'public.session_players', 'player_id', 'select'),
    'anon cannot read player ids from session presence changes'
  );
  perform pg_temp.pb_assert(
    not has_column_privilege('anon', 'public.match_players', 'player_id', 'select'),
    'anon cannot read player ids from lineup changes'
  );
  perform pg_temp.pb_assert(
    not has_column_privilege('anon', 'public.sessions', 'public_live_token', 'select'),
    'anon cannot list Player Live View capability tokens from sessions'
  );
  perform pg_temp.pb_assert(
    has_column_privilege('anon', 'public.session_players', 'session_id', 'select')
      and has_column_privilege('anon', 'public.matches', 'session_id', 'select'),
    'anon retains only the session columns needed to scope Realtime changes'
  );
end $$;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    perform pg_temp.pb_assert(
      exists (
        select 1
        from pg_publication_tables
        where pubname = 'supabase_realtime'
          and schemaname = 'public'
          and tablename = 'sessions'
      ),
      'session lifecycle changes are in the Realtime publication'
    );
  end if;
end $$;

-- ===========================================================================
-- 10. Live board: standings include arrived players with zero games
-- ===========================================================================
-- Regression cover for the live board rendering nothing until the first match
-- was scored. public_session_standings used to aggregate public_match_results,
-- which only holds a row per player per *completed* match, so every arrived
-- player vanished until they had a result. The views now start from
-- session_players and left join the completed-match totals.
--
-- Section 9 already published club A and the original session, so a session
-- created here is publishable and can be checked through the anon role too.
-- Section 9 left the session reading as anon, so drop back to the owner first.
reset role;

select set_config('request.jwt.claims', '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}', true);

insert into public.sessions (
  id, club_id, name, status, format, matching_mode, court_count, is_public, created_by
) values (
  'd0000000-0000-4000-8000-000000000001',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'Live Board Session',
  'draft',
  'doubles',
  'balanced',
  2,
  true,
  '11111111-1111-4111-8111-111111111111'
);

-- Five will check in; one is deliberately left checked out.
insert into public.session_players (session_id, player_id) values
  ('d0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000005'),
  ('d0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000006'),
  ('d0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000007'),
  ('d0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000008'),
  ('d0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000009'),
  ('d0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-00000000000a');

do $$
declare
  v_court uuid;
  v_match uuid;
  v_raised boolean := false;
  v_public_token uuid;
begin
  -- Starting with nobody checked in is refused. This is the guard that made the
  -- live board look broken: if check-in is broken, Start Session fails and the
  -- session stays a draft forever with no courts and no board.
  v_raised := false;
  begin
    perform public.start_session('d0000000-0000-4000-8000-000000000001');
  exception when others then
    v_raised := true;
  end;
  perform pg_temp.pb_assert(
    v_raised,
    'starting a session with nobody checked in is rejected'
  );
  perform pg_temp.pb_assert(
    (select status from public.sessions where id = 'd0000000-0000-4000-8000-000000000001') = 'draft',
    'a refused start leaves the session in draft'
  );
  perform pg_temp.pb_assert(
    (select public_live_token is null and not player_live_enabled
      from public.sessions where id = 'd0000000-0000-4000-8000-000000000001'),
    'a draft session has no active Player Live View token'
  );

  -- Player six never checks in, which is what proves the board shows arrived
  -- players only.
  perform public.check_in_player('d0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000005');
  perform public.check_in_player('d0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000007');
  perform public.check_in_player('d0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000008');
  perform public.check_in_player('d0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000009');
  perform public.check_in_player('d0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-00000000000a');

  perform public.start_session('d0000000-0000-4000-8000-000000000001');

  perform pg_temp.pb_assert(
    (select status from public.sessions where id = 'd0000000-0000-4000-8000-000000000001') = 'active',
    'start_session moves a draft session to active'
  );
  select public_live_token into v_public_token
  from public.sessions where id = 'd0000000-0000-4000-8000-000000000001';
  perform pg_temp.pb_assert(
    v_public_token is not null
      and (select player_live_enabled from public.sessions
        where id = 'd0000000-0000-4000-8000-000000000001'),
    'starting a session atomically creates and enables a Player Live View token'
  );

  -- A duplicate form submission is idempotent and returns the same capability.
  perform public.start_session('d0000000-0000-4000-8000-000000000001');
  perform pg_temp.pb_assert(
    (select public_live_token from public.sessions
      where id = 'd0000000-0000-4000-8000-000000000001') = v_public_token,
    'repeating Start does not rotate the Player Live View token'
  );
  perform pg_temp.pb_assert(
    (public.get_player_live_board(v_public_token) -> 'session' ->> 'name') = 'Live Board Session',
    'a valid token resolves the sanitized Player Live View without a login'
  );
  perform pg_temp.pb_assert(
    public.get_player_live_board(extensions.gen_random_uuid()) is null,
    'an invalid token resolves no Player Live View data'
  );
  perform pg_temp.pb_assert(
    public.get_player_live_board(v_public_token)::text not like '%public_live_token%'
      and public.get_player_live_board(v_public_token)::text not like '%created_by%'
      and public.get_player_live_board(v_public_token)::text not like '%user_id%'
      and public.get_player_live_board(v_public_token)::text not like '%email%',
    'the token-scoped payload contains no token, auth id, creator, or email field'
  );

  -- Starting a session must only flip the status and make the courts. It must
  -- not start anyone's game: that stays an organizer-controlled action.
  perform pg_temp.pb_assert(
    (select count(*) from public.matches where session_id = 'd0000000-0000-4000-8000-000000000001') = 0,
    'starting a session does not start a match'
  );
  perform pg_temp.pb_assert(
    (select count(*) from public.courts where session_id = 'd0000000-0000-4000-8000-000000000001') = 2,
    'starting a session creates the courts'
  );
  perform pg_temp.pb_assert(
    (select bool_and(attendance_status = 'waiting') from public.session_players
      where session_id = 'd0000000-0000-4000-8000-000000000001'
        and attendance_status <> 'checked_out') = true,
    'starting a session leaves every checked-in player waiting rather than playing'
  );
  perform pg_temp.pb_assert(
    (select count(*) from public.session_players
      where session_id = 'd0000000-0000-4000-8000-000000000001'
        and attendance_status = 'checked_out') = 1,
    'starting a session does not check anyone in'
  );

  -- (1) Four checked-in players, zero completed matches: every one of them is
  -- a real row of zeroes rather than a missing row.
  perform pg_temp.pb_assert(
    (select count(*) from public.session_standings
      where session_id = 'd0000000-0000-4000-8000-000000000001') = 5,
    'arrived players appear in standings before any match is completed'
  );

  perform pg_temp.pb_assert(
    (select count(*) from public.session_standings
      where session_id = 'd0000000-0000-4000-8000-000000000001'
        and games_played = 0
        and wins = 0
        and losses = 0
        and points_for = 0
        and points_against = 0) = 5,
    'every arrived player has zero stats before the first match'
  );

  -- The public board starts from the full roster, so the five arrived players
  -- plus the one not-yet-arrived player are all real zero-stat rows.
  perform pg_temp.pb_assert(
    (select count(*) from public.public_session_standings
      where session_id = 'd0000000-0000-4000-8000-000000000001') = 6,
    'the public standings view returns every rostered player for a freshly started session'
  );

  -- (2) One completed doubles match updates exactly those four players.
  select id into v_court
  from public.courts
  where session_id = 'd0000000-0000-4000-8000-000000000001'
  order by court_number
  limit 1;

  v_match := public.stage_match(
    'd0000000-0000-4000-8000-000000000001',
    v_court,
    array[
      'a0000000-0000-4000-8000-000000000007',
      'a0000000-0000-4000-8000-000000000008',
      'a0000000-0000-4000-8000-000000000009',
      'a0000000-0000-4000-8000-00000000000a'
    ]::uuid[],
    array[1, 1, 2, 2]::smallint[],
    'first game of the night',
    'fifo'
  );

  -- Staged is not playing: the score is refused until the match is started.
  perform pg_temp.pb_assert(
    (select status from public.matches where id = v_match) = 'staged',
    'a freshly staged match is staged, not playing'
  );

  v_raised := false;
  begin
    perform public.complete_match(v_match, 11, 9);
  exception when others then
    v_raised := true;
  end;
  perform pg_temp.pb_assert(
    v_raised,
    'a score cannot be recorded before the match is started'
  );

  perform public.start_match(v_match);
  perform public.complete_match(v_match, 11, 9);

  perform pg_temp.pb_assert(
    (select count(*) from public.session_standings
      where session_id = 'd0000000-0000-4000-8000-000000000001'
        and games_played = 1) = 4,
    'exactly the four players in the completed match get a game played'
  );

  perform pg_temp.pb_assert(
    (select count(*) from public.session_standings
      where session_id = 'd0000000-0000-4000-8000-000000000001'
        and wins = 1 and losses = 0) = 2,
    'the winning side is credited two wins'
  );

  perform pg_temp.pb_assert(
    (select count(*) from public.session_standings
      where session_id = 'd0000000-0000-4000-8000-000000000001'
        and wins = 0 and losses = 1) = 2,
    'the losing side is credited two losses'
  );

  perform pg_temp.pb_assert(
    (select count(*) from public.session_standings
      where session_id = 'd0000000-0000-4000-8000-000000000001'
        and games_played = 1
        and ((points_for = 11 and points_against = 9) or (points_for = 9 and points_against = 11))
    ) = 4,
    'points for and against are recorded per player'
  );

  -- (3) The waiting player who has not played is still on the board.
  perform pg_temp.pb_assert(
    (select games_played from public.session_standings
      where session_id = 'd0000000-0000-4000-8000-000000000001'
        and player_id = 'a0000000-0000-4000-8000-000000000005') = 0,
    'a waiting player who has not played still shows zero games'
  );

  perform pg_temp.pb_assert(
    (select count(*) from public.public_session_standings
      where session_id = 'd0000000-0000-4000-8000-000000000001'
        and player_id = 'a0000000-0000-4000-8000-000000000005') = 1,
    'the public board keeps the unplayed waiting player too'
  );

  -- The player who never checked in is left off the board entirely.
  perform pg_temp.pb_assert(
    (select count(*) from public.session_standings
      where session_id = 'd0000000-0000-4000-8000-000000000001'
        and player_id = 'a0000000-0000-4000-8000-000000000006') = 0,
    'a player who never arrived is left off the standings'
  );

  -- Completing a match returns players to the queue, so the public waiting
  -- queue view has rows to show.
  perform pg_temp.pb_assert(
    (select count(*) from public.public_session_queue
      where session_id = 'd0000000-0000-4000-8000-000000000001') = 5,
    'the public waiting queue lists everyone back in the queue'
  );
end $$;

-- ===========================================================================
-- 10a. Public rows carry a stable list key
-- ===========================================================================
-- The public board used (court_number, team_number, slot_number) and display_name
-- as React keys. The first is the tuple that collided, and the second is not
-- unique: two players on a club can share a display name. Both views now expose
-- a surrogate row id instead.
do $$
declare
  v_lineups uuid;
  v_queue uuid;
begin
  perform pg_temp.pb_assert(
    (select count(*) from information_schema.columns
      where table_schema = 'public' and table_name = 'public_match_lineups'
        and column_name = 'lineup_id') = 1,
    'public_match_lineups exposes a lineup_id for list keys'
  );

  perform pg_temp.pb_assert(
    (select count(*) from information_schema.columns
      where table_schema = 'public' and table_name = 'public_session_queue'
        and column_name = 'queue_entry_id') = 1,
    'public_session_queue exposes a queue_entry_id for list keys'
  );

  -- A surrogate key, not a reference to a person. The lineup id must not equal
  -- any player id or user id in the same session, so a spectator holding it
  -- learns nothing about who is on court.
  perform pg_temp.pb_assert(
    (select count(*) from public.public_match_lineups l
      join public.players p on p.id = l.lineup_id
      join public.profiles pr on pr.id = l.lineup_id) = 0,
    'lineup_id resolves to neither a player nor a profile'
  );

  -- Every lineup row must carry a non-null key, or the public board renders a
  -- list with undefined keys again.
  perform pg_temp.pb_assert(
    (select count(*) from public.public_match_lineups where lineup_id is null) = 0,
    'every public lineup row has a lineup_id'
  );

  perform pg_temp.pb_assert(
    (select count(*) from public.public_session_queue where queue_entry_id is null) = 0,
    'every public queue row has a queue_entry_id'
  );
end $$;

-- ===========================================================================
-- 10b. One player per team slot
-- ===========================================================================
-- Regression cover for the duplicate React keys `1-1` and `2-2`. stage_match used
-- to derive the slot from the player's position in the whole incoming array:
--
--   ((sel.ord - 1) % 2) + 1
--
-- toProposalPlayers() hands the RPC an array whose teams are interleaved, so
-- both of team 1's players were stored in slot 1 and both of team 2's in slot 2.
-- Every list keyed on (team_number, slot_number) then rendered two children with
-- the same key, and the board showed a player sitting in both slots.
--
-- The fixture below stages deliberately interleaved, which is the real input
-- shape. Ordering the array by team instead would have hidden the bug rather
-- than fixed it.
reset role;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}', true);

insert into public.sessions (
  id, club_id, name, status, format, matching_mode, court_count, is_public, created_by
) values (
  'e0000000-0000-4000-8000-000000000001',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'Slot Collision Session',
  'draft',
  'doubles',
  'balanced',
  2,
  true,
  '11111111-1111-4111-8111-111111111111'
);

insert into public.session_players (session_id, player_id) values
  ('e0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000007'),
  ('e0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000008'),
  ('e0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000009'),
  ('e0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-00000000000a');

do $$
declare
  v_court uuid;
  v_match uuid;
  v_collisions integer;
  v_raised boolean := false;
begin
  perform public.check_in_player('e0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000007');
  perform public.check_in_player('e0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000008');
  perform public.check_in_player('e0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000009');
  perform public.check_in_player('e0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-00000000000a');
  perform public.start_session('e0000000-0000-4000-8000-000000000001');

  select id into v_court from public.courts
  where session_id = 'e0000000-0000-4000-8000-000000000001'
  order by court_number limit 1;

  -- Interleaved on purpose: team 1, team 2, team 1, team 2.
  v_match := public.stage_match(
    'e0000000-0000-4000-8000-000000000001',
    v_court,
    array[
      'a0000000-0000-4000-8000-000000000007',
      'a0000000-0000-4000-8000-000000000008',
      'a0000000-0000-4000-8000-000000000009',
      'a0000000-0000-4000-8000-00000000000a'
    ]::uuid[],
    array[1, 2, 1, 2]::smallint[],
    'interleaved teams',
    'fifo'
  );

  select count(*) into v_collisions
  from (
    select mp.team_number, mp.slot_number
    from public.match_players mp
    where mp.match_id = v_match
    group by mp.team_number, mp.slot_number
    having count(*) > 1
  ) t;

  perform pg_temp.pb_assert(
    v_collisions = 0,
    'an interleaved stage_match does not put two players in one slot'
  );

  perform pg_temp.pb_assert(
    (select count(distinct slot_number) from public.match_players
      where match_id = v_match and team_number = 1) = 2,
    'each team gets one slot 1 and one slot 2'
  );
  perform pg_temp.pb_assert(
    (select count(distinct slot_number) from public.match_players
      where match_id = v_match and team_number = 2) = 2,
    'the other team gets one slot 1 and one slot 2'
  );
  perform pg_temp.pb_assert(
    (select count(*) from public.match_players where match_id = v_match) = 4,
    'all four players are still on the match'
  );

  -- The database, not just the RPC, refuses a double-occupied slot.
  v_raised := false;
  begin
    insert into public.match_players (
      match_id, player_id, session_id, team_number, slot_number, skill_snapshot
    )
    select v_match, 'a0000000-0000-4000-8000-000000000005',
      'e0000000-0000-4000-8000-000000000001', team_number, slot_number, 3
    from public.match_players
    where match_id = v_match and team_number = 1 and slot_number = 1
    limit 1;
  exception when others then
    v_raised := true;
  end;
  perform pg_temp.pb_assert(
    v_raised,
    'two players cannot share a team slot'
  );
end $$;

-- No match anywhere may hold two players in one slot, including pre-existing rows.
do $$
begin
  perform pg_temp.pb_assert(
    (select count(*) from (
      select match_id, team_number, slot_number
      from public.match_players
      group by match_id, team_number, slot_number
      having count(*) > 1
    ) t) = 0,
    'no match holds two players in the same team slot'
  );
end $$;

-- ===========================================================================
-- 10c. Game clock timestamps are server-owned and monotonic
-- ===========================================================================
-- The elapsed timer computes its value as now() - started_at on the client. That
-- is only honest if two things hold in the database: started_at is written by the
-- server rather than the caller, and completed_at can never land before it.
--
-- The idempotency half matters for correctness, not just tidiness. start_match is
-- retried freely -- realtime subscriptions reconnect, and the organizer screen can
-- double-submit -- and a naive `started_at = now()` on every call would silently
-- restart the clock of a game already in progress. The migration makes the write
-- conditional so the first start wins.
reset role;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}', true);

insert into public.sessions (
  id, club_id, name, status, format, matching_mode, court_count, is_public, created_by
) values (
  'e0000000-0000-4000-8000-000000000002',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'Clock Session',
  'draft',
  'doubles',
  'balanced',
  1,
  true,
  '11111111-1111-4111-8111-111111111111'
);

-- Four fresh players. Section 10b left its four players on an unresolved match,
-- and match_players_one_unresolved_per_player is global per player rather than
-- per session, so reusing them here would violate that index instead of
-- exercising the clock.
insert into public.players (id, club_id, display_name, skill_level) values
  ('a0000000-0000-4000-8000-0000000000c1', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Clock Player One', 3),
  ('a0000000-0000-4000-8000-0000000000c2', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Clock Player Two', 3),
  ('a0000000-0000-4000-8000-0000000000c3', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Clock Player Three', 3),
  ('a0000000-0000-4000-8000-0000000000c4', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Clock Player Four', 3);

insert into public.session_players (session_id, player_id) values
  ('e0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-0000000000c1'),
  ('e0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-0000000000c2'),
  ('e0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-0000000000c3'),
  ('e0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-0000000000c4');

do $$
declare
  v_court uuid;
  v_match uuid;
  v_started_at timestamptz;
  v_raised boolean;
begin
  perform public.check_in_player('e0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-0000000000c1');
  perform public.check_in_player('e0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-0000000000c2');
  perform public.check_in_player('e0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-0000000000c3');
  perform public.check_in_player('e0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-0000000000c4');
  perform public.start_session('e0000000-0000-4000-8000-000000000002');

  select id into v_court from public.courts
  where session_id = 'e0000000-0000-4000-8000-000000000002'
  order by court_number limit 1;

  v_match := public.stage_match(
    'e0000000-0000-4000-8000-000000000002',
    v_court,
    array[
      'a0000000-0000-4000-8000-0000000000c1',
      'a0000000-0000-4000-8000-0000000000c2',
      'a0000000-0000-4000-8000-0000000000c3',
      'a0000000-0000-4000-8000-0000000000c4'
    ]::uuid[],
    array[1, 2, 1, 2]::smallint[],
    'clock fixture',
    'fifo'
  );

  -- A staged match has no start time yet, which is what makes it safe to show
  -- nothing rather than a misleading zero.
  perform pg_temp.pb_assert(
    (select started_at is null from public.matches where id = v_match),
    'a staged match has no started_at'
  );

  perform public.start_match(v_match);

  select started_at into v_started_at from public.matches where id = v_match;

  perform pg_temp.pb_assert(
    v_started_at is not null,
    'starting a match stamps started_at from the server'
  );
  perform pg_temp.pb_assert(
    v_started_at <= now() and v_started_at > now() - interval '1 minute',
    'started_at is the server now, not a client-supplied value'
  );

  -- Replay the start the way a reconnecting subscription would. The clock must
  -- survive: a second call is a no-op, not a reset.
  perform pg_catalog.pg_sleep(0.05);
  perform public.start_match(v_match);

  perform pg_temp.pb_assert(
    (select started_at from public.matches where id = v_match) = v_started_at,
    'starting an already-playing match does not move started_at'
  );

  perform public.set_running_score(v_match, 7, 5);
  perform pg_temp.pb_assert(
    (select team1_score = 7 and team2_score = 5
      from public.matches where id = v_match),
    'an organizer can persist a running score without completing the match'
  );
  perform pg_temp.pb_assert(
    (select team1_score = 7 and team2_score = 5
      from public.public_live_courts
      where session_id = 'e0000000-0000-4000-8000-000000000002'
        and court_number = 1),
    'the sanitized public court view exposes the running score'
  );

  -- A legal winning score must go through complete_match so standings and the
  -- queue are updated atomically; set_running_score refuses it.
  v_raised := false;
  begin
    perform public.set_running_score(v_match, 11, 7);
  exception when others then
    v_raised := true;
  end;
  perform pg_temp.pb_assert(
    v_raised,
    'a final score cannot bypass complete_match through the running-score RPC'
  );

  perform set_config(
    'request.jwt.claims',
    '{"sub":"44444444-4444-4444-8444-444444444444","role":"authenticated"}',
    true
  );
  v_raised := false;
  begin
    perform public.set_running_score(v_match, 8, 5);
  exception when others then
    v_raised := true;
  end;
  perform pg_temp.pb_assert(
    v_raised,
    'a non-organizer cannot change a running score'
  );
  perform set_config(
    'request.jwt.claims',
    '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}',
    true
  );

  perform public.complete_match(v_match, 11, 7);

  perform pg_temp.pb_assert(
    (select completed_at >= started_at from public.matches where id = v_match),
    'completing a match never puts completed_at before started_at'
  );

  -- A duplicate completion must not bank a second game for the players, which
  -- would inflate games_played and hand out a podium five games early. Doubles
  -- means the two players on the winning team each bank a win, so the expected
  -- total is 2, not 1.
  perform pg_temp.pb_assert(
    (select sum(wins) from public.session_standings
      where session_id = 'e0000000-0000-4000-8000-000000000002') = 2,
    'completing once credits one win per player on the winning team'
  );
  perform pg_temp.pb_assert(
    (select sum(games_played) from public.session_standings
      where session_id = 'e0000000-0000-4000-8000-000000000002') = 4,
    'completing once credits one game to each of the four players'
  );
  perform pg_temp.pb_assert(
    (select completed_match_count = 1
      from public.public_live_sessions
      where id = 'e0000000-0000-4000-8000-000000000002'),
    'the public session header exposes an aggregate completed-match count'
  );

  v_raised := false;
  begin
    perform public.complete_match(v_match, 11, 7);
  exception when others then
    v_raised := true;
  end;
  perform pg_temp.pb_assert(
    v_raised,
    'completing an already-completed match is rejected'
  );
  perform pg_temp.pb_assert(
    (select sum(wins) from public.session_standings
      where session_id = 'e0000000-0000-4000-8000-000000000002') = 2,
    'the rejected duplicate did not credit a second win'
  );
  perform pg_temp.pb_assert(
    (select sum(games_played) from public.session_standings
      where session_id = 'e0000000-0000-4000-8000-000000000002') = 4,
    'the rejected duplicate did not credit a second game'
  );

  perform public.end_session('e0000000-0000-4000-8000-000000000002');
  perform pg_temp.pb_assert(
    (select status = 'completed' and results_published
      from public.sessions
      where id = 'e0000000-0000-4000-8000-000000000002'),
    'ending a public session keeps its final results published'
  );
  perform pg_temp.pb_assert(
    (select status = 'completed'
      from public.public_live_sessions
      where id = 'e0000000-0000-4000-8000-000000000002'),
    'the public Live Board transitions to a completed session instead of disappearing'
  );
end $$;

-- The guarantee holds for every row in the table, not just the fixture.
do $$
begin
  perform pg_temp.pb_assert(
    (select count(*) from public.matches
      where completed_at is not null and started_at is not null
        and completed_at < started_at) = 0,
    'no match anywhere records completion before its start'
  );
end $$;

-- A printed QR code keeps working after the session ends. This is the difference
-- between a link people text to their group chat and a link that 404s an hour
-- later, so it is asserted on the token itself rather than on the view.
do $$
declare
  v_token uuid;
begin
  select public_live_token into v_token
  from public.sessions
  where id = 'e0000000-0000-4000-8000-000000000002';

  perform pg_temp.pb_assert(
    v_token is not null,
    'starting a session issued a Player Live View token for the completed fixture'
  );
  perform pg_temp.pb_assert(
    (public.get_player_live_board(v_token) -> 'session' ->> 'status') = 'completed',
    'the same scanned token shows final results after the session ends'
  );
  perform pg_temp.pb_assert(
    public.get_player_live_board(v_token) -> 'standings' is not null
      and jsonb_array_length(public.get_player_live_board(v_token) -> 'standings') > 0,
    'the completed token payload still carries the final leaderboard'
  );
end $$;

-- ===========================================================================
-- 11. Public read models stay sanitized and stay anon-only where intended
-- ===========================================================================

-- Regression cover for session_standings being declared security_invoker while
-- reading a `private` helper view with no grant. That combination makes the
-- organizer query fail with "permission denied for view session_match_totals"
-- for every signed-in user, and only for signed-in users -- the database owner
-- bypasses privilege checks, so a suite that reads the view as the owner proves
-- nothing. This block reads it as authenticated.
reset role;

select set_config('request.jwt.claims', '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}', true);
set local role authenticated;

do $$
begin
  perform pg_temp.pb_assert(
    (select count(*) from public.session_standings
      where session_id = 'd0000000-0000-4000-8000-000000000001') = 5,
    'an authenticated club member can read the organizer standings'
  );
  perform pg_temp.pb_assert(
    (select count(*) from public.session_standings
      where session_id = 'd0000000-0000-4000-8000-000000000001'
        and games_played = 1) = 4,
    'the organizer view reports the completed match under the caller role too'
  );
  perform pg_temp.pb_assert(
    (select bool_and(games_played = 0 and wins = 0 and losses = 0) from public.session_standings
      where session_id = 'd0000000-0000-4000-8000-000000000001'
        and player_id = 'a0000000-0000-4000-8000-000000000005'),
    'an unplayed waiting player is a zero row for the caller role too'
  );
end $$;

reset role;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}', true);

-- RLS has to hold for the inline totals aggregate too. private.can_read_session
-- deliberately lets anyone read a session that is published, so the meaningful
-- boundary here is a PRIVATE session: a club B member must not be able to
-- accumulate or read club A's standings. Proving this needs a caller role,
-- because the owner bypasses RLS entirely.
select set_config('request.jwt.claims', '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated"}', true);
set local role authenticated;

do $$
declare
  v_rows integer;
begin
  select count(*) into v_rows
  from public.session_standings
  where session_id = 'c0000000-0000-4000-8000-000000000009';

  perform pg_temp.pb_assert(
    v_rows = 0,
    'the inline totals aggregate does not leak a private session''s standings to another club'
  );
end $$;

reset role;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}', true);
set local role authenticated;

do $$
begin
  perform pg_temp.pb_assert(
    (select count(*) from public.session_standings
      where session_id = 'c0000000-0000-4000-8000-000000000009') > 0,
    'the session owner still reads their own private session standings'
  );
end $$;

reset role;
select set_config('request.jwt.claims', '{"sub":"44444444-4444-4444-8444-444444444444","role":"anon"}', true);

-- session_standings is the organizer's read model and must never be readable
-- by an anonymous spectator, because it is not publish-gated.
select set_config('request.jwt.claims', '{"sub":"44444444-4444-4444-8444-444444444444","role":"anon"}', true);
set local role anon;

do $$
declare
  v_raised boolean := false;
begin
  v_raised := false;
  begin
    perform count(*) from public.session_standings
    where session_id = 'd0000000-0000-4000-8000-000000000001';
  exception when others then
    v_raised := true;
  end;
  perform pg_temp.pb_assert(v_raised, 'anon cannot read the organizer standings view');
end $$;

-- The published session's standings, queue, and attendance are readable and sanitized.
do $$
begin
  perform pg_temp.pb_assert(
    (select count(*) from public.public_session_standings
      where session_id = 'd0000000-0000-4000-8000-000000000001') = 6,
    'anon can read the published standings'
  );
  perform pg_temp.pb_assert(
    (select count(*) from public.public_session_queue
      where session_id = 'd0000000-0000-4000-8000-000000000001') = 5,
    'anon can read the published waiting queue'
  );
  perform pg_temp.pb_assert(
    (select count(*) from public.public_session_presence
      where session_id = 'd0000000-0000-4000-8000-000000000001') = 6,
    'anon can read sanitized attendance for the published session'
  );
end $$;

do $$
declare
  v_cols text;
begin
  select string_agg(column_name, ',') into v_cols
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'public_session_queue'
    and column_name in ('user_id', 'created_by', 'email', 'actor_id', 'player_id', 'id');

  perform pg_temp.pb_assert(
    v_cols is null,
    'the public waiting queue exposes no ids, auth data, or player id'
  );
end $$;

do $$
declare
  v_cols text;
begin
  select string_agg(column_name, ',') into v_cols
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'public_session_presence'
    and column_name in (
      'user_id', 'created_by', 'email', 'actor_id', 'player_id', 'member_id',
      'last_played_at', 'times_skipped', 'win_streak'
    );

  perform pg_temp.pb_assert(
    v_cols is null,
    'public attendance exposes no player/auth ids, membership, or internal metadata'
  );
end $$;

-- An unpublished session in a private club stays invisible to anon even though
-- the standings rows themselves would pass the base RLS checks.
do $$
begin
  perform pg_temp.pb_assert(
    (select count(*) from public.public_session_standings
      where session_id = 'c0000000-0000-4000-8000-000000000009') = 0,
    'a private draft session is not exposed through the public standings view'
  );
  perform pg_temp.pb_assert(
    (select count(*) from public.public_session_presence
      where session_id = 'c0000000-0000-4000-8000-000000000009') = 0,
    'a private draft session is not exposed through public attendance'
  );
end $$;

-- ===========================================================================
-- The Player Live View token as a phone actually presents it: no JWT, no
-- membership, no session id. The token is read once here as the table owner
-- because anon deliberately has no privilege on that column.
-- ===========================================================================
reset role;
-- psql does not interpolate variables inside dollar-quoted bodies, so the token
-- travels through a session GUC instead. A custom `pb.` setting needs no
-- extension and disappears with the transaction.
select set_config('pb.player_token', public_live_token::text, true)
from public.sessions
where id = 'd0000000-0000-4000-8000-000000000001';

select set_config('request.jwt.claims', '{"sub":"44444444-4444-4444-8444-444444444444","role":"anon"}', true);
set local role anon;

do $$
declare
  v_token uuid := current_setting('pb.player_token')::uuid;
begin
  perform pg_temp.pb_assert(
    v_token is not null,
    'the active fixture still holds its Player Live View token'
  );
  perform pg_temp.pb_assert(
    (public.get_player_live_board(v_token) -> 'session' ->> 'name') = 'Live Board Session',
    'a scanned token opens the Player Live View with no login'
  );
  perform pg_temp.pb_assert(
    public.get_player_live_board(v_token) -> 'session' ->> 'club_name' is not null
      and public.get_player_live_board(v_token) -> 'courts' is not null
      and public.get_player_live_board(v_token) -> 'lineups' is not null
      and public.get_player_live_board(v_token) -> 'presence' is not null
      and public.get_player_live_board(v_token) -> 'standings' is not null,
    'one token call returns the whole board, so a phone never needs a second query'
  );
  perform pg_temp.pb_assert(
    jsonb_array_length(public.get_player_live_board(v_token) -> 'standings') = 6
      and jsonb_array_length(
        (select jsonb_agg(s)
         from jsonb_array_elements(public.get_player_live_board(v_token) -> 'standings') s
         where s ->> 'player_id' is not null)
      ) = 6,
    'the anonymous board keeps every arrived player, including zero-game players'
  );
  perform pg_temp.pb_assert(
    public.get_player_live_board(v_token)::text not like '%@%'
      and public.get_player_live_board(v_token)::text not ilike '%recovery%'
      and public.get_player_live_board(v_token)::text not ilike '%membership%'
      and public.get_player_live_board(v_token)::text not ilike '%public_live_token%'
      and public.get_player_live_board(v_token)::text not ilike '%created_by%',
    'the anonymous payload carries no email, recovery, membership, or capability data'
  );
  perform pg_temp.pb_assert(
    public.get_player_live_board(extensions.gen_random_uuid()) is null,
    'an unknown token resolves nothing rather than the newest session'
  );
end $$;

-- Holding the capability must not grant write access to anything.
do $$
begin
  -- Stated directly, because "the UPDATE raised" is only meaningful while the
  -- privilege really is absent: RLS filters rows silently, so a missing grant
  -- and a passing filter look identical from the exception handler.
  perform pg_temp.pb_assert(
    not has_table_privilege('anon', 'public.courts', 'update')
      and not has_table_privilege('anon', 'public.courts', 'delete')
      and not has_table_privilege('anon', 'public.courts', 'insert')
      and not has_table_privilege('anon', 'public.matches', 'update')
      and not has_table_privilege('anon', 'public.matches', 'insert')
      and not has_table_privilege('anon', 'public.session_players', 'insert')
      and not has_table_privilege('anon', 'public.session_players', 'update')
      and not has_table_privilege('anon', 'public.sessions', 'update')
      and not has_table_privilege('anon', 'public.sessions', 'delete')
      and not has_table_privilege('anon', 'public.players', 'update'),
    'anon holds no insert, update, or delete privilege on any session table'
  );
  perform pg_temp.pb_assert(
    not has_function_privilege('anon', 'public.end_session(uuid, boolean)', 'execute')
      and not has_function_privilege('anon', 'public.start_session(uuid)', 'execute')
      and not has_function_privilege('anon', 'public.set_running_score(uuid, integer, integer)', 'execute')
      and not has_function_privilege('anon', 'public.complete_match(uuid, integer, integer)', 'execute'),
    'anon cannot execute the organizer RPCs behind the board'
  );
end $$;

do $$
declare
  v_raised boolean := false;
begin
  v_raised := false;
  begin
    update public.courts
    set status = 'active'
    where session_id = 'd0000000-0000-4000-8000-000000000001';
  exception when others then
    v_raised := true;
  end;
  perform pg_temp.pb_assert(v_raised, 'a spectator cannot move a court');

  v_raised := false;
  begin
    update public.matches
    set team1_score = 99
    where session_id = 'd0000000-0000-4000-8000-000000000001';
  exception when others then
    v_raised := true;
  end;
  perform pg_temp.pb_assert(v_raised, 'a spectator cannot write a score');

  v_raised := false;
  begin
    insert into public.session_players (session_id, player_id)
    values ('d0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001');
  exception when others then
    v_raised := true;
  end;
  perform pg_temp.pb_assert(v_raised, 'a spectator cannot check a player in');

  v_raised := false;
  begin
    perform public.end_session('d0000000-0000-4000-8000-000000000001');
  exception when others then
    v_raised := true;
  end;
  perform pg_temp.pb_assert(v_raised, 'a spectator cannot end the session');

  v_raised := false;
  begin
    perform public.set_running_score(
      (select id from public.courts
       where session_id = 'd0000000-0000-4000-8000-000000000001' limit 1),
      9, 3
    );
  exception when others then
    v_raised := true;
  end;
  perform pg_temp.pb_assert(v_raised, 'a spectator cannot set a running score');
end $$;

-- Turning the feature off retires the printed QR code.
reset role;
update public.sessions
set player_live_enabled = false
where id = 'd0000000-0000-4000-8000-000000000001';

set local role anon;
do $$
declare
  v_token uuid := current_setting('pb.player_token')::uuid;
begin
  perform pg_temp.pb_assert(
    public.get_player_live_board(v_token) is null,
    'a disabled Player Live View stops resolving its old token'
  );
end $$;

reset role;

-- RAISE only exists inside plpgsql, so the closing notice needs a DO block.
do $$
begin
  raise notice 'All RLS verification assertions passed. Fixtures rolled back.';
end $$;
