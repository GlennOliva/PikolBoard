-- Minimal Supabase emulator shim for offline migration validation.
--
-- The real Supabase cloud database provides these roles, the `auth` schema with
-- `auth.uid()` / `auth.jwt()`, and `storage`. This recreates just enough of
-- that surface for the P0 migrations to run against plain PostgreSQL 17.
--
-- Roles, exactly as the migrations expect them.

-- Roles first. Every grant below and in the migrations names them, and
-- GRANT to a role that does not exist yet is an error, so the DO block has to
-- precede the first grant rather than follow it.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin noinherit bypassrls;
  end if;
end;
$$;

create schema if not exists auth;
create schema if not exists extensions;
create schema if not exists private;

-- Profiles and club rows reference auth.users(id), so the table has to exist
-- before migration 0001 runs. On cloud Supabase this is managed for us; here we
-- create the minimum needed for the foreign keys to resolve. Tests insert into
-- it directly to simulate signed-up users.
-- Column shape mirrors GoTrue's auth.users closely enough for the
-- handle_new_user trigger in migration 0001 to compile and run.
create table if not exists auth.users (
  id uuid primary key,
  email text unique,
  raw_user_meta_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

grant select, insert, update, delete on auth.users to anon, authenticated, service_role;

grant usage on schema public, auth, extensions to anon, authenticated, service_role;

-- auth.uid() reads the sub claim from the current request JWT. Tests set it
-- with `set local request.jwt.claims = '{"sub": "..."}'`.
create or replace function auth.jwt()
returns jsonb
language sql
stable
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claims', true), '')::jsonb,
    '{}'::jsonb
  );
$$;

create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select nullif(auth.jwt() ->> 'sub', '')::uuid;
$$;

create or replace function auth.role()
returns text
language sql
stable
as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role', current_user);
$$;

-- Realtime publication that the RLS migration adds tables to.
do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
end;
$$;
