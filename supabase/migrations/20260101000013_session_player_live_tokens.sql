-- Session-specific Player Live View capability tokens.
--
-- A high-entropy token is created inside the same transaction that starts the
-- session. It is stable across duplicate Start submissions and never appears in
-- the sanitized RPC response. Anonymous viewers receive one read-only JSON
-- payload assembled under explicit token/status checks; base-table RLS and
-- mutation grants remain unchanged.

alter table public.sessions
  add column if not exists public_live_token uuid,
  add column if not exists player_live_enabled boolean not null default false;

create unique index if not exists sessions_public_live_token_key
  on public.sessions (public_live_token)
  where public_live_token is not null;

comment on column public.sessions.public_live_token is
  'High-entropy capability token for /live/[publicToken]. Never returned in public board data.';
comment on column public.sessions.player_live_enabled is
  'Whether the token-scoped Player Live View may be resolved.';

-- Preserve already-running public boards when this migration reaches an
-- existing project. Draft sessions deliberately receive nothing.
update public.sessions
set public_live_token = coalesce(public_live_token, extensions.gen_random_uuid()),
    player_live_enabled = true
where status in ('active', 'completed')
  and is_public;

-- Anonymous Realtime authorization follows the explicitly enabled Player Live
-- View as well as the older is_public flag. Session ids are UUIDs and are only
-- returned after a valid token resolution.
create or replace function private.can_read_session(p_session_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.sessions s
    where s.id = p_session_id
      and (
        s.is_public
        or (
          s.player_live_enabled
          and s.status in ('active', 'completed')
        )
        or private.is_club_member(s.club_id)
        or auth.uid() = s.created_by
      )
  );
$$;

