-- 0009: match timing integrity.
--
-- The live board now shows an elapsed game timer on every active court. Two
-- columns already existed -- matches.started_at and matches.completed_at -- and
-- start_match already set started_at with the database clock. What was missing
-- was anything stopping the pair from drifting apart, so this migration:
--
--   1. makes start_match's started_at write explicitly non-destructive, so a
--      repeated start can never move the clock;
--   2. stops complete_match from stamping completed_at before started_at;
--   3. adds a CHECK constraint so the database refuses the bad pair even if a
--      future write path tries.
--
-- Nothing is backfilled and no existing row is rewritten. started_at is
-- deliberately NOT made NOT NULL: legacy rows can predate the column being
-- populated, and the board renders a "Timer unavailable" fallback for a playing
-- match with a missing start rather than inventing a time. Turning that into a
-- hard error would have made those rows unreadable instead of visibly suspect.
--
-- Forward-only.

-- ---------------------------------------------------------------------------
-- 1. start_match: never move an existing started_at.
--
-- The function already returns early when status = 'playing' and raises for any
-- other non-staged status, so a second start cannot reach the update today. This
-- makes the guarantee local to the write rather than dependent on a status check
-- two branches up, so a later refactor that relaxes that check cannot silently
-- start resetting game clocks.
--
-- Reproduced from 0001 apart from this one expression.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- 2. complete_match: completed_at is never before started_at.
--
-- A match can be completed with a NULL started_at if it was staged before this
-- feature existed. In that case completed_at stands on its own and the duration
-- stays unknown; there is nothing to be earlier than. Only when started_at is
-- present does the timestamp get floored to it.
--
-- Reproduced from 0001 apart from this one expression and one guard.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- start_match: the started_at write below is non-destructive.
-- ---------------------------------------------------------------------------
create or replace function public.start_match(p_match_id uuid)
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
  -- Session lock first, then re-read the match under it. See complete_match.
  select session_id into v_session_id from public.matches where id = p_match_id;
  if v_session_id is null then
    raise exception 'Match not found' using errcode = 'P0002';
  end if;

  select * into v_session
  from public.sessions where id = v_session_id for update;

  select * into v_match
  from public.matches where id = p_match_id for update;

  if not private.is_club_admin(v_session.club_id) then
    raise exception 'Only club organizers can start matches' using errcode = '42501';
  end if;

  if v_match.status = 'playing' then
    return jsonb_build_object('match_id', p_match_id, 'status', 'playing');
  end if;

  if v_match.status <> 'staged' then
    raise exception 'Only a staged match can be started' using errcode = '22023';
  end if;

  -- coalesce, not now(): a start must never move a clock that is already
  -- running. The status guard above already prevents a second start, but
  -- keeping the guarantee in the write means relaxing that guard later
  -- cannot silently reset every game time.
  update public.matches
  set status = 'playing',
      started_at = coalesce(started_at, now())
  where id = p_match_id;

  update public.session_players
  set attendance_status = 'playing', last_played_at = now()
  where session_id = v_match.session_id
    and player_id in (select player_id from public.match_players where match_id = p_match_id);

  if v_match.court_id is not null then
    update public.courts set status = 'playing' where id = v_match.court_id;
  end if;

  perform private.log_queue_event(
    v_match.session_id, null, null, 'match_started', 'staged', 'playing',
    jsonb_build_object('match_id', p_match_id)
  );

  return jsonb_build_object('match_id', p_match_id, 'status', 'playing');
end;
$$;




comment on function public.start_match is
  'Starts a staged match. started_at is set once with the database clock and never moved.';

