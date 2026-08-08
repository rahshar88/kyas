-- Minimal stand-in for the pieces of Supabase that the migrations depend on.
--
-- Supabase provides the `auth` schema, `auth.users`, `auth.uid()` and the `anon`,
-- `authenticated` and `service_role` roles. A plain PostgreSQL server does not, so this file
-- recreates just enough of them to run the migrations and exercise the policies.
--
-- `auth.uid()` reads `request.jwt.claim.sub` exactly as PostgREST sets it, so a test that
-- does `set local request.jwt.claim.sub = '<uuid>'` is impersonating that user the same way
-- a real request would.
--
-- This file is TEST INFRASTRUCTURE. It is never applied to a hosted Supabase project.

create schema if not exists auth;

create table if not exists auth.users (
  id uuid primary key,
  email text unique,
  created_at timestamptz not null default now()
);

create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin noinherit;
  end if;
  -- Mirrors Supabase: the service role bypasses RLS, which is why Edge Functions can do
  -- what clients cannot (§12.1).
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin noinherit bypassrls;
  end if;
end
$$;

grant usage on schema auth to authenticated, anon, service_role;
