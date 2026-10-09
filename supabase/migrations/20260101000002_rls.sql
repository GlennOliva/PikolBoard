-- 0003: Row Level Security for every table + Realtime publication.
--
-- Two layers of protection:
--   1. GRANT controls which tables/columns a role can read at all.
--   2. RLS policies control which rows a role can read or write.
--
-- There are no INSERT/UPDATE/DELETE policies for authenticated users on the
-- live tables. Every mutation must go through a security-definer RPC that
-- re-checks authorization, so a crafted PostgREST request cannot bypass the UI.

create or replace function private.can_read_club(p_club_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.clubs c
    where c.id = p_club_id
      and (c.is_public or private.is_club_member(p_club_id))
  );
$$;

-- The policies below call these helpers for every row, so anon and
-- authenticated both need EXECUTE. They only ever report the *caller's own*
-- membership, and the private schema is not exposed through the Data API, so
-- they cannot be invoked directly from a browser.
grant execute on function
  private.is_club_member(uuid),
  private.is_club_admin(uuid),
  private.is_club_owner(uuid),
  private.can_read_session(uuid),
  private.can_read_club(uuid),
  private.club_of_session(uuid)
to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Enable RLS everywhere
-- ---------------------------------------------------------------------------
alter table public.profiles       enable row level security;
alter table public.clubs          enable row level security;
alter table public.club_members   enable row level security;
alter table public.players        enable row level security;
alter table public.sessions       enable row level security;
alter table public.courts         enable row level security;
alter table public.session_players enable row level security;
alter table public.queue_events   enable row level security;
alter table public.matches        enable row level security;
alter table public.match_players  enable row level security;
alter table public.score_audit_log enable row level security;
alter table public.club_settings  enable row level security;

-- ---------------------------------------------------------------------------
-- profiles: strictly private. Only the owner reads or writes it.
-- ---------------------------------------------------------------------------
drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles
  for select to authenticated
  using (id = auth.uid());

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- ---------------------------------------------------------------------------
-- clubs
-- ---------------------------------------------------------------------------
drop policy if exists clubs_select on public.clubs;
create policy clubs_select on public.clubs
  for select to anon, authenticated
  using (is_public or private.is_club_member(id) or created_by = auth.uid());

drop policy if exists clubs_insert on public.clubs;
create policy clubs_insert on public.clubs
  for insert to authenticated
  with check (created_by = auth.uid());

drop policy if exists clubs_update on public.clubs;
create policy clubs_update on public.clubs
  for update to authenticated
  using (private.is_club_admin(id))
  with check (private.is_club_admin(id));

drop policy if exists clubs_delete on public.clubs;
create policy clubs_delete on public.clubs
  for delete to authenticated
  using (private.is_club_owner(id));

-- ---------------------------------------------------------------------------
-- club_members: organizers manage. A member can always read their own row.
-- No insert/update policy -> membership changes only via RPC, which is what
-- stops a plain player from promoting themselves.
-- ---------------------------------------------------------------------------
drop policy if exists club_members_select on public.club_members;
create policy club_members_select on public.club_members
  for select to authenticated
  using (user_id = auth.uid() or private.is_club_admin(club_id));

drop policy if exists club_members_delete on public.club_members;
create policy club_members_delete on public.club_members
  for delete to authenticated
  using (user_id = auth.uid() or private.is_club_owner(club_id));

-- ---------------------------------------------------------------------------
-- players (roster)
-- ---------------------------------------------------------------------------
drop policy if exists players_select on public.players;
create policy players_select on public.players
  for select to anon, authenticated
  using (private.can_read_club(club_id));

-- ---------------------------------------------------------------------------
-- sessions and everything hanging off it
-- ---------------------------------------------------------------------------
drop policy if exists sessions_select on public.sessions;
create policy sessions_select on public.sessions
  for select to anon, authenticated
  using (private.can_read_session(id));

drop policy if exists courts_select on public.courts;
create policy courts_select on public.courts
  for select to anon, authenticated
  using (private.can_read_session(session_id));

drop policy if exists session_players_select on public.session_players;
create policy session_players_select on public.session_players
  for select to anon, authenticated
  using (private.can_read_session(session_id));

drop policy if exists matches_select on public.matches;
create policy matches_select on public.matches
  for select to anon, authenticated
  using (private.can_read_session(session_id));

drop policy if exists match_players_select on public.match_players;
create policy match_players_select on public.match_players
  for select to anon, authenticated
  using (private.can_read_session(session_id));

-- ---------------------------------------------------------------------------
-- Audit data: organizers only. Never public, never self-editable.
-- ---------------------------------------------------------------------------
drop policy if exists queue_events_select on public.queue_events;
create policy queue_events_select on public.queue_events
  for select to authenticated
  using (exists (
    select 1
    from public.sessions s
    where s.id = queue_events.session_id
      and private.is_club_admin(s.club_id)
  ));

drop policy if exists score_audit_log_select on public.score_audit_log;
create policy score_audit_log_select on public.score_audit_log
  for select to authenticated
  using (exists (
    select 1
    from public.matches m
    join public.sessions s on s.id = m.session_id
    where m.id = score_audit_log.match_id
      and private.is_club_admin(s.club_id)
  ));

-- ---------------------------------------------------------------------------
-- club_settings
-- ---------------------------------------------------------------------------
drop policy if exists club_settings_select on public.club_settings;
create policy club_settings_select on public.club_settings
  for select to authenticated
  using (private.is_club_member(club_id));

-- ---------------------------------------------------------------------------
-- Grants.
-- Anonymous visitors get column-level SELECT only, so auth user ids
-- (players.user_id, matches.created_by) and private profile data are never
-- reachable by an unauthenticated client.
-- ---------------------------------------------------------------------------
revoke all on all tables in schema public from anon;
revoke all on all tables in schema public from authenticated;

grant select on
  public.clubs, public.players, public.sessions, public.courts,
  public.session_players, public.matches, public.match_players,
  public.club_members, public.profiles, public.club_settings,
  public.queue_events, public.score_audit_log
to authenticated;

-- Public read model used by the live pages and by Realtime.
grant select on
  public.clubs, public.players, public.sessions, public.courts,
  public.session_players, public.match_players
to anon;

-- Narrow the anonymous grants so auth ids cannot leak.
revoke select on public.players from anon;
revoke select on public.matches from anon;
revoke select on public.sessions from anon;

grant select (
  id, club_id, display_name, skill_level, division, is_active, created_at
) on public.players to anon;

grant select (
  id, session_id, court_id, match_number, status, team1_score, team2_score,
  target_score, win_by, winning_team, matching_mode, explanation,
  staged_at, started_at, completed_at, updated_at
) on public.matches to anon;

grant select (
  id, club_id, name, status, format, matching_mode, target_score, win_by,
  court_count, is_public, results_published, started_at, ended_at
) on public.sessions to anon;

-- ---------------------------------------------------------------------------
-- Realtime: publish only the tables the live pages actually watch.
-- ---------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin
      alter publication supabase_realtime add table
        public.courts, public.session_players, public.matches, public.match_players;
    exception when duplicate_object then null;
    end;
  end if;
end $$;