create or replace function public.start_session(p_session_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_session public.sessions%rowtype;
  v_checked_in integer;
  v_required integer;
  v_public_token uuid;
begin
  select * into v_session from public.sessions where id = p_session_id for update;
  if v_session.id is null then
    raise exception 'Session not found' using errcode = 'P0002';
  end if;

  if not private.is_club_admin(v_session.club_id) then
    raise exception 'Only club organizers can start a session' using errcode = '42501';
  end if;

  -- A browser can retry a form submission after the first transaction commits.
  -- Return the same capability rather than rotating it or failing the harmless
  -- retry. Completed/cancelled sessions still reject Start.
  if v_session.status = 'active' then
    update public.sessions
    set public_live_token = coalesce(public_live_token, extensions.gen_random_uuid()),
        player_live_enabled = true,
        started_at = coalesce(started_at, now())
    where id = p_session_id
    returning public_live_token into v_public_token;

    return jsonb_build_object(
      'session_id', p_session_id,
      'courts', v_session.court_count,
      'public_token', v_public_token
    );
  end if;

  if v_session.status <> 'draft' then
    raise exception 'Only a draft session can be started' using errcode = '22023';
  end if;

  v_required := case when v_session.format = 'singles' then 2 else 4 end;

  select count(*) into v_checked_in
  from public.session_players
  where session_id = p_session_id
    and attendance_status <> 'checked_out';

  if v_checked_in < v_required then
    raise exception
      'Check in at least % players before starting (currently % checked in).',
      v_required, v_checked_in
      using errcode = '22023';
  end if;

  insert into public.courts (session_id, court_number, ladder_position)
  select p_session_id, g, g
  from generate_series(1, v_session.court_count) g
  on conflict (session_id, court_number) do nothing;

  update public.sessions
  set status = 'active',
      started_at = coalesce(started_at, now()),
      public_live_token = coalesce(public_live_token, extensions.gen_random_uuid()),
      player_live_enabled = true
  where id = p_session_id
  returning public_live_token into v_public_token;

  return jsonb_build_object(
    'session_id', p_session_id,
    'courts', v_session.court_count,
    'public_token', v_public_token
  );
end;
$$;

-- A live-enabled session keeps the same token and publishes final results when
-- it ends. An organizer can still explicitly disable the Player Live View by
-- setting player_live_enabled false through a future administrative feature.
create or replace function public.end_session(
  p_session_id uuid,
  p_force boolean default false
)
returns void
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_session public.sessions%rowtype;
  v_open integer;
begin
  select * into v_session from public.sessions where id = p_session_id for update;
  if v_session.id is null then
    raise exception 'Session not found' using errcode = 'P0002';
  end if;
  if not private.is_club_admin(v_session.club_id) then
    raise exception 'Only club organizers can end a session' using errcode = '42501';
  end if;
  if v_session.status = 'completed' then return; end if;

  select count(*) into v_open from public.matches
  where session_id = p_session_id and status in ('staged', 'playing');
  if v_open > 0 and not p_force then
    raise exception
      '% match(es) are still staged or in play. Finish them first, or end anyway.',
      v_open using errcode = '22023';
  end if;
  if v_open > 0 then
    update public.matches set status = 'cancelled', updated_at = now()
    where session_id = p_session_id and status in ('staged', 'playing');
    update public.match_players set result = 'cancelled'
    where session_id = p_session_id and result is null;
    update public.courts set status = 'available'
    where session_id = p_session_id and status in ('staged', 'playing');
  end if;

  update public.sessions
  set status = 'completed',
      ended_at = now(),
      results_published = case
        when player_live_enabled or is_public then true
        else results_published
      end
  where id = p_session_id;
end;
$$;

-- One token-scoped, sanitized read. The payload intentionally uses surrogate
-- row ids only for stable React keys; no auth user id, membership, email, audit,
-- or private club setting can enter this object.
create or replace function public.get_player_live_board(p_public_token uuid)
returns jsonb
language sql
stable
security definer
set search_path = public, private, pg_temp
as $$
  with selected as (
    select s.*, c.name as club_name, c.slug as club_slug,
      c.location as club_location, c.logo_url as club_logo_url
    from public.sessions s
    join public.clubs c on c.id = s.club_id
    where s.public_live_token = p_public_token
      and (
        s.status = 'draft'
        or (s.player_live_enabled and s.status = 'active')
        or (
          s.player_live_enabled
          and s.status = 'completed'
          and s.results_published
        )
      )
    limit 1
  ), duration_stats as (
    select
      round(avg(extract(epoch from (m.completed_at - m.started_at))) / 60.0)::integer
        as avg_match_minutes,
      count(*)::integer as completed_match_count
    from public.matches m
    join selected s on s.id = m.session_id
    where m.status = 'completed'
      and m.started_at is not null
      and m.completed_at is not null
      and m.completed_at >= m.started_at
  )
  select jsonb_build_object(
    'session', jsonb_build_object(
      'id', s.id,
      'club_id', s.club_id,
      'name', s.name,
      'status', s.status,
      'format', s.format,
      'matching_mode', s.matching_mode,
      'target_score', s.target_score,
      'win_by', s.win_by,
      'court_count', s.court_count,
      'started_at', s.started_at,
      'ended_at', s.ended_at,
      'results_published', s.results_published,
      'club_slug', s.club_slug,
      'club_name', s.club_name,
      'club_location', s.club_location,
      'club_logo_url', s.club_logo_url,
      'avg_match_minutes', ds.avg_match_minutes,
      'completed_match_count', ds.completed_match_count,
      'player_live_enabled', s.player_live_enabled
    ),
    'courts', coalesce((
      select jsonb_agg(jsonb_build_object(
        'session_id', s.id,
        'club_id', s.club_id,
        'court_number', c.court_number,
        'court_name', c.name,
        'court_status', c.status,
        'ladder_position', c.ladder_position,
        'match_status', m.status,
        'winning_team', m.winning_team,
        'target_score', m.target_score,
        'match_started_at', m.started_at,
        'match_completed_at', m.completed_at,
        'team1_score', m.team1_score,
        'team2_score', m.team2_score
      ) order by c.ladder_position, c.court_number)
      from public.courts c
      left join lateral (
        select mx.* from public.matches mx
        where mx.court_id = c.id and mx.status in ('staged', 'playing')
        order by mx.match_number desc limit 1
      ) m on true
      where c.session_id = s.id
    ), '[]'::jsonb),
    'lineups', coalesce((
      select jsonb_agg(jsonb_build_object(
        'session_id', s.id,
        'court_number', c.court_number,
        'team_number', mp.team_number,
        'slot_number', mp.slot_number,
        'display_name', p.display_name,
        'result', mp.result,
        'points_for', mp.points_for,
        'points_against', mp.points_against,
        'lineup_id', mp.id
      ) order by c.court_number, mp.team_number, mp.slot_number)
      from public.matches m
      join public.courts c on c.id = m.court_id
      join public.match_players mp on mp.match_id = m.id
      join public.players p on p.id = mp.player_id
      where m.session_id = s.id and m.status in ('staged', 'playing')
    ), '[]'::jsonb),
    'presence', coalesce((
      select jsonb_agg(jsonb_build_object(
        'session_id', s.id,
        'display_name', p.display_name,
        'skill_level', p.skill_level,
        'attendance_status', sp.attendance_status,
        'queue_position', sp.queue_position,
        'games_played', sp.games_played,
        'checked_in_at', sp.checked_in_at,
        'last_enqueued_at', sp.last_enqueued_at,
        'presence_id', sp.id
      ) order by sp.queue_position nulls last, p.display_name)
      from public.session_players sp
      join public.players p on p.id = sp.player_id
      where sp.session_id = s.id and p.is_active
    ), '[]'::jsonb),
    'standings', coalesce((
      select jsonb_agg(jsonb_build_object(
        'session_id', s.id,
        'club_id', s.club_id,
        'player_id', sp.id,
        'display_name', p.display_name,
        'skill_level', p.skill_level,
        'games_played', coalesce(t.games_played, 0),
        'wins', coalesce(t.wins, 0),
        'losses', coalesce(t.losses, 0),
        'points_for', coalesce(t.points_for, 0),
        'points_against', coalesce(t.points_against, 0),
        'first_game_at', t.first_game_at,
        'last_game_at', t.last_game_at
      ) order by coalesce(t.wins, 0) desc,
                 coalesce(t.points_for, 0) desc,
                 p.display_name)
      from public.session_players sp
      join public.players p on p.id = sp.player_id
      left join private.session_match_totals t
        on t.session_id = sp.session_id and t.player_id = sp.player_id
      where sp.session_id = s.id and p.is_active
    ), '[]'::jsonb)
  )
  from selected s
  cross join duration_stats ds;
$$;

comment on function public.get_player_live_board(uuid) is
  'Token-scoped sanitized Player Live View payload. Returns no token, auth ids, membership, audit, or private settings.';

revoke all on function public.get_player_live_board(uuid) from public;
grant execute on function public.get_player_live_board(uuid) to anon, authenticated;
