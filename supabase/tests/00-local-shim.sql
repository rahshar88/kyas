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

/*
 * Reproduce Supabase's default privileges.
 *
 * A hosted Supabase project runs, in effect:
 *   alter default privileges in schema public
 *     grant all on tables to postgres, anon, authenticated, service_role;
 *
 * So every table created by a migration is reachable by the ANONYMOUS role unless something
 * revokes it. Without this line the local database is more locked-down than production, and
 * a missing revoke passes the test suite while leaving the real project exposed — which is
 * exactly what happened once. Mirroring the default keeps the tests honest.
 */
grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public
  grant all on tables to anon, authenticated, service_role;

-- ------------------------------------------------------------------ storage
--
-- The minimum of Supabase Storage needed for migrations that create buckets and policies to
-- apply against plain PostgreSQL. Hosted Supabase ships this schema; the CI database does
-- not. Only what the avatar migration touches is recreated — this is a shim, not a port.

create schema if not exists storage;

create table if not exists storage.buckets (
  id text primary key,
  name text not null,
  public boolean not null default false,
  file_size_limit bigint,
  allowed_mime_types text[]
);

create table if not exists storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text references storage.buckets (id),
  name text,
  owner uuid,
  created_at timestamptz default now()
);

-- Hosted signature: splits 'user-id/avatar.jpg' into its folder steps.
create or replace function storage.foldername(name text)
returns text[] language sql immutable as $$
  select (string_to_array(name, '/'))[1 : array_length(string_to_array(name, '/'), 1) - 1];
$$;

-- Hosted storage.objects ships with RLS enabled; the policies in the avatar migration are
-- meaningless against a shim table that does not.
alter table storage.objects enable row level security;

grant usage on schema storage to authenticated, anon;
grant select, insert, update, delete on storage.objects to authenticated;
grant select on storage.buckets to authenticated;
