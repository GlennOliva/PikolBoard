-- 0002: authorization helpers + atomic RPC operations.
--
-- Every privileged write goes through a function in this file. The app has no
-- service-role key, so these functions ARE the write API. Each one:
--   * takes the session row lock first, serializing all queue mutations for
--     that session so concurrent organizers cannot double-book or double-count;
--   * re-checks authorization with private.is_club_admin(), so authorization is
--     never satisfied by a UI check alone;
--   * raises friendly, SQL-free messages.

create schema if not exists private;

grant usage on schema private to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Authorization helpers (STABLE + SECURITY DEFINER avoids recursive RLS)
-- ---------------------------------------------------------------------------
create or replace function private.is_club_member(p_club_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.club_members m
    where m.club_id = p_club_id
      and m.user_id = auth.uid()
      and m.status = 'active'
  );
$$;

create or replace function private.is_club_admin(p_club_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.club_members m
    where m.club_id = p_club_id
      and m.user_id = auth.uid()
      and m.status = 'active'
      and m.role in ('owner', 'admin')
  );
$$;

create or replace function private.is_club_owner(p_club_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.club_members m
    where m.club_id = p_club_id
      and m.user_id = auth.uid()
      and m.status = 'active'
      and m.role = 'owner'
  );
$$;

create or replace function private.club_of_session(p_session_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select s.club_id from public.sessions s where s.id = p_session_id;
$$;

-- A session is readable by club members, or by anyone when the organizer has
-- published it.
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
        or private.is_club_member(s.club_id)
        or auth.uid() = s.created_by
      )
  );
$$;

-- ---------------------------------------------------------------------------
-- Small internal utilities
-- ---------------------------------------------------------------------------
create or replace function private.next_queue_position(p_session_id uuid)
returns integer
language sql
as $$
  select coalesce(max(queue_position), 0) + 1
  from public.session_players
  where session_id = p_session_id
    and queue_position is not null;
$$;

create or replace function private.log_queue_event(
  p_session_id uuid,
  p_session_player_id uuid,
  p_player_id uuid,
  p_event_type text,
  p_old_status public.attendance_status,
  p_new_status public.attendance_status,
  p_metadata jsonb default '{}'::jsonb
)
returns void
language sql
as $$
  insert into public.queue_events (
    session_id, session_player_id, player_id, event_type,
    old_status, new_status, actor_id, metadata
  )
  values (
    p_session_id, p_session_player_id, p_player_id, p_event_type,
    p_old_status, p_new_status, auth.uid(), coalesce(p_metadata, '{}'::jsonb)
  );
$$;

-- Trailing win/loss streak from completed matches. Recomputed rather than
-- incremented so score corrections stay consistent.
create or replace function private.player_win_streak(
  p_session_id uuid,
  p_player_id uuid
)
returns integer
language plpgsql
stable
as $$
declare
  v_streak integer;
begin
  with ordered as (
    select
      (mp.team_number = m.winning_team) as won,
      m.completed_at,
      m.match_number,
      row_number() over (order by m.completed_at, m.match_number) as rn
    from public.match_players mp
    join public.matches m on m.id = mp.match_id
    where mp.session_id = p_session_id
      and mp.player_id = p_player_id
      and m.status = 'completed'
      and m.completed_at is not null
      and m.winning_team is not null
  ), grouped as (
    select
      won,
      rn,
      rn - (row_number() over (partition by won order by rn)) as grp
    from ordered
  ), final_run as (
    select won, count(*)::integer as run_len
    from grouped g
    where g.grp = (select grp from grouped order by rn desc limit 1)
    group by won
  )
  select coalesce(
    (select run_len from final_run where won),
    0
  ) * case when (select won from final_run limit 1) then 1 else -1 end
  into v_streak;

  return coalesce(v_streak, 0);
end;
$$;

-- ---------------------------------------------------------------------------
-- Clubs and membership
-- ---------------------------------------------------------------------------
create or replace function public.create_club(
  p_name text,
  p_slug text,
  p_location text default null,
  p_timezone text default 'UTC'
)
returns uuid
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_club_id uuid;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in to create a club' using errcode = '42501';
  end if;

  p_slug := lower(btrim(coalesce(p_slug, '')));
  if p_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' then
    raise exception
      'Club slug must be lowercase letters, numbers, and single dashes (for example "harbour-club")'
      using errcode = '22023';
  end if;

  insert into public.clubs (name, slug, location, timezone, created_by)
  values (btrim(p_name), p_slug, nullif(btrim(p_location), ''), coalesce(p_timezone, 'UTC'), auth.uid())
  returning id into v_club_id;

  insert into public.club_members (club_id, user_id, role, status)
  values (v_club_id, auth.uid(), 'owner', 'active');

  insert into public.club_settings (club_id) values (v_club_id);

  return v_club_id;