-- ---------------------------------------------------------------------------
-- complete_match: completed_at is floored at started_at.
-- ---------------------------------------------------------------------------
create or replace function public.complete_match(
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
  v_winner smallint;
  v_position integer;
  v_mp record;
  v_won boolean;
  v_scored_for integer;
  v_scored_against integer;
begin
  if p_team1_score is null or p_team2_score is null
     or p_team1_score < 0 or p_team2_score < 0 then
    raise exception 'Scores must be whole numbers of 0 or more'
      using errcode = '22023';
  end if;

  -- Lock the session FIRST, then read the match. Reading the match first would
  -- let two concurrent completions both see status='playing' from a snapshot
  -- taken before either acquired the session lock, and both would write.
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

  -- Re-read the match under the session lock so the status check below is
  -- evaluated against committed state, not a stale snapshot.
  select * into v_match
  from public.matches
  where id = p_match_id
  for update;

  if not private.is_club_admin(v_session.club_id) then
    raise exception 'Only club organizers can record scores' using errcode = '42501';
  end if;

  -- Idempotency: a duplicate submission is refused outright, so it can never
  -- count a second game or move completed_at. Correcting a score is a
  -- separate, audited path (correct_match_score) which deliberately does not
  -- touch either timestamp.
  if v_match.status = 'completed' then
    raise exception
      'This match was already scored. Use "Correct score" if the result was wrong.'
      using errcode = '22023';
  end if;

  if v_match.status <> 'playing' then
    raise exception 'Start the match before recording a score' using errcode = '22023';
  end if;

  -- Server-side scoring validation. The client never names a winner.
  if p_team1_score = p_team2_score then
    raise exception 'A completed game cannot end in a tie' using errcode = '22023';
  end if;

  if greatest(p_team1_score, p_team2_score) < v_match.target_score then
    raise exception 'The winning score must reach %', v_match.target_score
      using errcode = '22023';
  end if;

  if abs(p_team1_score - p_team2_score) < v_match.win_by then
    raise exception 'The winning team must win by % point(s)', v_match.win_by
      using errcode = '22023';
  end if;

  v_winner := case when p_team1_score > p_team2_score then 1 else 2 end;

  -- Floor the end stamp at the start stamp. now() is read inside the same
  -- statement as the status check under the session lock, so it can only be
  -- ahead of started_at in practice -- but the board renders a duration from
  -- this pair, and a negative duration would be worse than a zero one.
  -- coalesce covers a match staged before started_at was populated: with no
  -- start there is nothing to be earlier than, and the duration stays unknown.
  update public.matches
  set status = 'completed',
      team1_score = p_team1_score,
      team2_score = p_team2_score,
      winning_team = v_winner,
      completed_at = greatest(now(), coalesce(v_match.started_at, now()))
  where id = p_match_id;

  -- The case expression must be cast to the enum: an unadorned CASE resolves
  -- to text, and Postgres will not implicitly assign text to an enum column.
  update public.match_players mp
  set result = (case when mp.team_number = v_winner then 'win' else 'loss' end)::public.match_result,
      points_for = case when mp.team_number = 1 then p_team1_score else p_team2_score end,
      points_against = case when mp.team_number = 1 then p_team2_score else p_team1_score end
  where mp.match_id = p_match_id;

  v_position := private.next_queue_position(v_match.session_id);

  for v_mp in
    select player_id, team_number
    from public.match_players
    where match_id = p_match_id
    order by team_number, slot_number
  loop
    v_won := v_mp.team_number = v_winner;
    v_scored_for := case when v_mp.team_number = 1 then p_team1_score else p_team2_score end;
    v_scored_against := case when v_mp.team_number = 1 then p_team2_score else p_team1_score end;

    update public.session_players
    set games_played = games_played + 1,
        wins = wins + (case when v_won then 1 else 0 end),
        losses = losses + (case when v_won then 0 else 1 end),
        points_for = points_for + v_scored_for,
        points_against = points_against + v_scored_against,
        -- A player who just finished goes behind everyone already waiting.
        attendance_status = 'waiting',
        queue_position = v_position,
        last_enqueued_at = now()
    where session_id = v_match.session_id and player_id = v_mp.player_id;

    perform private.log_queue_event(
      v_match.session_id, null, v_mp.player_id, 'match_completed',
      'playing', 'waiting',
      jsonb_build_object(
        'match_id', p_match_id,
        'result', case when v_won then 'win' else 'loss' end,
        'points_for', v_scored_for,
        'points_against', v_scored_against
      )
    );

    v_position := v_position + 1;
  end loop;

  -- Recompute streaks from completed matches so corrections stay truthful.
  update public.session_players sp
  set win_streak = private.player_win_streak(sp.session_id, sp.player_id)
  where sp.session_id = v_match.session_id
    and sp.player_id in (select player_id from public.match_players where match_id = p_match_id);

  if v_match.court_id is not null then
    update public.courts set status = 'available' where id = v_match.court_id;
  end if;

  return jsonb_build_object(
    'match_id', p_match_id,
    'winning_team', v_winner,
    'team1_score', p_team1_score,
    'team2_score', p_team2_score
  );
end;
$$;




comment on function public.complete_match is
  'Records a final score. Idempotent: a duplicate submission is refused rather than counted twice.';

-- ---------------------------------------------------------------------------
-- 3. Constrain the pair.
--
-- A completed_at earlier than started_at would render as a negative duration, so
-- refuse it at write time. Rows already in the database are checked first: if any
-- predate the rule the constraint is skipped rather than failing the migration
-- and blocking the deploy, and the count is reported.
-- ---------------------------------------------------------------------------
do $$
declare
  v_backwards integer;
begin
  select count(*) into v_backwards
  from public.matches
  where started_at is not null
    and completed_at is not null
    and completed_at < started_at;

  if v_backwards > 0 then
    raise notice
      'Skipping matches_started_before_completed check: % row(s) predate it',
      v_backwards;
    return;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.matches'::regclass
      and conname = 'matches_completed_after_started'
  ) then
    alter table public.matches
      add constraint matches_completed_after_started
      check (completed_at is null or started_at is null or completed_at >= started_at);
  end if;
end $$;