-- Remove the anonymous role's default access (spec §13.1)
--
-- Supabase grants ALL on every new table in `public` to `anon`, `authenticated` and
-- `service_role` by default. Our policies already stop an anonymous caller reading anything —
-- verified against the live project, where `anon` received 0 rows from all six tables — but
-- that leaves Row Level Security as the *only* thing standing between a stranger and the
-- data.
--
-- §13.1's posture is defence in depth: RLS decides which rows, grants decide whether the
-- table is reachable at all, and both should say no. A future table shipped without a policy
-- would otherwise be world-readable the moment it is created.
--
-- Nothing in P0 is meant to be reachable before sign-in. Every screen a signed-out user can
-- see — launch, welcome, the legal links — is static.

revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
revoke all on all functions in schema public from anon;
revoke usage on schema public from anon;

-- And stop the default from reapplying to tables added by later migrations.
alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke all on sequences from anon;
alter default privileges in schema public revoke all on functions from anon;

-- `authenticated` keeps only what 20260808000200_rls.sql granted explicitly. Re-asserted here
-- because Supabase's defaults also handed it DELETE and TRUNCATE on everything, which no
-- screen needs — account deletion runs through a reviewed workflow (§S22, §11.4), never a
-- direct client delete.
revoke all on all tables in schema public from authenticated;

grant usage on schema public to authenticated;
grant select, insert, update on public.profiles to authenticated;
grant select, insert, update on public.student_profiles to authenticated;
grant select on public.invite_redemptions to authenticated;
grant select on public.india_states to authenticated;
grant select on public.education_providers to authenticated;
