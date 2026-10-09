-- Lineup stage verification suite: preparing -> up_next -> staged -> playing.
--
-- Companion to supabase/tests/rls_verification.sql. That file proves who is
-- allowed to call what; this one proves the four stages behave, which is the
-- part the old single-shot `stage_match` could not express at all.
--
-- Runs inside one transaction that is rolled back, so it leaves no fixtures
-- behind:
--
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/lineup-stages.sql
--
-- Every assertion prints PASS/FAIL. Any FAIL aborts under ON_ERROR_STOP.
--
-- No psql meta-commands, so this file also runs in the Supabase SQL editor.

begin;

-- ---------------------------------------------------------------------------
-- assertion helper
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

-- Refuse an expected failure and report it, so a check that silently stopped
-- throwing cannot pass as a success.
-- Refuse an expected failure and report it, so a check that silently stopped
-- throwing cannot pass as a success, and a call that is refused for the wrong
-- reason fails loudly instead of looking like a green test.
create or replace function pg_temp.pb_refuses(
  p_expected text,
  p_label text,
  p_fn text,
  p_args text
)
returns void
language plpgsql
as $$
declare
  v_refused boolean := false;
  v_message text;
begin
  begin
    if p_fn = 'create_preparation_lineup' then
      perform public.create_preparation_lineup(
        (p_args::jsonb ->> 'session_id')::uuid,
        array(select (value)::text::uuid from jsonb_array_elements_text(p_args::jsonb -> 'player_ids')),
        array(select (value)::int::smallint from jsonb_array_elements_text(p_args::jsonb -> 'team_numbers')),
        null::smallint[],
        'refused',
        'fifo'
      );
    elsif p_fn = 'update_lineup_players' then
      perform public.update_lineup_players(
        (p_args::jsonb ->> 'match_id')::uuid,
        array(select (value)::text::uuid from jsonb_array_elements_text(p_args::jsonb -> 'player_ids')),
        array(select (value)::int::smallint from jsonb_array_elements_text(p_args::jsonb -> 'team_numbers')),
        array(select (value)::int::smallint from jsonb_array_elements_text(p_args::jsonb -> 'slot_numbers'))
      );
    else
      raise exception 'pb_refuses: unknown function %', p_fn;
    end if;
  exception when others then
    -- The RPCs raise a mix of errcodes (42501, 22023, P0002) on purpose, so
    -- catch everything rather than naming a condition that may change.
    v_refused := true;
    v_message := sqlerrm;
  end;

  if not v_refused then
    raise exception 'FAIL: % (the call was accepted)', p_label;
  end if;

  if position(p_expected in v_message) = 0 then
    raise exception 'FAIL: % (refused for the wrong reason: %)', p_label, v_message;
  end if;

  raise notice 'PASS: %', p_label;
end;
$$;

reset role;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}', true);

-- Minimal club fixtures. This file is meant to run on its own, so it cannot
-- rely on the ones rls_verification.sql created and rolled back. The handle_new_user
-- trigger creates the matching profiles, so only the membership rows are needed.
insert into auth.users (id, email) values
  ('11111111-1111-4111-8111-111111111111', 'owner-a@example.test'),
  ('33333333-3333-4333-8333-333333333333', 'player-a@example.test');

insert into public.clubs (id, name, slug, is_public, created_by) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Harbour Pickle Club', 'harbour-pickle-club', false,
   '11111111-1111-4111-8111-111111111111'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'Riverside Open Play', 'riverside-open-play', true,
   '11111111-1111-4111-8111-111111111111');

insert into public.club_members (club_id, user_id, role) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '11111111-1111-4111-8111-111111111111', 'owner'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '33333333-3333-4333-8333-333333333333', 'player'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '11111111-1111-4111-8111-111111111111', 'owner');

-- ===========================================================================
-- 1. Fixtures
-- ===========================================================================
-- Four separate sessions so each block below owns its whole pipeline state and
-- the queue-position arithmetic in one block cannot depend on another. All
-- players are distinct per session, which also keeps
-- match_players_one_unresolved_per_player (global per player, not per session)
-- out of the way.

insert into public.sessions (
  id, club_id, name, status, format, matching_mode, court_count, is_public, created_by
) values
  ('f0000000-0000-4000-8000-000000000001', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
   'Rotation Session', 'draft', 'doubles', 'balanced', 2, true,
   '11111111-1111-4111-8111-111111111111'),
  ('f0000000-0000-4000-8000-000000000002', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
   'Cancel Session', 'draft', 'doubles', 'balanced', 1, true,
   '11111111-1111-4111-8111-111111111111'),
  ('f0000000-0000-4000-8000-000000000003', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
   'Singles Session', 'draft', 'singles', 'balanced', 1, true,
   '11111111-1111-4111-8111-111111111111'),
  ('f0000000-0000-4000-8000-000000000004', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
   'Board Session', 'draft', 'doubles', 'balanced', 2, true,
   '11111111-1111-4111-8111-111111111111');