end;
$$;

-- Edit a club's profile fields. Passing null leaves a column unchanged, so the
-- UI can send only what changed. This is also the only way to set is_public,
-- because clubs have no direct UPDATE policy.
create or replace function public.update_club(
  p_club_id uuid,
  p_name text default null,
  p_location text default null,
  p_timezone text default null,
  p_logo_url text default null,
  p_is_public boolean default null
)
returns void
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_slug text;
begin
  if not private.is_club_admin(p_club_id) then
    raise exception 'Only club organizers can change club details' using errcode = '42501';
  end if;

  if p_is_public is not null then
    -- Publishing a club exposes its sessions to the sanitized public views, so
    -- require a real location for the public page to show.
    if p_is_public and coalesce(p_location, (
      select location from public.clubs where id = p_club_id
    )) is null then
      raise exception 'Add a location before publishing this club' using errcode = '22023';
    end if;
  end if;

  update public.clubs
  set name = coalesce(nullif(btrim(coalesce(p_name, '')), ''), name),
      location = case
        when p_location is null then location
        else nullif(btrim(p_location), '')
      end,
      timezone = coalesce(nullif(btrim(coalesce(p_timezone, '')), ''), timezone),
      logo_url = case
        when p_logo_url is null then logo_url
        else nullif(btrim(p_logo_url), '')
      end,
      is_public = coalesce(p_is_public, is_public),
      updated_at = now()
  where id = p_club_id
  returning slug into v_slug;

  if v_slug is null then
    raise exception 'Club not found' using errcode = 'P0002';
  end if;
end;
$$;

