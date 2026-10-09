-- 0001: extensions, enum types, tables, constraints, indexes, triggers.
-- Idempotent-ish: safe to run once against a fresh Supabase project.

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------------
-- Enum types
-- ---------------------------------------------------------------------------
do $$ begin
  create type public.club_role as enum ('owner', 'admin', 'player');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.member_status as enum ('active', 'invited');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.session_status as enum ('draft', 'active', 'completed', 'cancelled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.session_format as enum ('singles', 'doubles');
exception when duplicate_object then null; end $$;

-- P0 matching modes only. P1 modes are deferred (see docs/PROGRESS.md).
do $$ begin
  create type public.matching_mode as enum ('fifo', 'balanced', 'skill_separated');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.attendance_status as enum (
    'checked_out', 'waiting', 'staged', 'playing', 'break', 'finished'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.court_status as enum ('available', 'staged', 'playing', 'disabled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.match_status as enum ('staged', 'playing', 'completed', 'cancelled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.match_result as enum ('win', 'loss', 'cancelled');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- profiles: 1:1 with auth.users. Private.
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default 'New player',
  avatar_url text,
  default_skill_level smallint not null default 3
    check (default_skill_level between 1 and 6),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- clubs
-- ---------------------------------------------------------------------------
create table if not exists public.clubs (
  id uuid primary key default extensions.gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 2 and 80),
  slug text not null unique
    check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  location text,
  timezone text not null default 'UTC',
  logo_url text,
  is_public boolean not null default false,
  created_by uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.club_members (
  id uuid primary key default extensions.gen_random_uuid(),
  club_id uuid not null references public.clubs (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.club_role not null default 'player',
  status public.member_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint club_members_club_user_key unique (club_id, user_id)
);

create index if not exists club_members_user_idx on public.club_members (user_id);
create index if not exists club_members_club_role_idx on public.club_members (club_id, role);

-- ---------------------------------------------------------------------------
-- players: reusable per-club roster record. Optional link to an auth user.
-- ---------------------------------------------------------------------------
create table if not exists public.players (
  id uuid primary key default extensions.gen_random_uuid(),
  club_id uuid not null references public.clubs (id) on delete cascade,
  user_id uuid references auth.users (id) on delete set null,
  display_name text not null check (char_length(btrim(display_name)) between 1 and 60),
  skill_level smallint not null default 3 check (skill_level between 1 and 6),
  -- Organizer-supplied group label. Never inferred from a name.
  division text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists players_club_idx on public.players (club_id) where is_active;
create index if not exists players_user_idx on public.players (user_id) where user_id is not null;

-- ---------------------------------------------------------------------------
-- sessions / courts / queue
-- ---------------------------------------------------------------------------
create table if not exists public.sessions (
  id uuid primary key default extensions.gen_random_uuid(),
  club_id uuid not null references public.clubs (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 2 and 80),
  status public.session_status not null default 'draft',
  format public.session_format not null default 'doubles',
  matching_mode public.matching_mode not null default 'balanced',
  target_score smallint not null default 11 check (target_score in (11, 15, 21)),
  win_by smallint not null default 2 check (win_by in (1, 2)),
  court_count smallint not null default 1 check (court_count between 1 and 12),
  -- NULL means "no game limit".
  max_games smallint check (max_games is null or max_games > 0),
  starvation_threshold_minutes smallint not null default 15
    check (starvation_threshold_minutes between 1 and 120),
  is_public boolean not null default false,
  results_published boolean not null default false,
  started_at timestamptz,
  ended_at timestamptz,
  created_by uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists sessions_club_status_idx on public.sessions (club_id, status);
create index if not exists sessions_live_idx on public.sessions (status)
  where status = 'active';
create index if not exists sessions_public_idx on public.sessions (club_id)
  where is_public;

create table if not exists public.courts (
  id uuid primary key default extensions.gen_random_uuid(),
  session_id uuid not null references public.sessions (id) on delete cascade,
  court_number smallint not null check (court_number between 1 and 12),
  name text,
  ladder_position smallint not null default 1 check (ladder_position > 0),
  status public.court_status not null default 'available',
  created_at timestamptz not null default now(),
  constraint courts_session_number_key unique (session_id, court_number)
);

create index if not exists courts_session_status_idx on public.courts (session_id, status);

create table if not exists public.session_players (
  id uuid primary key default extensions.gen_random_uuid(),
  session_id uuid not null references public.sessions (id) on delete cascade,
  player_id uuid not null references public.players (id) on delete cascade,
  attendance_status public.attendance_status not null default 'checked_out',
  -- FIFO ordering. NULL when the player is not in the queue.
  queue_position integer,
  checked_in_at timestamptz,
  last_enqueued_at timestamptz,
  last_played_at timestamptz,
  games_played integer not null default 0 check (games_played >= 0),
  wins integer not null default 0 check (wins >= 0),
  losses integer not null default 0 check (losses >= 0),
  points_for integer not null default 0 check (points_for >= 0),
  points_against integer not null default 0 check (points_against >= 0),
  -- Current consecutive-win streak; negative means consecutive losses.
  win_streak integer not null default 0,
  times_skipped integer not null default 0 check (times_skipped >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint session_players_session_player_key unique (session_id, player_id)
);

create index if not exists session_players_queue_idx
  on public.session_players (session_id, queue_position)
  where queue_position is not null;
create index if not exists session_players_status_idx
  on public.session_players (session_id, attendance_status);
create index if not exists session_players_player_idx on public.session_players (player_id);

create table if not exists public.queue_events (
  id bigint generated always as identity primary key,
  session_id uuid not null references public.sessions (id) on delete cascade,
  session_player_id uuid references public.session_players (id) on delete cascade,
  player_id uuid references public.players (id) on delete cascade,
  event_type text not null,
  old_status public.attendance_status,
  new_status public.attendance_status,
  actor_id uuid references auth.users (id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists queue_events_session_idx
  on public.queue_events (session_id, created_at desc);

-- ---------------------------------------------------------------------------
-- matches / match_players / score audit
-- ---------------------------------------------------------------------------
create table if not exists public.matches (
  id uuid primary key default extensions.gen_random_uuid(),
  session_id uuid not null references public.sessions (id) on delete cascade,
  court_id uuid references public.courts (id) on delete set null,
  match_number integer not null check (match_number > 0),
  status public.match_status not null default 'staged',
  team1_score integer check (team1_score is null or team1_score >= 0),
  team2_score integer check (team2_score is null or team2_score >= 0),
  target_score smallint not null check (target_score in (11, 15, 21)),
  win_by smallint not null check (win_by in (1, 2)),
  winning_team smallint check (winning_team is null or winning_team in (1, 2)),
  matching_mode public.matching_mode not null,
  explanation text,
  staged_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  created_by uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint matches_session_number_key unique (session_id, match_number),
  -- A completed match must satisfy the scoring rule.
  constraint matches_completed_score_valid check (
    status <> 'completed'
    or (
      team1_score is not null
      and team2_score is not null
      and team1_score <> team2_score
      and greatest(team1_score, team2_score) >= target_score
      and abs(team1_score - team2_score) >= win_by
      and winning_team is not null
      and winning_team = case when team1_score > team2_score then 1 else 2 end
    )
  )
);

create index if not exists matches_session_status_idx on public.matches (session_id, status);
create index if not exists matches_court_idx on public.matches (court_id) where court_id is not null;
create index if not exists matches_session_completed_idx
  on public.matches (session_id, completed_at desc)
  where status = 'completed';

create table if not exists public.match_players (
  id uuid primary key default extensions.gen_random_uuid(),
  match_id uuid not null references public.matches (id) on delete cascade,
  player_id uuid not null references public.players (id) on delete cascade,
  -- Denormalized from matches.session_id so queue/stat queries stay indexed.
  session_id uuid not null references public.sessions (id) on delete cascade,
  team_number smallint not null check (team_number in (1, 2)),
  slot_number smallint not null check (slot_number between 1 and 2),
  skill_snapshot smallint not null check (skill_snapshot between 1 and 6),
  result public.match_result,
  points_for integer check (points_for is null or points_for >= 0),
  points_against integer check (points_against is null or points_against >= 0),
  created_at timestamptz not null default now(),
  constraint match_players_match_player_key unique (match_id, player_id)
);

-- Hard guarantee for the DoD item "no player appears in two active or staged
-- matches": a player may hold at most one row with a NULL result (staged,
-- playing). Cancelling sets result='cancelled', which releases the player.
create unique index if not exists match_players_one_unresolved_per_player
  on public.match_players (player_id)
  where result is null;

create index if not exists match_players_session_idx on public.match_players (session_id);
create index if not exists match_players_player_idx on public.match_players (player_id);

create table if not exists public.score_audit_log (
  id bigint generated always as identity primary key,
  match_id uuid not null references public.matches (id) on delete cascade,
  old_team1_score integer,
  old_team2_score integer,
  new_team1_score integer not null check (new_team1_score >= 0),
  new_team2_score integer not null check (new_team2_score >= 0),
  reason text not null check (char_length(btrim(reason)) between 3 and 500),
  actor_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists score_audit_log_match_idx
  on public.score_audit_log (match_id, created_at desc);

-- ---------------------------------------------------------------------------
-- club settings
-- ---------------------------------------------------------------------------
create table if not exists public.club_settings (
  club_id uuid primary key references public.clubs (id) on delete cascade,
  min_games_for_leaderboard smallint not null default 5 check (min_games_for_leaderboard >= 0),
  default_match_minutes smallint not null default 15 check (default_match_minutes between 5 and 60),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- updated_at maintenance
-- ---------------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array[
    'profiles', 'clubs', 'club_members', 'players',
    'sessions', 'session_players', 'matches', 'club_settings'
  ] loop
    execute format('drop trigger if exists trg_touch_updated_at on public.%I', t);
    execute format(
      'create trigger trg_touch_updated_at before update on public.%I
       for each row execute function public.touch_updated_at()', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- queue_events is append-only
-- ---------------------------------------------------------------------------
create or replace function public.queue_events_append_only()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  raise exception 'queue_events is append-only; % is not permitted', tg_op
    using errcode = '42501';
end;
$$;

drop trigger if exists trg_queue_events_append_only on public.queue_events;
create trigger trg_queue_events_append_only
  before update or delete on public.queue_events
  for each row execute function public.queue_events_append_only();

-- ---------------------------------------------------------------------------
-- auto-create a profile for every new auth user
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  requested_name text;
begin
  requested_name := coalesce(
    nullif(btrim(new.raw_user_meta_data ->> 'display_name'), ''),
    nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''),
    nullif(split_part(coalesce(new.email, 'player'), '@', 1), '')
  );

  insert into public.profiles (id, display_name)
  values (new.id, left(coalesce(requested_name, 'New player'), 60))
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists trg_handle_new_user on auth.users;
create trigger trg_handle_new_user
  after insert on auth.users
  for each row execute function public.handle_new_user();