-- Main flow: twelve players, so queue slots 1-12 are known up front and there
-- is always somebody behind whoever is removed from a lineup.
insert into public.players (id, club_id, display_name, skill_level) values
  ('f1000000-0000-4000-8000-000000000001', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Rotation One',   3),
  ('f1000000-0000-4000-8000-000000000002', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Rotation Two',   4),
  ('f1000000-0000-4000-8000-000000000003', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Rotation Three', 2),
  ('f1000000-0000-4000-8000-000000000004', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Rotation Four',  5),
  ('f1000000-0000-4000-8000-000000000005', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Rotation Five',  3),
  ('f1000000-0000-4000-8000-000000000006', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Rotation Six',   3),
  ('f1000000-0000-4000-8000-000000000007', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Rotation Seven', 4),
  ('f1000000-0000-4000-8000-000000000008', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Rotation Eight', 2),
  ('f1000000-0000-4000-8000-000000000009', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Rotation Nine',  3),
  ('f1000000-0000-4000-8000-00000000000a', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Rotation Ten',   3),
  ('f1000000-0000-4000-8000-00000000000b', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Rotation Eleven', 4),
  ('f1000000-0000-4000-8000-00000000000c', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Rotation Twelve', 3),
  -- On the roster but never checked in.
  ('f1000000-0000-4000-8000-00000000000d', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Rotation Absent', 3);

-- Cancel session: four players.
insert into public.players (id, club_id, display_name, skill_level) values
  ('f2000000-0000-4000-8000-000000000001', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Cancel One',   3),
  ('f2000000-0000-4000-8000-000000000002', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Cancel Two',   4),
  ('f2000000-0000-4000-8000-000000000003', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Cancel Three', 2),
  ('f2000000-0000-4000-8000-000000000004', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Cancel Four',  5);

-- Singles session: four players, only two of whom can ever be in a lineup.
insert into public.players (id, club_id, display_name, skill_level) values
  ('f3000000-0000-4000-8000-000000000001', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Singles One',   3),
  ('f3000000-0000-4000-8000-000000000002', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Singles Two',   4),
  ('f3000000-0000-4000-8000-000000000003', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Singles Three', 2),
  ('f3000000-0000-4000-8000-000000000004', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Singles Four',  5);

-- Public board/end-session fixture: twelve players. The public payload uses the
-- first eight; the final four create a third open lineup for forced cleanup.
insert into public.players (id, club_id, display_name, skill_level) values
  ('f4000000-0000-4000-8000-000000000001', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Board One',   3),
  ('f4000000-0000-4000-8000-000000000002', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Board Two',   4),
  ('f4000000-0000-4000-8000-000000000003', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Board Three', 2),
  ('f4000000-0000-4000-8000-000000000004', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Board Four',  5),
  ('f4000000-0000-4000-8000-000000000005', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Board Five',  3),
  ('f4000000-0000-4000-8000-000000000006', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Board Six',   3),
  ('f4000000-0000-4000-8000-000000000007', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Board Seven', 4),
  ('f4000000-0000-4000-8000-000000000008', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Board Eight', 2),
  ('f4000000-0000-4000-8000-000000000009', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Board Nine', 3),
  ('f4000000-0000-4000-8000-00000000000a', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Board Ten', 3),
  ('f4000000-0000-4000-8000-00000000000b', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Board Eleven', 4),
  ('f4000000-0000-4000-8000-00000000000c', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Board Twelve', 2);

-- One player belonging to the other club, to prove a foreign id cannot be used.
insert into public.players (id, club_id, display_name, skill_level) values
  ('f9000000-0000-4000-8000-000000000001', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'Outsider Player', 3);

insert into public.session_players (session_id, player_id)
select 'f0000000-0000-4000-8000-000000000001', id
from public.players where id::text like 'f1000000-0000-4000-8000-%';

insert into public.session_players (session_id, player_id)
select 'f0000000-0000-4000-8000-000000000002', id
from public.players where id::text like 'f2000000-0000-4000-8000-%';

insert into public.session_players (session_id, player_id)
select 'f0000000-0000-4000-8000-000000000003', id
from public.players where id::text like 'f3000000-0000-4000-8000-%';

insert into public.session_players (session_id, player_id)
select 'f0000000-0000-4000-8000-000000000004', id
from public.players where id::text like 'f4000000-0000-4000-8000-%';

do $$
declare
  v_roster record;
begin
  for v_roster in
    select sp.session_id, sp.player_id
    from public.session_players sp
    where sp.session_id in (
      'f0000000-0000-4000-8000-000000000001',
      'f0000000-0000-4000-8000-000000000002',
      'f0000000-0000-4000-8000-000000000003',
      'f0000000-0000-4000-8000-000000000004'
    )
  loop
    -- "Rotation Absent" is deliberately left unchecked.
    if v_roster.player_id <> 'f1000000-0000-4000-8000-00000000000d' then
      perform public.check_in_player(v_roster.session_id, v_roster.player_id);
    end if;
  end loop;

  perform public.start_session('f0000000-0000-4000-8000-000000000001');
  perform public.start_session('f0000000-0000-4000-8000-000000000002');
  perform public.start_session('f0000000-0000-4000-8000-000000000003');
  perform public.start_session('f0000000-0000-4000-8000-000000000004');

  perform pg_temp.pb_assert(
    (select array_agg(queue_position order by queue_position) = array[1,2,3,4,5,6,7,8,9,10,11,12]
     from public.session_players
     where session_id = 'f0000000-0000-4000-8000-000000000001'
       and attendance_status = 'waiting'),
    'checking in twelve players fills queue slots 1 through 12 in roster order'
  );

  perform pg_temp.pb_assert(
    exists (select 1 from public.session_players
            where session_id = 'f0000000-0000-4000-8000-000000000001'
              and player_id = 'f1000000-0000-4000-8000-00000000000d'
              and attendance_status <> 'waiting'
              and queue_position is null),
    'a player who never checked in holds no queue slot'
  );
end $$;

-- ===========================================================================
-- 2. A generated lineup enters Preparation, and an empty pipeline promotes it
-- ===========================================================================

do $$
declare
  v_session uuid := 'f0000000-0000-4000-8000-000000000001';
  v_first jsonb;
  v_first_id uuid;
begin
  v_first := public.create_preparation_lineup(
    p_session_id => v_session,
    p_player_ids => array[
      'f1000000-0000-4000-8000-000000000001', 'f1000000-0000-4000-8000-000000000002',
      'f1000000-0000-4000-8000-000000000003', 'f1000000-0000-4000-8000-000000000004'
    ]::uuid[],
    p_team_numbers => array[1, 1, 2, 2]::smallint[],
    p_explanation => 'balanced teams',
    p_matching_mode => 'balanced'
  );
  v_first_id := (v_first ->> 'match_id')::uuid;

  -- The lineage matters: the row was created in Preparation and only then
  -- promoted. A single event proving both would hide which of the two ran.
  perform pg_temp.pb_assert(
    exists (select 1 from public.queue_events
            where session_id = v_session
              and event_type = 'lineup_created'
              and metadata ->> 'match_id' = v_first_id::text
              and metadata ->> 'stage' = 'preparing'),
    'a generated lineup is recorded as entering Preparation'
  );

  perform pg_temp.pb_assert(
    exists (select 1 from public.queue_events
            where session_id = v_session
              and event_type = 'lineup_promoted'
              and metadata ->> 'match_id' = v_first_id::text
              and metadata ->> 'from' = 'preparing'
              and metadata ->> 'to' = 'up_next'),
    'the promotion out of Preparation is logged as its own step'
  );

  perform pg_temp.pb_assert(
    not exists (select 1 from public.queue_events
                where session_id = v_session
                  and event_type = 'lineup_assigned'
                  and metadata ->> 'match_id' = v_first_id::text),
    'no lineup is ever sent onto a court while it is still being created'
  );

  perform pg_temp.pb_assert(
    (select status from public.matches where id = v_first_id) = 'up_next',
    'with an empty pipeline the first lineup is promoted to Up Next'
  );

  perform pg_temp.pb_assert(
    (v_first ->> 'status') = 'up_next'
    and (v_first ->> 'promoted_match_id')::uuid = v_first_id,
    'creating a lineup reports the automatic promotion it caused'
  );

  perform pg_temp.pb_assert(
    (select court_id is null from public.matches where id = v_first_id),
    'a lineup waiting for a court holds none'
  );

  -- The court-less check constraint is what makes that invariant unbreakable
  -- from any other code path, including a future one.
  perform pg_temp.pb_assert(
    (select count(*) = 1 from pg_constraint
     where conname = 'matches_court_required_for_court_stages'),
    'the no-court-while-queued rule is a database constraint, not only an RPC check'
  );

  -- Real names, in slot order. Nothing here was ever called Player 1.
  perform pg_temp.pb_assert(
    (select array_agg(pl.display_name order by mp.team_number, mp.slot_number)
     from public.match_players mp
     join public.players pl on pl.id = mp.player_id
     where mp.match_id = v_first_id)
      = array['Rotation One', 'Rotation Two', 'Rotation Three', 'Rotation Four'],
    'the lineup stores two players per team in slot order'
  );

  perform pg_temp.pb_assert(
    (select array_agg(mp.slot_number order by mp.team_number, mp.slot_number)
     from public.match_players mp where mp.match_id = v_first_id) = array[1,2,1,2]::smallint[],
    'each team fills slot 1 then slot 2'
  );

  perform pg_temp.pb_assert(
    (select array_agg(mp.origin_queue_position order by mp.team_number, mp.slot_number)
     from public.match_players mp where mp.match_id = v_first_id) = array[1,2,3,4],
    'each slot remembers the queue position its player gave up'
  );

  perform pg_temp.pb_assert(
    (select count(*) = 4 from public.session_players
     where session_id = v_session
       and player_id in ('f1000000-0000-4000-8000-000000000001', 'f1000000-0000-4000-8000-000000000002',
                         'f1000000-0000-4000-8000-000000000003', 'f1000000-0000-4000-8000-000000000004')
       and attendance_status = 'staged'
       and queue_position is null
       and checked_in_at is not null
       and last_enqueued_at is not null),
    'lineup players hold their slot and keep the timestamps that record their wait'
  );

  perform pg_temp.pb_assert(
    (select count(*) = 8 from public.session_players
     where session_id = v_session
       and attendance_status = 'waiting'
       and times_skipped = 1),
    'building a lineup records that the players behind it were passed over'
  );

  -- A second lineup waits behind the head of the queue.
  perform public.create_preparation_lineup(
    p_session_id => v_session,
    p_player_ids => array[
      'f1000000-0000-4000-8000-000000000005', 'f1000000-0000-4000-8000-000000000006',
      'f1000000-0000-4000-8000-000000000007', 'f1000000-0000-4000-8000-000000000008'
    ]::uuid[],
    p_team_numbers => array[1, 1, 2, 2]::smallint[],
    p_explanation => 'next balanced teams',
    p_matching_mode => 'balanced'
  );

  perform pg_temp.pb_assert(
    (select count(*) = 1 from public.matches
     where session_id = v_session and status = 'up_next')
    and (select count(*) = 1 from public.matches
         where session_id = v_session and status = 'preparing'),
    'a second lineup waits in Preparation while one is already Up Next'
  );
end $$;

-- ===========================================================================
-- 3. Nobody can be in two places at once, and the database is the backstop
-- ===========================================================================

do $$
declare
  v_session uuid := 'f0000000-0000-4000-8000-000000000001';
  v_second_id uuid;
  v_raised text;
begin
  select id into v_second_id from public.matches
  where session_id = v_session and status = 'preparing';

  perform pg_temp.pb_refuses(
    'already in another lineup', 'a player already in a lineup cannot be selected again',
    'create_preparation_lineup',
    format('{"session_id": "%s", "player_ids": ["%s", "%s", "%s", "%s"], "team_numbers": [1,1,2,2]}',
      v_session,
      'f1000000-0000-4000-8000-000000000005', 'f1000000-0000-4000-8000-000000000006',
      'f1000000-0000-4000-8000-000000000009', 'f1000000-0000-4000-8000-00000000000a')
  );

  perform pg_temp.pb_refuses(
    'not checked in', 'a roster player who never checked in cannot be selected',
    'create_preparation_lineup',
    format('{"session_id": "%s", "player_ids": ["%s", "%s", "%s", "%s"], "team_numbers": [1,1,2,2]}',
      v_session,
      'f1000000-0000-4000-8000-000000000009', 'f1000000-0000-4000-8000-00000000000a',
      'f1000000-0000-4000-8000-00000000000b', 'f1000000-0000-4000-8000-00000000000d')
  );

  perform pg_temp.pb_refuses(
    'not on this club roster', 'a player from another club cannot be selected',
    'create_preparation_lineup',
    format('{"session_id": "%s", "player_ids": ["%s", "%s", "%s", "%s"], "team_numbers": [1,1,2,2]}',
      v_session,
      'f1000000-0000-4000-8000-000000000009', 'f1000000-0000-4000-8000-00000000000a',
      'f1000000-0000-4000-8000-00000000000b', 'f9000000-0000-4000-8000-000000000001')
  );

  perform pg_temp.pb_refuses(
    'exactly 4 players', 'a doubles lineup of three players is refused',
    'create_preparation_lineup',
    format('{"session_id": "%s", "player_ids": ["%s", "%s", "%s"], "team_numbers": [1,1,2]}',
      v_session,
      'f1000000-0000-4000-8000-000000000009', 'f1000000-0000-4000-8000-00000000000a',
      'f1000000-0000-4000-8000-00000000000b')
  );

  perform pg_temp.pb_refuses(
    'cannot be selected twice', 'the same player id cannot appear twice in one lineup',
    'create_preparation_lineup',
    format('{"session_id": "%s", "player_ids": ["%s", "%s", "%s", "%s"], "team_numbers": [1,1,2,2]}',
      v_session,
      'f1000000-0000-4000-8000-000000000009', 'f1000000-0000-4000-8000-000000000009',
      'f1000000-0000-4000-8000-00000000000a', 'f1000000-0000-4000-8000-00000000000b')
  );

  perform pg_temp.pb_refuses(
    'Each team needs the same number of players',
    'an uneven 3-1 split is refused',
    'create_preparation_lineup',
    format('{"session_id": "%s", "player_ids": ["%s", "%s", "%s", "%s"], "team_numbers": [1,1,1,2]}',
      v_session,
      'f1000000-0000-4000-8000-000000000009', 'f1000000-0000-4000-8000-00000000000a',
      'f1000000-0000-4000-8000-00000000000b', 'f1000000-0000-4000-8000-00000000000c')
  );

  -- Now bypass the RPCs entirely. These are the guarantees that survive a
  -- caller which forgets to take the session lock, which is exactly the bug
  -- that produces two organizers acting on stale state.
  begin
    insert into public.match_players (
      match_id, player_id, session_id, team_number, slot_number, skill_snapshot
    ) values (
      v_second_id, 'f1000000-0000-4000-8000-000000000001',
      v_session, 1, 1, 3
    );
  exception when unique_violation then
    v_raised := 'unique';
  end;
  perform pg_temp.pb_assert(
    v_raised = 'unique',
    'the database refuses a second unresolved lineup row for one player'
  );

  v_raised := null;
  begin
    insert into public.matches (
      session_id, match_number, status, target_score, win_by, matching_mode, created_by
    ) values (
      v_session, 900, 'up_next', 11, 2, 'fifo', auth.uid()
    );
  exception when unique_violation then
    v_raised := 'unique';
  end;
  perform pg_temp.pb_assert(
    v_raised = 'unique',
    'the database refuses a second Up Next lineup for one session'
  );

  v_raised := null;
  begin
    insert into public.matches (
      session_id, match_number, status, target_score, win_by, matching_mode, created_by
    ) values (
      v_session, 901, 'staged', 11, 2, 'fifo', auth.uid()
    );
  exception when check_violation then
    v_raised := 'check';
  end;
  perform pg_temp.pb_assert(
    v_raised = 'check',
    'the database refuses a staged match with no court'
  );
end $$;

-- ===========================================================================
-- 4. Manual transitions, and the automatic ones they trigger
-- ===========================================================================

do $$
declare
  v_session uuid := 'f0000000-0000-4000-8000-000000000001';
  v_first_id uuid;
  v_second_id uuid;
  v_court_one uuid;
  v_court_two uuid;
  v_result jsonb;
  v_raised text;
begin
  select id into v_first_id from public.matches
  where session_id = v_session and status = 'up_next';
  select id into v_second_id from public.matches
  where session_id = v_session and status = 'preparing';
  select id into v_court_one from public.courts
  where session_id = v_session and court_number = 1;
  select id into v_court_two from public.courts
  where session_id = v_session and court_number = 2;

  v_raised := null;
  begin
    perform public.promote_preparation_match(v_second_id);
  exception when others then v_raised := sqlerrm;
  end;
  perform pg_temp.pb_assert(
    v_raised is not null and v_raised like '%Up Next%',
    'promoting a second lineup is refused while one is already Up Next'
  );

  v_raised := null;
  begin
    perform public.demote_up_next_match(v_second_id);
  exception when others then v_raised := sqlerrm;
  end;
  perform pg_temp.pb_assert(
    v_raised is not null,
    'only the Up Next lineup can be sent back to Preparation'
  );

  perform public.demote_up_next_match(v_first_id);
  perform pg_temp.pb_assert(
    (select status from public.matches where id = v_first_id) = 'preparing'
    and (select court_id is null from public.matches where id = v_first_id),
    'the Up Next lineup can be sent back to Preparation, still with no court'
  );

  perform public.promote_preparation_match(v_first_id);

  perform public.promote_preparation_match(v_first_id);
  perform pg_temp.pb_assert(
    (select status from public.matches where id = v_first_id) = 'up_next',
    'a Preparation lineup can be moved to Up Next'
  );

  -- Assigning the head of the queue to a court is the point where the pipeline
  -- turns over by itself.
  v_result := public.assign_lineup_to_court(v_first_id, v_court_one);

  perform pg_temp.pb_assert(
    (v_result ->> 'promoted_match_id')::uuid = v_second_id,
    'assigning a court automatically promotes the next Preparation lineup'
  );

  perform pg_temp.pb_assert(
    (select status from public.matches where id = v_first_id) = 'staged'
    and (select status from public.courts where id = v_court_one) = 'staged',
    'assigning a court stages both the lineup and the court'
  );

  perform pg_temp.pb_assert(
    (select status from public.matches where id = v_second_id) = 'up_next'
    and (select count(*) = 1 from public.matches
         where session_id = v_session and status = 'up_next'),
    'exactly one lineup is Up Next after the automatic promotion'
  );

  perform pg_temp.pb_assert(
    (select court_id is null from public.matches where id = v_second_id),
    'the promoted lineup is still waiting for a court'
  );

  perform pg_temp.pb_assert(
    (v_result ->> 'court_number')::int = 1
    and (v_result ->> 'status') = 'staged',
    'the court assignment reports the court and the new stage'
  );

  perform pg_temp.pb_assert(
    exists (select 1 from public.queue_events
            where session_id = v_session
              and event_type = 'lineup_assigned'
              and metadata ->> 'match_id' = v_first_id::text
              and metadata ->> 'to' = 'staged'),
    'moving a lineup onto a court is logged with the stage it moved to'
  );

  v_raised := null;
  begin
    perform public.assign_lineup_to_court(v_second_id, v_court_one);
  exception when others then v_raised := sqlerrm;
  end;
  perform pg_temp.pb_assert(
    v_raised is not null and v_raised like '%not available%',
    'a court already holding a lineup cannot be reused'
  );

  -- A court id from a different session of the same club. Real ids, wrong owner:
  -- this is the mistake an organizer makes by trusting a stale client payload.
  v_raised := null;
  begin
    perform public.assign_lineup_to_court(
      v_second_id,
      (select id from public.courts
       where session_id = 'f0000000-0000-4000-8000-000000000002' limit 1)
    );
  exception when others then v_raised := sqlerrm;
  end;
  perform pg_temp.pb_assert(
    v_raised is not null and v_raised like '%Court not found in this session%',
    'a lineup can only be assigned to one of its own session courts'
  );

  perform pg_temp.pb_assert(
    (select status from public.matches where id = v_second_id) = 'up_next'
    and (select court_id is null from public.matches where id = v_second_id),
    'the refused assignment left the lineup waiting for a court'
  );
end $$;

-- ===========================================================================
-- 5. Editing a lineup: replace, swap partners, swap teams, remove
-- ===========================================================================

do $$
declare
  v_session uuid := 'f0000000-0000-4000-8000-000000000001';
  v_first_id uuid;
  v_names text[];
  v_enqueued timestamptz;
  v_raised text;
begin
  select id into v_first_id from public.matches
  where session_id = v_session and status = 'staged';

  select last_enqueued_at into v_enqueued
  from public.session_players
  where session_id = v_session and player_id = 'f1000000-0000-4000-8000-000000000004';

  -- Replace Rotation Four, who holds slot 4 on the queue, with Rotation Nine,
  -- who is waiting at slot 9.
  perform public.update_lineup_players(
    p_match_id => v_first_id,
    p_player_ids => array[
      'f1000000-0000-4000-8000-000000000001', 'f1000000-0000-4000-8000-000000000002',
      'f1000000-0000-4000-8000-000000000003', 'f1000000-0000-4000-8000-000000000009'
    ]::uuid[],
    p_team_numbers => array[1, 1, 2, 2]::smallint[],
    p_slot_numbers => array[1, 2, 1, 2]::smallint[]
  );

  perform pg_temp.pb_assert(
    (select array_agg(pl.display_name order by mp.team_number, mp.slot_number)
     from public.match_players mp
     join public.players pl on pl.id = mp.player_id
     where mp.match_id = v_first_id)
      = array['Rotation One', 'Rotation Two', 'Rotation Three', 'Rotation Nine'],
    'a waiting player can replace a player on a staged lineup'
  );

  -- The fairness requirement: the player who was pulled off goes back to the
  -- queue slot they gave up, keeps their original timestamp, and everybody
  -- behind them keeps their relative order.
  perform pg_temp.pb_assert(
    (select attendance_status from public.session_players
     where session_id = v_session and player_id = 'f1000000-0000-4000-8000-000000000004')
      = 'waiting'
    and (select queue_position from public.session_players
         where session_id = v_session and player_id = 'f1000000-0000-4000-8000-000000000004') = 4,
    'a removed player returns to the queue on the slot they held'
  );

  perform pg_temp.pb_assert(
    (select last_enqueued_at from public.session_players
     where session_id = v_session and player_id = 'f1000000-0000-4000-8000-000000000004')
      is not distinct from v_enqueued,
    'a removed player keeps the timestamp that records how long they waited'
  );

  perform pg_temp.pb_assert(
    (select queue_position from public.session_players
     where session_id = v_session and player_id = 'f1000000-0000-4000-8000-00000000000a') = 11
    and (select queue_position from public.session_players
         where session_id = v_session and player_id = 'f1000000-0000-4000-8000-00000000000b') = 12
    and (select queue_position from public.session_players
         where session_id = v_session and player_id = 'f1000000-0000-4000-8000-00000000000c') = 13,
    'players behind the returning player keep their relative order'
  );

  perform pg_temp.pb_assert(
    (select attendance_status from public.session_players
     where session_id = v_session and player_id = 'f1000000-0000-4000-8000-000000000009')
      = 'staged'
    and (select queue_position from public.session_players
         where session_id = v_session and player_id = 'f1000000-0000-4000-8000-000000000009') is null,
    'the player who joined the lineup leaves the waiting queue'
  );

  perform pg_temp.pb_assert(
    (select origin_queue_position from public.match_players
     where match_id = v_first_id and player_id = 'f1000000-0000-4000-8000-000000000009') = 9,
    'the new slot records the queue position the newcomer gave up'
  );

  -- A player who is already on this lineup keeps the origin they arrived with,
  -- so replacing them later returns them to where they were rather than to
  -- wherever the queue happens to be by then.
  perform pg_temp.pb_assert(
    (select array_agg(origin_queue_position order by team_number, slot_number)
     from public.match_players where match_id = v_first_id) = array[1,2,3,9]::integer[],
    'a repeat edit does not move the origins of players who stayed on the lineup'
  );

  perform pg_temp.pb_assert(
    exists (select 1 from public.queue_events
            where session_id = v_session
              and event_type = 'lineup_player_removed'
              and player_id = 'f1000000-0000-4000-8000-000000000004'
              and metadata ->> 'queue_position' = '4'),
    'a removal is logged with the queue slot it returned to'
  );

  -- Swap partners inside team 1. Done as one call, because a row-at-a-time
  -- update would collide with the unique (match, team, slot) constraint halfway
  -- through the swap.
  perform public.update_lineup_players(
    p_match_id => v_first_id,
    p_player_ids => array[
      'f1000000-0000-4000-8000-000000000002', 'f1000000-0000-4000-8000-000000000001',
      'f1000000-0000-4000-8000-000000000003', 'f1000000-0000-4000-8000-000000000009'
    ]::uuid[],
    p_team_numbers => array[1, 1, 2, 2]::smallint[],
    p_slot_numbers => array[1, 2, 1, 2]::smallint[]
  );

  perform pg_temp.pb_assert(
    (select array_agg(pl.display_name order by mp.team_number, mp.slot_number)
     from public.match_players mp
     join public.players pl on pl.id = mp.player_id
     where mp.match_id = v_first_id)
      = array['Rotation Two', 'Rotation One', 'Rotation Three', 'Rotation Nine'],
    'swapping partners moves both players without a slot collision'
  );

  -- Swap the two teams over.
  perform public.update_lineup_players(
    p_match_id => v_first_id,
    p_player_ids => array[
      'f1000000-0000-4000-8000-000000000002', 'f1000000-0000-4000-8000-000000000001',
      'f1000000-0000-4000-8000-000000000003', 'f1000000-0000-4000-8000-000000000009'
    ]::uuid[],
    p_team_numbers => array[2, 2, 1, 1]::smallint[],
    p_slot_numbers => array[1, 2, 1, 2]::smallint[]
  );

  perform pg_temp.pb_assert(
    (select array_agg(pl.display_name order by mp.team_number, mp.slot_number)
     from public.match_players mp
     join public.players pl on pl.id = mp.player_id
     where mp.match_id = v_first_id)
      = array['Rotation Three', 'Rotation Nine', 'Rotation Two', 'Rotation One'],
    'swapping teams reassigns both lineups at once'
  );

  perform pg_temp.pb_refuses(
    'cannot be selected twice', 'a lineup cannot hold the same player twice',
    'update_lineup_players',
    format('{"match_id": "%s", "player_ids": ["%s", "%s", "%s", "%s"],
             "team_numbers": [1,1,2,2], "slot_numbers": [1,2,1,2]}',
      v_first_id,
      'f1000000-0000-4000-8000-000000000001', 'f1000000-0000-4000-8000-000000000001',
      'f1000000-0000-4000-8000-000000000003', 'f1000000-0000-4000-8000-000000000009')
  );

  perform pg_temp.pb_refuses(
    'already in another lineup', 'a player already in another lineup cannot be added',
    'update_lineup_players',
    format('{"match_id": "%s", "player_ids": ["%s", "%s", "%s", "%s"],
             "team_numbers": [1,1,2,2], "slot_numbers": [1,2,1,2]}',
      v_first_id,
      'f1000000-0000-4000-8000-000000000001', 'f1000000-0000-4000-8000-000000000002',
      'f1000000-0000-4000-8000-000000000003', 'f1000000-0000-4000-8000-000000000005')
  );

  perform pg_temp.pb_refuses(
    'not checked in', 'a player who is not checked in cannot be added',
    'update_lineup_players',
    format('{"match_id": "%s", "player_ids": ["%s", "%s", "%s", "%s"],
             "team_numbers": [1,1,2,2], "slot_numbers": [1,2,1,2]}',
      v_first_id,
      'f1000000-0000-4000-8000-000000000001', 'f1000000-0000-4000-8000-000000000002',
      'f1000000-0000-4000-8000-000000000003', 'f1000000-0000-4000-8000-00000000000d')
  );

  perform pg_temp.pb_refuses(
    'not on this club roster', 'a player from another club cannot be added',
    'update_lineup_players',
    format('{"match_id": "%s", "player_ids": ["%s", "%s", "%s", "%s"],
             "team_numbers": [1,1,2,2], "slot_numbers": [1,2,1,2]}',
      v_first_id,
      'f1000000-0000-4000-8000-000000000001', 'f1000000-0000-4000-8000-000000000002',
      'f1000000-0000-4000-8000-000000000003', 'f9000000-0000-4000-8000-000000000001')
  );

  perform pg_temp.pb_refuses(
    'cannot share the same team and slot', 'two players cannot share one team and slot',
    'update_lineup_players',
    format('{"match_id": "%s", "player_ids": ["%s", "%s", "%s", "%s"],
             "team_numbers": [1,1,2,2], "slot_numbers": [1,1,1,2]}',
      v_first_id,
      'f1000000-0000-4000-8000-000000000001', 'f1000000-0000-4000-8000-000000000002',
      'f1000000-0000-4000-8000-000000000003', 'f1000000-0000-4000-8000-000000000009')
  );

  perform pg_temp.pb_refuses(
    'Each player needs a team and a slot', 'every player needs a team and a slot',
    'update_lineup_players',
    format('{"match_id": "%s", "player_ids": ["%s", "%s"],
             "team_numbers": [1], "slot_numbers": [1]}',
      v_first_id,
      'f1000000-0000-4000-8000-000000000001', 'f1000000-0000-4000-8000-000000000002')
  );

  -- A short lineup is a legal intermediate state: the organizer needs to be
  -- able to take somebody off first. It simply cannot advance.
  v_raised := null;
  begin
    perform public.update_lineup_players(
      p_match_id => v_first_id,
      p_player_ids => array[
        'f1000000-0000-4000-8000-000000000001', 'f1000000-0000-4000-8000-000000000002',
        'f1000000-0000-4000-8000-000000000003'
      ]::uuid[],
      p_team_numbers => array[1, 1, 2]::smallint[],
      p_slot_numbers => array[1, 2, 1]::smallint[]
    );
  exception when others then v_raised := sqlerrm;
  end;
  perform pg_temp.pb_assert(
    v_raised is null
    and (select count(*) = 3 from public.match_players where match_id = v_first_id),
    'a lineup can be left short while the organizer edits it'
  );

  -- This lineup is on a court, so Start is the transition it has to refuse.
  -- Promotion is not reachable from here; that path is covered in section 4 by
  -- a lineup that is still in Preparation.
  v_raised := null;
  begin
    perform public.start_match(v_first_id);
  exception when others then v_raised := sqlerrm;
  end;
  perform pg_temp.pb_assert(
    v_raised is not null and v_raised like '%exactly 4%',
    'a doubles lineup of three players cannot be started'
  );

  perform pg_temp.pb_assert(
    (select status from public.matches where id = v_first_id) = 'staged'
    and (select started_at is null from public.matches where id = v_first_id),
    'the refused start left the lineup staged with no clock running'
  );
end $$;

-- ===========================================================================
-- 6. Players cannot be changed once the game is under way
-- ===========================================================================

do $$
declare
  v_session uuid := 'f0000000-0000-4000-8000-000000000001';
  v_first_id uuid;
  v_court_one uuid;
  v_raised text;
begin
  select id into v_first_id from public.matches
  where session_id = v_session and status = 'staged';
  select id into v_court_one from public.courts
  where session_id = v_session and court_number = 1;

  -- Put it back to four before starting.
  perform public.update_lineup_players(
    p_match_id => v_first_id,
    p_player_ids => array[
      'f1000000-0000-4000-8000-000000000001', 'f1000000-0000-4000-8000-000000000002',
      'f1000000-0000-4000-8000-000000000003', 'f1000000-0000-4000-8000-00000000000b'
    ]::uuid[],
    p_team_numbers => array[1, 1, 2, 2]::smallint[],
    p_slot_numbers => array[1, 2, 1, 2]::smallint[]
  );

  perform public.start_match(v_first_id);

  v_raised := null;
  begin
    perform public.update_lineup_players(
      p_match_id => v_first_id,
      p_player_ids => array[
        'f1000000-0000-4000-8000-000000000001', 'f1000000-0000-4000-8000-000000000002',
        'f1000000-0000-4000-8000-000000000003', 'f1000000-0000-4000-8000-00000000000c'
      ]::uuid[],
      p_team_numbers => array[1, 1, 2, 2]::smallint[],
      p_slot_numbers => array[1, 2, 1, 2]::smallint[]
    );
  exception when others then v_raised := sqlerrm;
  end;
  perform pg_temp.pb_assert(
    v_raised is not null and v_raised like '%before a game starts%',
    'an active match cannot have its players changed'
  );

  perform pg_temp.pb_assert(
    (select count(*) = 4 from public.match_players where match_id = v_first_id)
    and exists (select 1 from public.match_players
                where match_id = v_first_id
                  and player_id = 'f1000000-0000-4000-8000-00000000000b'),
    'the refused edit left the running lineup untouched'
  );

  v_raised := null;
  begin
    perform public.promote_preparation_match(v_first_id);
  exception when others then v_raised := sqlerrm;
  end;
  perform pg_temp.pb_assert(
    v_raised is not null,
    'a playing match cannot be pushed back through the lineup stages'
  );

  perform public.complete_match(v_first_id, 11, 7);

  v_raised := null;
  begin
    perform public.update_lineup_players(
      p_match_id => v_first_id,
      p_player_ids => array[
        'f1000000-0000-4000-8000-000000000001', 'f1000000-0000-4000-8000-000000000002',
        'f1000000-0000-4000-8000-000000000003', 'f1000000-0000-4000-8000-00000000000c'
      ]::uuid[],
      p_team_numbers => array[1, 1, 2, 2]::smallint[],
      p_slot_numbers => array[1, 2, 1, 2]::smallint[]
    );
  exception when others then v_raised := sqlerrm;
  end;
  perform pg_temp.pb_assert(
    v_raised is not null,
    'a completed match cannot have its players changed'
  );

  perform pg_temp.pb_assert(
    (select status from public.courts where id = v_court_one) = 'available'
    and exists (select 1 from public.session_players
                where session_id = v_session
                  and attendance_status = 'waiting'
                  and queue_position is not null),
    'finishing the game returns the court and the players to the rotation'
  );
end $$;

-- ===========================================================================
-- 7. Cancelling a lineup
-- ===========================================================================

do $$
declare
  v_session uuid := 'f0000000-0000-4000-8000-000000000001';
  v_up_next_id uuid;
  v_court_two uuid;
  v_staged_id uuid;
  v_raised text;
begin
  select id into v_up_next_id from public.matches
  where session_id = v_session and status = 'up_next';
  select id into v_court_two from public.courts
  where session_id = v_session and court_number = 2;

  -- The Up Next lineup came from players 5-8, who each gave up slots 5-8.
  perform public.cancel_lineup(v_up_next_id, 'organizer changed their mind');

  perform pg_temp.pb_assert(
    (select status from public.matches where id = v_up_next_id) = 'cancelled'
    and (select count(*) = 4 from public.match_players
         where match_id = v_up_next_id and result = 'cancelled'),
    'cancelling a lineup records every player as released'
  );

  perform pg_temp.pb_assert(
    (select queue_position from public.session_players
     where session_id = v_session and player_id = 'f1000000-0000-4000-8000-000000000005') = 5
    and (select queue_position from public.session_players
         where session_id = v_session and player_id = 'f1000000-0000-4000-8000-000000000006') = 6
    and (select queue_position from public.session_players
         where session_id = v_session and player_id = 'f1000000-0000-4000-8000-000000000007') = 7
    and (select queue_position from public.session_players
         where session_id = v_session and player_id = 'f1000000-0000-4000-8000-000000000008') = 8,
    'cancelled players land back on the slots they held before the lineup'
  );

  perform pg_temp.pb_assert(
    not exists (
      select 1 from public.matches
      where session_id = v_session and status = 'up_next'
    ),
    'cancelling the only Up Next lineup leaves the pipeline with no head'
  );

  -- They are selectable again, which is the point of setting result.
  perform public.create_preparation_lineup(
    p_session_id => v_session,
    p_player_ids => array[
      'f1000000-0000-4000-8000-000000000005', 'f1000000-0000-4000-8000-000000000006',
      'f1000000-0000-4000-8000-000000000007', 'f1000000-0000-4000-8000-000000000008'
    ]::uuid[],
    p_team_numbers => array[1, 1, 2, 2]::smallint[],
    p_explanation => 'replacement',
    p_matching_mode => 'balanced'
  );

  perform pg_temp.pb_assert(
    (select count(*) = 1 from public.matches
     where session_id = v_session and status = 'up_next'),
    'the next generated lineup is promoted once the Up Next slot is free'
  );

  -- Cancelling a lineup that already has a court gives the court back.
  select id into v_staged_id from public.matches
  where session_id = v_session and status = 'up_next';

  perform public.assign_lineup_to_court(v_staged_id, v_court_two);
  perform pg_temp.pb_assert(
    (select status from public.courts where id = v_court_two) = 'staged',
    'the replacement lineup can take the free court'
  );

  perform public.cancel_lineup(v_staged_id, 'nobody turned up');
  perform pg_temp.pb_assert(
    (select status from public.courts where id = v_court_two) = 'available',
    'cancelling a staged lineup returns its court to service'
  );

  v_raised := null;
  begin
    perform public.cancel_lineup(v_staged_id);
  exception when others then v_raised := sqlerrm;
  end;
  perform pg_temp.pb_assert(
    v_raised is not null and v_raised like '%already finished%',
    'a cancelled lineup cannot be cancelled again'
  );
end $$;

-- ===========================================================================
-- 8. Singles needs exactly two players
-- ===========================================================================

do $$
declare
  v_session uuid := 'f0000000-0000-4000-8000-000000000003';
  v_lineup_id uuid;
  v_court uuid;
  v_raised text;
begin
  -- In singles each side is one player, so the two players sit on team 1 and
-- team 2 rather than sharing a team.
perform public.create_preparation_lineup(
    p_session_id => v_session,
    p_player_ids => array['f3000000-0000-4000-8000-000000000001', 'f3000000-0000-4000-8000-000000000002']::uuid[],
    p_team_numbers => array[1, 2]::smallint[],
    p_explanation => 'first pair',
    p_matching_mode => 'balanced'
  );

  perform pg_temp.pb_assert(
    (select status from public.matches where session_id = v_session and status = 'up_next') = 'up_next'
    and (select count(*) = 2 from public.match_players mp
         join public.matches m on m.id = mp.match_id
         where m.session_id = v_session and m.status = 'up_next'),
    'a singles session promotes a two-player lineup'
  );

  -- A second pair may still be built; it waits in Preparation, exactly as a
  -- doubles second lineup does. Only the Up Next slot is limited to one.
  perform public.create_preparation_lineup(
    p_session_id => v_session,
    p_player_ids => array[
      'f3000000-0000-4000-8000-000000000003', 'f3000000-0000-4000-8000-000000000004'
    ]::uuid[],
    p_team_numbers => array[1, 2]::smallint[],
    p_explanation => 'second pair',
    p_matching_mode => 'balanced'
  );

  perform pg_temp.pb_assert(
    (select count(*) = 1 from public.matches
     where session_id = v_session and status = 'up_next')
    and (select count(*) = 1 from public.matches
         where session_id = v_session and status = 'preparing'),
    'a second singles lineup waits in Preparation without displacing the first'
  );

  -- A four-player lineup must still be refused outright, not merely trimmed.
  select id into v_lineup_id from public.matches
  where session_id = v_session and status = 'up_next';
  select id into v_court from public.courts where session_id = v_session;

  v_raised := null;
  begin
    perform public.create_preparation_lineup(
      p_session_id => v_session,
      p_player_ids => array[
        'f3000000-0000-4000-8000-000000000003', 'f3000000-0000-4000-8000-000000000004',
        'f3000000-0000-4000-8000-000000000001', 'f3000000-0000-4000-8000-000000000002'
      ]::uuid[],
      p_team_numbers => array[1, 1, 2, 2]::smallint[],
      p_explanation => 'too many',
      p_matching_mode => 'balanced'
    );
  exception when others then v_raised := sqlerrm;
  end;
  perform pg_temp.pb_assert(
    v_raised is not null and v_raised like '%exactly 2%',
    'a singles session refuses a four-player lineup'
  );

  -- A lineup of one cannot advance either.
  perform public.update_lineup_players(
    p_match_id => v_lineup_id,
    p_player_ids => array['f3000000-0000-4000-8000-000000000001']::uuid[],
    p_team_numbers => array[1]::smallint[],
    p_slot_numbers => array[1]::smallint[]
  );

  v_raised := null;
  begin
    perform public.assign_lineup_to_court(v_lineup_id, v_court);
  exception when others then v_raised := sqlerrm;
  end;
  perform pg_temp.pb_assert(
    v_raised is not null and v_raised like '%exactly 2%',
    'a singles lineup of one player cannot be sent to a court'
  );
end $$;

-- ===========================================================================
-- 9. The public board shows Preparation and Up Next, with real names
-- ===========================================================================

do $$
declare
  v_session uuid := 'f0000000-0000-4000-8000-000000000004';
  v_token uuid;
  v_board jsonb;
  v_up_next jsonb;
  v_preparation jsonb;
begin
  update public.sessions
  set status = 'active',
      is_public = true,
      player_live_enabled = true,
      public_live_token = gen_random_uuid()
  where id = v_session
  returning public_live_token into v_token;

  -- Carried across the role switch below through a GUC, because the token is
  -- only readable by an organizer and the next block reads it as anon.
  perform set_config('pb.lineup_test_token', v_token::text, false);

  perform public.create_preparation_lineup(
    p_session_id => v_session,
    p_player_ids => array[
      'f4000000-0000-4000-8000-000000000001', 'f4000000-0000-4000-8000-000000000002',
      'f4000000-0000-4000-8000-000000000003', 'f4000000-0000-4000-8000-000000000004'
    ]::uuid[],
    p_team_numbers => array[1, 1, 2, 2]::smallint[],
    p_explanation => 'up next fixture',
    p_matching_mode => 'balanced'
  );

  perform public.create_preparation_lineup(
    p_session_id => v_session,
    p_player_ids => array[
      'f4000000-0000-4000-8000-000000000005', 'f4000000-0000-4000-8000-000000000006',
      'f4000000-0000-4000-8000-000000000007', 'f4000000-0000-4000-8000-000000000008'
    ]::uuid[],
    p_team_numbers => array[1, 1, 2, 2]::smallint[],
    p_explanation => 'preparation fixture',
    p_matching_mode => 'balanced'
  );

  v_board := public.get_player_live_board(v_token);
  v_up_next := v_board -> 'up_next';
  v_preparation := v_board -> 'preparation';

  perform pg_temp.pb_assert(
    v_board ? 'up_next' and v_board ? 'preparation',
    'the anonymous board payload has a separate section per lineup stage'
  );

  perform pg_temp.pb_assert(
    jsonb_array_length(v_up_next) = 1 and jsonb_array_length(v_preparation) = 1,
    'each stage lists exactly the lineups actually in it'
  );

  perform pg_temp.pb_assert(
    (v_up_next -> 0 ->> 'display_name') = 'Match 1'
    and (v_up_next -> 0 ->> 'stage') = 'up_next',
    'the Up Next section reports its stage and a readable name'
  );

  perform pg_temp.pb_assert(
    (v_preparation -> 0 ->> 'display_name') = 'Match 2'
    and (v_preparation -> 0 ->> 'stage') = 'preparing',
    'the Preparation section reports its stage and a readable name'
  );

  -- The reason the board exists: names, not slot numbers.
  perform pg_temp.pb_assert(
    (select array_agg(
       player ->> 'display_name'
       order by (player ->> 'team_number')::int, (player ->> 'slot_number')::int)
     from jsonb_array_elements(v_up_next -> 0 -> 'players') player)
      = array['Board One', 'Board Two', 'Board Three', 'Board Four'],
    'the Up Next section carries all four real names in slot order'
  );

  perform pg_temp.pb_assert(
    (select array_agg(
       player ->> 'display_name'
       order by (player ->> 'team_number')::int, (player ->> 'slot_number')::int)
     from jsonb_array_elements(v_preparation -> 0 -> 'players') player)
      = array['Board Five', 'Board Six', 'Board Seven', 'Board Eight'],
    'the Preparation section carries all four real names in slot order'
  );

  perform pg_temp.pb_assert(
    (select bool_and(
       player ? 'lineup_id'
       and (player ->> 'skill_level')::int between 1 and 6
       and (player ->> 'team_number')::int between 1 and 2
       and (player ->> 'slot_number')::int between 1 and 2)
     from jsonb_array_elements(v_up_next -> 0 -> 'players') player)
    and (select count(distinct player ->> 'lineup_id')
       from jsonb_array_elements(v_up_next -> 0 -> 'players') player) = 4,
    'every queued lineup player has a unique stable key, a level, and a team and slot'
  );

  perform pg_temp.pb_assert(
    (v_up_next -> 0 ? 'match_number')
    and (v_up_next -> 0 ? 'prepared_at')
    and (v_up_next -> 0 ? 'matching_mode'),
    'each queued lineup carries a number, a prepared time, and the mode that built it'
  );

  perform pg_temp.pb_assert(
    not (v_up_next -> 0 ? 'court_number')
    and not (v_up_next -> 0 ? 'court_id'),
    'a queued lineup advertises no court, which is what players need to know'
  );

  -- Scoped to the two new sections. The board's existing presence block already
-- publishes last_enqueued_at deliberately (it is what the waiting queue shows),
-- so the check here is that the lineup sections add nothing of that sort.
  perform pg_temp.pb_assert(
    (v_up_next::text || v_preparation::text)
      !~* 'user_id|raw_user_meta_data|recovery|public_live_token|"email"|last_enqueued_at|checked_in_at|queue_position',
    'the lineup sections expose no auth, email, capability, or queue-timing data'
  );
end $$;

set local role anon;
do $$
declare
  v_board jsonb;
  v_raised text;
begin
  v_board := public.get_player_live_board(current_setting('pb.lineup_test_token')::uuid);

  perform pg_temp.pb_assert(
    v_board is not null,
    'the scanned token opens the board with no login'
  );

  perform pg_temp.pb_assert(
    jsonb_array_length(v_board -> 'up_next') = 1
    and jsonb_array_length(v_board -> 'preparation') = 1,
    'an anonymous player sees both queued lineups without signing in'
  );

  perform pg_temp.pb_assert(
    (v_board -> 'up_next' -> 0 -> 'players' -> 0 ->> 'display_name') = 'Board One',
    'an anonymous player sees the real names, not slot placeholders'
  );

  -- Reading the board must not be a way to change it.
  v_raised := null;
  begin
    perform public.create_preparation_lineup(
      'f0000000-0000-4000-8000-000000000004',
      array[
        'f4000000-0000-4000-8000-000000000001', 'f4000000-0000-4000-8000-000000000002',
        'f4000000-0000-4000-8000-000000000003', 'f4000000-0000-4000-8000-000000000004'
      ],
      array[1, 1, 2, 2]::smallint[]
    );
  exception when others then v_raised := sqlerrm;
  end;
  perform pg_temp.pb_assert(v_raised is not null, 'a spectator cannot create a lineup');

  v_raised := null;
  begin
    perform public.promote_preparation_match(
      (select id from public.matches where session_id = 'f0000000-0000-4000-8000-000000000004' limit 1)
    );
  exception when others then v_raised := sqlerrm;
  end;
  perform pg_temp.pb_assert(v_raised is not null, 'a spectator cannot promote a lineup');

  v_raised := null;
  begin
    perform public.demote_up_next_match(
      (select id from public.matches where session_id = 'f0000000-0000-4000-8000-000000000004' limit 1)
    );
  exception when others then v_raised := sqlerrm;
  end;
  perform pg_temp.pb_assert(v_raised is not null, 'a spectator cannot return a lineup to Preparation');

  v_raised := null;
  begin
    perform public.assign_lineup_to_court(
      (select id from public.matches where session_id = 'f0000000-0000-4000-8000-000000000004' limit 1),
      (select id from public.courts where session_id = 'f0000000-0000-4000-8000-000000000004' limit 1)
    );
  exception when others then v_raised := sqlerrm;
  end;
  perform pg_temp.pb_assert(v_raised is not null, 'a spectator cannot assign a court');

  v_raised := null;
  begin
    perform public.update_lineup_players(
      (select id from public.matches where session_id = 'f0000000-0000-4000-8000-000000000004' limit 1),
      array[
        'f4000000-0000-4000-8000-000000000001', 'f4000000-0000-4000-8000-000000000002',
        'f4000000-0000-4000-8000-000000000003', 'f4000000-0000-4000-8000-000000000005'
      ],
      array[1, 1, 2, 2]::smallint[],
      array[1, 2, 1, 2]::smallint[]
    );
  exception when others then v_raised := sqlerrm;
  end;
  perform pg_temp.pb_assert(v_raised is not null, 'a spectator cannot edit a lineup');

  v_raised := null;
  begin
    perform public.cancel_lineup(
      (select id from public.matches where session_id = 'f0000000-0000-4000-8000-000000000004' limit 1)
    );
  exception when others then v_raised := sqlerrm;
  end;
  perform pg_temp.pb_assert(v_raised is not null, 'a spectator cannot cancel a lineup');
end $$;

-- A signed-in club member who is not an organizer is refused too: the check is
-- the club role, not whether there happens to be a session cookie.
reset role;
select set_config('request.jwt.claims', '{"sub":"33333333-3333-4333-8333-333333333333","role":"authenticated"}', true);

do $$
declare
  v_raised text;
begin
  v_raised := null;
  begin
    perform public.create_preparation_lineup(
      'f0000000-0000-4000-8000-000000000004',
      array[
        'f4000000-0000-4000-8000-000000000001', 'f4000000-0000-4000-8000-000000000002',
        'f4000000-0000-4000-8000-000000000003', 'f4000000-0000-4000-8000-000000000004'
      ],
      array[1, 1, 2, 2]::smallint[]
    );
  exception when others then v_raised := sqlerrm;
  end;
  perform pg_temp.pb_assert(v_raised is not null, 'a club member who is not an organizer cannot create a lineup');

  v_raised := null;
  begin
    perform public.assign_lineup_to_court(
      (select id from public.matches where session_id = 'f0000000-0000-4000-8000-000000000004' limit 1),
      (select id from public.courts where session_id = 'f0000000-0000-4000-8000-000000000004' limit 1)
    );
  exception when others then v_raised := sqlerrm;
  end;
  perform pg_temp.pb_assert(v_raised is not null, 'a club member who is not an organizer cannot assign a court');

  -- Reading is still allowed: the board is what the club's own players look at.
  perform pg_temp.pb_assert(
    public.get_player_live_board(current_setting('pb.lineup_test_token')::uuid) is not null,
    'a club member can still read the board they are meant to follow'
  );
end $$;

reset role;

-- ===========================================================================
-- 10. Ending a session releases every new lineup stage atomically
-- ===========================================================================

select set_config('request.jwt.claims', '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}', true);

do $$
declare
  v_session uuid := 'f0000000-0000-4000-8000-000000000004';
  v_first uuid;
  v_court uuid;
  v_raised text;
  v_token uuid;
  v_board jsonb;
begin
  -- The first two lineups already exist from the public-board assertions. A
  -- third stays in Preparation after the current Up Next lineup takes a court.
  perform public.create_preparation_lineup(
    p_session_id => v_session,
    p_player_ids => array[
      'f4000000-0000-4000-8000-000000000009', 'f4000000-0000-4000-8000-00000000000a',
      'f4000000-0000-4000-8000-00000000000b', 'f4000000-0000-4000-8000-00000000000c'
    ]::uuid[],
    p_team_numbers => array[1, 1, 2, 2]::smallint[],
    p_explanation => 'forced end fixture',
    p_matching_mode => 'balanced'
  );

  select id into v_first from public.matches
  where session_id = v_session and status = 'up_next';
  select id into v_court from public.courts
  where session_id = v_session order by court_number limit 1;

  perform public.assign_lineup_to_court(v_first, v_court);

  perform pg_temp.pb_assert(
    (select array_agg(status::text order by status::text)
     from public.matches where session_id = v_session)
      = array['preparing', 'staged', 'up_next'],
    'the end-session fixture has Preparation, Up Next, and staged lineups open together'
  );

  begin
    perform public.end_session(v_session, false);
  exception when others then v_raised := sqlerrm;
  end;
  perform pg_temp.pb_assert(
    v_raised is not null and v_raised like '%3 lineup(s) are still open%',
    'ending normally refuses while any lineup stage is open'
  );

  select public_live_token into v_token from public.sessions where id = v_session;
  perform public.end_session(v_session, true);

  perform pg_temp.pb_assert(
    exists (select 1 from public.sessions
            where id = v_session and status = 'completed' and ended_at is not null),
    'forcing session end completes the session and stamps its end'
  );
  perform pg_temp.pb_assert(
    (select count(*) = 3 and bool_and(status = 'cancelled')
     from public.matches where session_id = v_session),
    'forcing session end cancels Preparation, Up Next, and staged lineups'
  );
  perform pg_temp.pb_assert(
    (select count(*) = 12 and bool_and(result = 'cancelled')
     from public.match_players where session_id = v_session),
    'forcing session end resolves every reserved lineup row as cancelled'
  );
  perform pg_temp.pb_assert(
    (select count(*) = 12
       and count(distinct queue_position) = 12
       and bool_and(attendance_status = 'waiting')
     from public.session_players where session_id = v_session),
    'forcing session end returns every reserved player to a unique queue slot'
  );
  perform pg_temp.pb_assert(
    exists (select 1 from public.courts
            where id = v_court and status = 'available'),
    'forcing session end releases a court held by a staged lineup'
  );

  v_board := public.get_player_live_board(v_token);
  perform pg_temp.pb_assert(
    (v_board -> 'session' ->> 'status') = 'completed'
      and jsonb_array_length(v_board -> 'up_next') = 0
      and jsonb_array_length(v_board -> 'preparation') = 0,
    'the scanned board shows final session state with no queued lineups after end'
  );
end $$;

rollback;

-- RAISE only exists inside plpgsql, so the closing notice needs a DO block.
do $$
begin
  raise notice 'All lineup stage assertions passed. Fixtures rolled back.';
end $$;
