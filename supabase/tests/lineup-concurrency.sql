-- True two-connection race for the one-Up-Next invariant.
--
-- Unlike the transactional suites, these fixtures have to commit before the two
-- dblink connections can see them. The auth user is deleted at the end, which
-- cascades through the club and every fixture row.

create extension if not exists dblink;

reset role;
select set_config(
  'request.jwt.claims',
  '{"sub":"c1111111-1111-4111-8111-111111111111","role":"authenticated"}',
  false
);

insert into auth.users (id, email) values
  ('c1111111-1111-4111-8111-111111111111', 'lineup-race@example.test');

insert into public.clubs (id, name, slug, is_public, created_by) values
  ('caaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Lineup Race Club', 'lineup-race-club', false,
   'c1111111-1111-4111-8111-111111111111');

insert into public.club_members (club_id, user_id, role) values
  ('caaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'c1111111-1111-4111-8111-111111111111', 'owner');

insert into public.sessions (
  id, club_id, name, status, format, matching_mode, court_count, created_by
) values (
  'c0000000-0000-4000-8000-000000000001',
  'caaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'Concurrent Promotion', 'draft', 'doubles', 'fifo', 1,
  'c1111111-1111-4111-8111-111111111111'
);

insert into public.players (id, club_id, display_name, skill_level) values
  ('c1000000-0000-4000-8000-000000000001', 'caaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Race One', 3),
  ('c1000000-0000-4000-8000-000000000002', 'caaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Race Two', 3),
  ('c1000000-0000-4000-8000-000000000003', 'caaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Race Three', 3),
  ('c1000000-0000-4000-8000-000000000004', 'caaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Race Four', 3),
  ('c1000000-0000-4000-8000-000000000005', 'caaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Race Five', 3),
  ('c1000000-0000-4000-8000-000000000006', 'caaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Race Six', 3),
  ('c1000000-0000-4000-8000-000000000007', 'caaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Race Seven', 3),
  ('c1000000-0000-4000-8000-000000000008', 'caaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Race Eight', 3);

insert into public.session_players (session_id, player_id)
select 'c0000000-0000-4000-8000-000000000001', id
from public.players where club_id = 'caaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

do $$
declare
  v_player uuid;
  v_first uuid;
begin
  for v_player in
    select id from public.players
    where club_id = 'caaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
    order by id
  loop
    perform public.check_in_player('c0000000-0000-4000-8000-000000000001', v_player);
  end loop;
  perform public.start_session('c0000000-0000-4000-8000-000000000001');

  perform public.create_preparation_lineup(
    'c0000000-0000-4000-8000-000000000001',
    array[
      'c1000000-0000-4000-8000-000000000001', 'c1000000-0000-4000-8000-000000000002',
      'c1000000-0000-4000-8000-000000000003', 'c1000000-0000-4000-8000-000000000004'
    ]::uuid[],
    array[1, 1, 2, 2]::smallint[]
  );
  perform public.create_preparation_lineup(
    'c0000000-0000-4000-8000-000000000001',
    array[
      'c1000000-0000-4000-8000-000000000005', 'c1000000-0000-4000-8000-000000000006',
      'c1000000-0000-4000-8000-000000000007', 'c1000000-0000-4000-8000-000000000008'
    ]::uuid[],
    array[1, 1, 2, 2]::smallint[]
  );

  select id into v_first from public.matches
  where session_id = 'c0000000-0000-4000-8000-000000000001'
    and status = 'up_next';
  perform public.demote_up_next_match(v_first);
end $$;

-- The helper catches the expected loser inside the remote connection, allowing
-- this controlling connection to inspect both outcomes. Sleeping after the RPC
-- keeps the winner's transaction and session-row lock open while the other RPC
-- reaches the same lock.
create or replace function private.pb_test_race_promote(
  p_user_id uuid,
  p_match_id uuid,
  p_delay_seconds double precision
)
returns text
language plpgsql
set search_path = public, private, pg_temp
as $$
begin
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', p_user_id, 'role', 'authenticated')::text,
    true
  );
  begin
    perform public.promote_preparation_match(p_match_id);
    perform pg_sleep(p_delay_seconds);
    return 'ok';
  exception when others then
    return 'error: ' || sqlerrm;
  end;
end;
$$;

do $$
declare
  v_connection text := format(
    'host=127.0.0.1 port=%s dbname=%I user=%I',
    current_setting('port'), current_database(), current_user
  );
  v_first uuid;
  v_second uuid;
  v_a text;
  v_b text;
begin
  select id into v_first from public.matches
  where session_id = 'c0000000-0000-4000-8000-000000000001'
  order by match_number limit 1;
  select id into v_second from public.matches
  where session_id = 'c0000000-0000-4000-8000-000000000001'
  order by match_number offset 1 limit 1;

  perform dblink_connect('race_a', v_connection);
  perform dblink_connect('race_b', v_connection);
  perform dblink_send_query(
    'race_a',
    format(
      'select private.pb_test_race_promote(%L::uuid, %L::uuid, 0.5)',
      'c1111111-1111-4111-8111-111111111111', v_first
    )
  );
  perform dblink_send_query(
    'race_b',
    format(
      'select private.pb_test_race_promote(%L::uuid, %L::uuid, 0.5)',
      'c1111111-1111-4111-8111-111111111111', v_second
    )
  );

  select result into v_a from dblink_get_result('race_a') as t(result text);
  select result into v_b from dblink_get_result('race_b') as t(result text);
  perform dblink_disconnect('race_a');
  perform dblink_disconnect('race_b');

  if not (
    (v_a = 'ok' and v_b like 'error: Another lineup is already Up Next%')
    or (v_b = 'ok' and v_a like 'error: Another lineup is already Up Next%')
  ) then
    raise exception 'FAIL: concurrent promotions produced unexpected outcomes: %, %', v_a, v_b;
  end if;
  raise notice 'PASS: two concurrent promotions produce one winner and one state-aware refusal';

  if (select count(*) from public.matches
      where session_id = 'c0000000-0000-4000-8000-000000000001'
        and status = 'up_next') <> 1 then
    raise exception 'FAIL: the race left anything other than one Up Next lineup';
  end if;
  raise notice 'PASS: the session lock and unique index leave exactly one lineup Up Next';

  if (select count(*) from public.matches
      where session_id = 'c0000000-0000-4000-8000-000000000001'
        and status = 'preparing') <> 1 then
    raise exception 'FAIL: the losing concurrent lineup did not remain in Preparation';
  end if;
  raise notice 'PASS: the losing concurrent lineup remains safely in Preparation';
end $$;

drop function private.pb_test_race_promote(uuid, uuid, double precision);
-- Deleting the fixture user cascades through its club and session. Queue events
-- are intentionally append-only for application roles, so the local test
-- superuser temporarily lowers that guard only for fixture teardown.
alter table public.queue_events disable trigger trg_queue_events_append_only;
delete from auth.users where id = 'c1111111-1111-4111-8111-111111111111';
alter table public.queue_events enable trigger trg_queue_events_append_only;

do $$
begin
  raise notice 'All lineup concurrency assertions passed. Fixtures removed.';
end $$;