create or replace function public.add_club_member(
  p_club_id uuid,
  p_user_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_membership_id uuid;
begin
  if not private.is_club_admin(p_club_id) then
    raise exception 'Only club organizers can add members' using errcode = '42501';
  end if;

  insert into public.club_members (club_id, user_id, role, status)
  values (p_club_id, p_user_id, 'player', 'active')
  on conflict (club_id, user_id) do update set status = 'active'
  returning id into v_membership_id;

  return v_membership_id;
end;
$$;

-- Only an owner may create another owner; admins may set player/admin.
create or replace function public.set_club_member_role(
  p_club_id uuid,
  p_user_id uuid,
  p_role public.club_role
)
returns void
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
begin
  if not private.is_club_admin(p_club_id) then
    raise exception 'Only club organizers can change roles' using errcode = '42501';
  end if;

  if p_role = 'owner' and not private.is_club_owner(p_club_id) then
    raise exception 'Only the club owner can grant owner access' using errcode = '42501';
  end if;

  update public.club_members
  set role = p_role
  where club_id = p_club_id and user_id = p_user_id;

  if not found then
    raise exception 'That person is not a member of this club' using errcode = '22023';
  end if;
end;
$$;

create or replace function public.update_club_settings(
  p_club_id uuid,
  p_min_games integer default null,
  p_default_match_minutes integer default null
)
returns void
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
begin
  if not private.is_club_admin(p_club_id) then
    raise exception 'Only club organizers can change settings' using errcode = '42501';
  end if;

  update public.club_settings
  set min_games_for_leaderboard = coalesce(p_min_games, min_games_for_leaderboard),
      default_match_minutes = coalesce(p_default_match_minutes, default_match_minutes),
      updated_at = now()
  where club_id = p_club_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Roster
-- ---------------------------------------------------------------------------
create or replace function public.create_player(
  p_club_id uuid,
  p_display_name text,
  p_skill_level integer,
  p_division text default null,
  p_user_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_player_id uuid;
begin
  if not private.is_club_admin(p_club_id) then
    raise exception 'Only club organizers can manage the roster' using errcode = '42501';
  end if;

  if p_skill_level < 1 or p_skill_level > 6 then
    raise exception 'Skill level must be between 1 and 6' using errcode = '22023';
  end if;

  insert into public.players (club_id, display_name, skill_level, division, user_id)
  values (
    p_club_id,
    btrim(p_display_name),
    p_skill_level,
    nullif(btrim(coalesce(p_division, '')), ''),
    p_user_id
  )
  returning id into v_player_id;

  return v_player_id;
end;
$$;

create or replace function public.update_player(
  p_player_id uuid,
  p_display_name text,
  p_skill_level integer,
  p_division text default null,
  p_is_active boolean default null
)
returns void
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_club_id uuid;
begin
  select club_id into v_club_id from public.players where id = p_player_id;
  if v_club_id is null then
    raise exception 'Player not found' using errcode = 'P0002';
  end if;

  if not private.is_club_admin(v_club_id) then
    raise exception 'Only club organizers can manage the roster' using errcode = '42501';
  end if;

  if p_skill_level < 1 or p_skill_level > 6 then
    raise exception 'Skill level must be between 1 and 6' using errcode = '22023';
  end if;

  update public.players
  set display_name = btrim(p_display_name),
      skill_level = p_skill_level,
      division = nullif(btrim(coalesce(p_division, '')), ''),
      is_active = coalesce(p_is_active, is_active)
  where id = p_player_id;
end;
$$;

create or replace function public.archive_player(p_player_id uuid)
returns void
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_club_id uuid;
begin
  select club_id into v_club_id from public.players where id = p_player_id;
  if v_club_id is null then
    raise exception 'Player not found' using errcode = 'P0002';
  end if;

  if not private.is_club_admin(v_club_id) then
    raise exception 'Only club organizers can manage the roster' using errcode = '42501';
  end if;

  -- Soft delete: the player may still appear in historical matches.
  update public.players set is_active = false where id = p_player_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Sessions
-- ---------------------------------------------------------------------------
create or replace function public.create_session(
  p_club_id uuid,
  p_name text,
  p_format public.session_format,
  p_matching_mode public.matching_mode,
  p_target_score integer,
  p_win_by integer,
  p_court_count integer,
  p_max_games integer default null,
  p_starvation_minutes integer default 15
)
returns uuid
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_session_id uuid;
begin
  if not private.is_club_admin(p_club_id) then
    raise exception 'Only club organizers can create sessions' using errcode = '42501';
  end if;

  if p_target_score not in (11, 15, 21) then
    raise exception 'Target score must be 11, 15, or 21' using errcode = '22023';
  end if;

  if p_win_by not in (1, 2) then
    raise exception 'Win by must be 1 or 2' using errcode = '22023';
  end if;

  if p_court_count < 1 or p_court_count > 12 then
    raise exception 'Court count must be between 1 and 12' using errcode = '22023';
  end if;

  insert into public.sessions (
    club_id, name, status, format, matching_mode, target_score, win_by,
    court_count, max_games, starvation_threshold_minutes, created_by
  )
  values (
    p_club_id, btrim(p_name), 'draft', p_format, p_matching_mode, p_target_score,
    p_win_by, p_court_count, nullif(p_max_games, 0),
    coalesce(p_starvation_minutes, 15), auth.uid()
  )
  returning id into v_session_id;

  return v_session_id;
end;
$$;

-- Edit a session's configuration and visibility. Like update_club, this is the
-- only write path for these columns, and null means "leave unchanged".
--
-- The draft-only guard matters: changing court count, format, or score settings
-- mid-session would invalidate matches already in play, so those fields are
-- locked once the session goes live.
create or replace function public.update_session(
  p_session_id uuid,
  p_name text default null,
  p_format public.session_format default null,
  p_matching_mode public.matching_mode default null,
  p_target_score integer default null,
  p_win_by integer default null,
  p_court_count integer default null,
  p_max_games integer default null,
  p_starvation_minutes integer default null,
  p_is_public boolean default null,
  p_results_published boolean default null
)
returns void
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_session public.sessions%rowtype;
  v_next integer;
begin
  select * into v_session from public.sessions where id = p_session_id for update;
  if v_session.id is null then
    raise exception 'Session not found' using errcode = 'P0002';
  end if;

  if not private.is_club_admin(v_session.club_id) then
    raise exception 'Only club organizers can change session settings' using errcode = '42501';
  end if;

  -- Changing the shape of a game after it has started would leave staged
  -- matches inconsistent with the session, so only names, limits, and
  -- visibility can change once live.
  if v_session.status <> 'draft'
     and (p_format is not null or p_target_score is not null
          or p_win_by is not null or p_court_count is not null
          or p_matching_mode is not null) then
    raise exception
      'Format, scoring, courts, and matching mode are locked once the session starts'
      using errcode = '22023';
  end if;

  if p_target_score is not null and p_target_score not in (11, 15, 21) then
    raise exception 'Target score must be 11, 15, or 21' using errcode = '22023';
  end if;

  if p_win_by is not null and p_win_by not in (1, 2) then
    raise exception 'Win by must be 1 or 2' using errcode = '22023';
  end if;

  if p_court_count is not null and (p_court_count < 1 or p_court_count > 12) then
    raise exception 'Court count must be between 1 and 12' using errcode = '22023';
  end if;

  if p_starvation_minutes is not null
     and (p_starvation_minutes < 1 or p_starvation_minutes > 120) then
    raise exception 'Starvation threshold must be between 1 and 120 minutes' using errcode = '22023';
  end if;

  -- Results can only be published for a finished session, otherwise the public
  -- standings view would show a partial tournament.
  if p_results_published is true and v_session.status not in ('completed', 'cancelled') then
    raise exception 'End the session before publishing results' using errcode = '22023';
  end if;

  if p_results_published is false and v_session.is_public then
    raise exception 'Make the session private before unpublishing results' using errcode = '22023';
  end if;

  -- Adding courts to a live session is allowed, so create the new court rows.
  v_next := coalesce(p_court_count, v_session.court_count);
  if v_next > v_session.court_count then
    insert into public.courts (session_id, court_number, ladder_position)
    select p_session_id, g, g
    from generate_series(v_session.court_count + 1, v_next) g
    on conflict (session_id, court_number) do nothing;
  end if;

  update public.sessions
  set name = coalesce(nullif(btrim(coalesce(p_name, '')), ''), name),
      format = coalesce(p_format, format),
      matching_mode = coalesce(p_matching_mode, matching_mode),
      target_score = coalesce(p_target_score, target_score),
      win_by = coalesce(p_win_by, win_by),
      court_count = v_next,
      max_games = case
        when p_max_games is null then max_games
        else nullif(p_max_games, 0)
      end,
      starvation_threshold_minutes = coalesce(p_starvation_minutes, starvation_threshold_minutes),
      is_public = coalesce(p_is_public, is_public),
      results_published = coalesce(p_results_published, results_published),
      updated_at = now()
  where id = p_session_id;
end;
$$;

-- Bulk-add roster players to a draft or active session.
create or replace function public.add_session_players(
  p_session_id uuid,
  p_player_ids uuid[]
)
returns integer
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_session public.sessions%rowtype;
  v_inserted integer;
begin
  select * into v_session from public.sessions where id = p_session_id for update;
  if v_session.id is null then
    raise exception 'Session not found' using errcode = 'P0002';
  end if;

  if not private.is_club_admin(v_session.club_id) then
    raise exception 'Only club organizers can add players to a session' using errcode = '42501';
  end if;

  if v_session.status in ('completed', 'cancelled') then
    raise exception 'This session is closed' using errcode = '22023';
  end if;

  insert into public.session_players (session_id, player_id, attendance_status)
  select p_session_id, p.id, 'checked_out'
  from public.players p
  where p.id = any(p_player_ids) and p.club_id = v_session.club_id
  on conflict (session_id, player_id) do nothing;

  get diagnostics v_inserted = row_count;
  return v_inserted;
end;
$$;

create or replace function public.remove_session_player(
  p_session_id uuid,
  p_player_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_session public.sessions%rowtype;
  v_status public.attendance_status;
begin
  select * into v_session from public.sessions where id = p_session_id for update;
  if v_session.id is null then
    raise exception 'Session not found' using errcode = 'P0002';
  end if;

  if not private.is_club_admin(v_session.club_id) then
    raise exception 'Only club organizers can change the roster' using errcode = '42501';
  end if;

  select attendance_status into v_status
  from public.session_players
  where session_id = p_session_id and player_id = p_player_id;

  if v_status is null then
    return;
  end if;

  if v_status in ('playing', 'staged') then
    raise exception
      'That player is in a match. Cancel the match before removing them.'
      using errcode = '22023';
  end if;

  delete from public.session_players
  where session_id = p_session_id and player_id = p_player_id;
end;
$$;

-- Check in: create or re-activate the queue entry.
create or replace function public.check_in_player(
  p_session_id uuid,
  p_player_id uuid
)
returns integer
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_session public.sessions%rowtype;
  v_sp public.session_players%rowtype;
  v_position integer;
begin
  select * into v_session from public.sessions where id = p_session_id for update;
  if v_session.id is null then
    raise exception 'Session not found' using errcode = 'P0002';
  end if;

  if not private.is_club_admin(v_session.club_id) then
    raise exception 'Only club organizers can check players in' using errcode = '42501';
  end if;

  if v_session.status in ('completed', 'cancelled') then
    raise exception 'This session is closed' using errcode = '22023';
  end if;

  if not exists (
    select 1 from public.players p
    where p.id = p_player_id and p.club_id = v_session.club_id
  ) then
    raise exception 'That player is not on this club roster' using errcode = '22023';
  end if;

  select * into v_sp
  from public.session_players
  where session_id = p_session_id and player_id = p_player_id;

  if v_sp.id is null then
    insert into public.session_players (session_id, player_id, attendance_status)
    values (p_session_id, p_player_id, 'checked_out');
  end if;

  if v_sp.attendance_status in ('playing', 'staged') then
    raise exception
      'That player is currently in a match. Finish or cancel it first.'
      using errcode = '22023';
  end if;

  v_position := private.next_queue_position(p_session_id);

  insert into public.session_players (
    session_id, player_id, attendance_status, queue_position,
    checked_in_at, last_enqueued_at
  )
  values (p_session_id, p_player_id, 'waiting', v_position, now(), now())
  on conflict (session_id, player_id) do update
  set attendance_status = 'waiting',
      queue_position = excluded.queue_position,
      checked_in_at = coalesce(
        public.session_players.checked_in_at, excluded.checked_in_at
      ),
      last_enqueued_at = excluded.last_enqueued_at
  returning queue_position into v_position;

  perform private.log_queue_event(
    p_session_id,
    null,
    p_player_id,
    'check_in',
    v_sp.attendance_status,
    'waiting',
    jsonb_build_object('queue_position', v_position)
  );

  return v_position;
end;
$$;

-- Check out / break / return to queue.
create or replace function public.set_attendance(
  p_session_id uuid,
  p_player_id uuid,
  p_status text
)
returns void
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_session public.sessions%rowtype;
  v_sp public.session_players%rowtype;
  v_new public.attendance_status;
  v_position integer;
begin
  select * into v_session from public.sessions where id = p_session_id for update;
  if v_session.id is null then
    raise exception 'Session not found' using errcode = 'P0002';
  end if;

  if not private.is_club_admin(v_session.club_id) then
    raise exception 'Only club organizers can change attendance' using errcode = '42501';
  end if;

  if p_status not in ('waiting', 'break', 'checked_out') then
    raise exception 'Unsupported attendance change' using errcode = '22023';
  end if;

  select * into v_sp
  from public.session_players
  where session_id = p_session_id and player_id = p_player_id
  for update;

  if v_sp.id is null then
    raise exception 'That player is not in this session' using errcode = '22023';
  end if;

  if v_sp.attendance_status in ('playing', 'staged') then
    raise exception
      'That player is in a match. Finish or cancel it first.'
      using errcode = '22023';
  end if;

  v_new := p_status::public.attendance_status;

  if v_new = 'waiting' then
    v_position := private.next_queue_position(p_session_id);
    update public.session_players
    set attendance_status = 'waiting',
        queue_position = v_position,
        last_enqueued_at = now()
    where id = v_sp.id;
  else
    update public.session_players
    set attendance_status = v_new,
        queue_position = null
    where id = v_sp.id;
  end if;

  perform private.log_queue_event(
    p_session_id, v_sp.id, p_player_id,
    case when v_new = 'waiting' then 'return_to_queue' else 'attendance_change' end,
    v_sp.attendance_status, v_new
  );
end;
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
begin
  select * into v_session from public.sessions where id = p_session_id for update;
  if v_session.id is null then
    raise exception 'Session not found' using errcode = 'P0002';
  end if;

  if not private.is_club_admin(v_session.club_id) then
    raise exception 'Only club organizers can start a session' using errcode = '42501';
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
  set status = 'active', started_at = now()
  where id = p_session_id;

  return jsonb_build_object('session_id', p_session_id, 'courts', v_session.court_count);
end;
$$;

create or replace function public.set_court_status(
  p_court_id uuid,
  p_status text
)
returns void
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_court public.courts%rowtype;
  v_session public.sessions%rowtype;
begin
  select * into v_court from public.courts where id = p_court_id;
  if v_court.id is null then
    raise exception 'Court not found' using errcode = 'P0002';
  end if;

  select * into v_session from public.sessions where id = v_court.session_id for update;
  if not private.is_club_admin(v_session.club_id) then
    raise exception 'Only club organizers can change courts' using errcode = '42501';
  end if;

  if p_status not in ('available', 'disabled') then
    raise exception 'A court can only be set to available or disabled' using errcode = '22023';
  end if;

  if exists (
    select 1 from public.matches
    where court_id = p_court_id and status in ('staged', 'playing')
  ) then
    raise exception 'Finish the match on that court first' using errcode = '22023';
  end if;

  update public.courts set status = p_status::public.court_status where id = p_court_id;
end;
$$;

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

  if v_session.status = 'completed' then
    return;
  end if;

  select count(*) into v_open
  from public.matches
  where session_id = p_session_id and status in ('staged', 'playing');

  if v_open > 0 and not p_force then
    raise exception
      '% match(es) are still staged or in play. Finish them first, or end anyway.',
      v_open
      using errcode = '22023';
  end if;

  if v_open > 0 then
    update public.matches
    set status = 'cancelled', updated_at = now()
    where session_id = p_session_id and status in ('staged', 'playing');

    update public.match_players mp
    set result = 'cancelled'
    where mp.session_id = p_session_id and mp.result is null;

    update public.courts
    set status = 'available'
    where session_id = p_session_id and status in ('staged', 'playing');
  end if;

  update public.sessions
  set status = 'completed', ended_at = now()
  where id = p_session_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Match lifecycle
-- ---------------------------------------------------------------------------

-- Stage a proposal produced by the pure TypeScript matchmaker. The database
-- re-validates eligibility so a stale proposal cannot be written.
create or replace function public.stage_match(
  p_session_id uuid,
  p_court_id uuid,
  p_player_ids uuid[],
  p_team_numbers smallint[],
  p_explanation text default null,
  p_matching_mode public.matching_mode default null
)
returns uuid
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_session public.sessions%rowtype;
  v_court public.courts%rowtype;
  v_match_id uuid;
  v_match_number integer;
  v_expected integer;
  v_mode public.matching_mode;
  v_bad text;
begin
  select * into v_session from public.sessions where id = p_session_id for update;
  if v_session.id is null then
    raise exception 'Session not found' using errcode = 'P0002';
  end if;

  if not private.is_club_admin(v_session.club_id) then
    raise exception 'Only club organizers can stage matches' using errcode = '42501';
  end if;

  if v_session.status <> 'active' then
    raise exception 'The session is not live' using errcode = '22023';
  end if;

  v_expected := case when v_session.format = 'singles' then 2 else 4 end;
  if cardinality(p_player_ids) is distinct from v_expected
     or cardinality(p_team_numbers) is distinct from v_expected then
    raise exception 'A % match needs exactly % players',
      case when v_session.format = 'singles' then 'singles' else 'doubles' end,
      v_expected
      using errcode = '22023';
  end if;

  if cardinality(array(select distinct unnest(p_player_ids))) <> v_expected then
    raise exception 'The same player cannot be selected twice' using errcode = '22023';
  end if;

  -- Court must be in this session and free.
  select * into v_court from public.courts where id = p_court_id;
  if v_court.id is null or v_court.session_id <> p_session_id then
    raise exception 'Court not found in this session' using errcode = '22023';
  end if;

  if v_court.status <> 'available' then
    raise exception 'Court % is not available', v_court.court_number using errcode = '22023';
  end if;

  -- Every selected player must still be waiting. This is what makes a stale
  -- proposal safe to reject instead of double-booking a player.
  select p.display_name into v_bad
  from unnest(p_player_ids) with ordinality as sel(pid, ord)
  join public.session_players sp
    on sp.session_id = p_session_id and sp.player_id = sel.pid
  join public.players p on p.id = sel.pid
  where sp.attendance_status <> 'waiting'
  limit 1;

  if v_bad is not null then
    raise exception '% is no longer waiting to play', v_bad using errcode = '22023';
  end if;

  select coalesce(max(match_number), 0) + 1 into v_match_number
  from public.matches where session_id = p_session_id;

  v_mode := coalesce(p_matching_mode, v_session.matching_mode);

  insert into public.matches (
    session_id, court_id, match_number, status, target_score, win_by,
    matching_mode, explanation, staged_at, created_by
  )
  values (
    p_session_id, p_court_id, v_match_number, 'staged',
    v_session.target_score, v_session.win_by, v_mode, p_explanation, now(), auth.uid()
  )
  returning id into v_match_id;

  insert into public.match_players (
    match_id, player_id, session_id, team_number, slot_number, skill_snapshot
  )
  select
    v_match_id,
    sel.pid,
    p_session_id,
    sel.team,
    ((sel.ord - 1) % 2) + 1,
    p.skill_level
  from unnest(p_player_ids, p_team_numbers) with ordinality as sel(pid, team, ord)
  join public.players p on p.id = sel.pid
  where p.club_id = v_session.club_id;

  if (select count(*) from public.match_players where match_id = v_match_id) <> v_expected then
    raise exception 'One or more selected players are not on this club roster'
      using errcode = '22023';
  end if;

  -- Selected players leave the waiting queue and hold their slot in the match.
  update public.session_players
  set attendance_status = 'staged',
      queue_position = null
  where session_id = p_session_id
    and player_id = any(p_player_ids);

  -- Everyone still waiting has now been passed over once.
  update public.session_players
  set times_skipped = times_skipped + 1
  where session_id = p_session_id
    and attendance_status = 'waiting'
    and not (player_id = any(p_player_ids));

  update public.courts set status = 'staged' where id = p_court_id;

  perform private.log_queue_event(
    p_session_id, null, null, 'match_staged', null, 'staged',
    jsonb_build_object('match_id', v_match_id, 'court_id', p_court_id)
  );

  return v_match_id;
end;
$$;

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

  update public.matches
  set status = 'playing', started_at = now()
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

-- The single write path for results. Atomic, and idempotent-by-rejection.
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

  update public.matches
  set status = 'completed',
      team1_score = p_team1_score,
      team2_score = p_team2_score,
      winning_team = v_winner,
      completed_at = now()
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

create or replace function public.cancel_match(
  p_match_id uuid,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_match public.matches%rowtype;
  v_session public.sessions%rowtype;
  v_session_id uuid;
  v_position integer;
  v_player uuid;
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
    raise exception 'Only club organizers can cancel matches' using errcode = '42501';
  end if;

  if v_match.status in ('completed', 'cancelled') then
    raise exception 'That match is already finished' using errcode = '22023';
  end if;

  update public.matches set status = 'cancelled' where id = p_match_id;

  update public.match_players
  set result = 'cancelled'
  where match_id = p_match_id;

  v_position := private.next_queue_position(v_match.session_id);

  for v_player in
    select player_id from public.match_players
    where match_id = p_match_id
    order by team_number, slot_number
  loop
    update public.session_players
    set attendance_status = 'waiting',
        queue_position = v_position,
        last_enqueued_at = now()
    where session_id = v_match.session_id and player_id = v_player;

    perform private.log_queue_event(
      v_match.session_id, null, v_player, 'match_cancelled',
      'staged', 'waiting',
      jsonb_build_object('match_id', p_match_id, 'reason', p_reason)
    );

    v_position := v_position + 1;
  end loop;

  if v_match.court_id is not null then
    update public.courts set status = 'available' where id = v_match.court_id;
  end if;
end;
$$;

-- Correct a score. Works before completion (finishes it) and after completion
-- (applies the delta). Always writes an audit row.
create or replace function public.correct_match_score(
  p_match_id uuid,
  p_team1_score integer,
  p_team2_score integer,
  p_reason text
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
  v_old_winner smallint;
  v_new_winner smallint;
  v_delta_for integer;
  v_delta_against integer;
  v_mp record;
begin
  if char_length(btrim(coalesce(p_reason, ''))) < 3 then
    raise exception 'Please give a short reason for the correction'
      using errcode = '22023';
  end if;

  if p_team1_score is null or p_team2_score is null
     or p_team1_score < 0 or p_team2_score < 0 then
    raise exception 'Scores must be whole numbers of 0 or more'
      using errcode = '22023';
  end if;

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
    raise exception 'Only club organizers can correct scores' using errcode = '42501';
  end if;

  -- Correcting a live match is just completing it.
  if v_match.status = 'playing' then
    return public.complete_match(p_match_id, p_team1_score, p_team2_score);
  end if;

  if v_match.status <> 'completed' then
    raise exception 'Only a live or completed match can be corrected'
      using errcode = '22023';
  end if;

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

  v_old_winner := v_match.winning_team;
  v_new_winner := case when p_team1_score > p_team2_score then 1 else 2 end;

  insert into public.score_audit_log (
    match_id, old_team1_score, old_team2_score,
    new_team1_score, new_team2_score, reason, actor_id
  )
  values (
    p_match_id, v_match.team1_score, v_match.team2_score,
    p_team1_score, p_team2_score, btrim(p_reason), auth.uid()
  );

  update public.matches
  set team1_score = p_team1_score,
      team2_score = p_team2_score,
      winning_team = v_new_winner
  where id = p_match_id;

  -- Cast required for the same reason as in complete_match.
  update public.match_players mp
  set result = (case when mp.team_number = v_new_winner then 'win' else 'loss' end)::public.match_result,
      points_for = case when mp.team_number = 1 then p_team1_score else p_team2_score end,
      points_against = case when mp.team_number = 1 then p_team2_score else p_team1_score end
  where mp.match_id = p_match_id;

  for v_mp in
    select player_id, team_number from public.match_players
    where match_id = p_match_id
  loop
    -- Both sides of the score move: a team's points-against delta is the
    -- mirror of its points-for delta, so a correction never leaves one side
    -- of a player's ledger stale.
    v_delta_for := (case when v_mp.team_number = 1 then p_team1_score else p_team2_score end)
                 - (case when v_mp.team_number = 1 then v_match.team1_score else v_match.team2_score end);
    v_delta_against := (case when v_mp.team_number = 1 then p_team2_score else p_team1_score end)
                    - (case when v_mp.team_number = 1 then v_match.team2_score else v_match.team1_score end);

    update public.session_players
    set points_for = greatest(0, points_for + v_delta_for),
        points_against = greatest(0, points_against + v_delta_against),
        wins = wins + (
          case when v_mp.team_number = v_new_winner then 1 else 0 end
          - case when v_mp.team_number = v_old_winner then 1 else 0 end
        ),
        losses = losses + (
          case when v_mp.team_number = v_old_winner then 1 else 0 end
          - case when v_mp.team_number = v_new_winner then 1 else 0 end
        )
    where session_id = v_match.session_id and player_id = v_mp.player_id;
  end loop;

  update public.session_players sp
  set win_streak = private.player_win_streak(sp.session_id, sp.player_id)
  where sp.session_id = v_match.session_id
    and sp.player_id in (select player_id from public.match_players where match_id = p_match_id);

  return jsonb_build_object(
    'match_id', p_match_id,
    'winning_team', v_new_winner,
    'was_winning_team', v_old_winner,
    'winner_changed', v_old_winner is distinct from v_new_winner
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Grants: the write API is RPC-only. Direct table writes have no policies.
-- ---------------------------------------------------------------------------
revoke all on all functions in schema public from public, anon;
revoke all on all functions in schema private from public, anon;

grant execute on function
  public.create_club(text, text, text, text),
  public.update_club(uuid, text, text, text, text, boolean),
  public.add_club_member(uuid, uuid),
  public.set_club_member_role(uuid, uuid, public.club_role),
  public.update_club_settings(uuid, integer, integer),
  public.create_player(uuid, text, integer, text, uuid),
  public.update_player(uuid, text, integer, text, boolean),
  public.archive_player(uuid),
  public.create_session(uuid, text, public.session_format, public.matching_mode, integer, integer, integer, integer, integer),
  public.update_session(uuid, text, public.session_format, public.matching_mode, integer, integer, integer, integer, integer, boolean, boolean),
  public.add_session_players(uuid, uuid[]),
  public.remove_session_player(uuid, uuid),
  public.check_in_player(uuid, uuid),
  public.set_attendance(uuid, uuid, text),
  public.start_session(uuid),
  public.set_court_status(uuid, text),
  public.stage_match(uuid, uuid, uuid[], smallint[], text, public.matching_mode),
  public.start_match(uuid),
  public.complete_match(uuid, integer, integer),
  public.cancel_match(uuid, text),
  public.correct_match_score(uuid, integer, integer, text),
  public.end_session(uuid, boolean)
to authenticated;