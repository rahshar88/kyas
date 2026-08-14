-- Correct the privileged-column guard's notion of authority (spec §11.2)
--
-- 20260808000200_rls.sql guards `profiles.status` and `profiles.onboarding_version` against
-- client edits with a trigger that let a change through when `auth.uid()` was null:
--
--     if (select auth.uid()) is null then return new; end if;
--
-- That works for the Edge Functions written in Milestone 1, which connect with the service
-- role and carry no JWT — but it is testing the wrong thing. "Has no JWT claim" describes how
-- a caller connected, not whether it holds authority, and the two come apart as soon as a
-- SECURITY DEFINER function runs on behalf of a signed-in user.
--
-- Which is exactly what Milestone 2 added. `submit_registration` must move status to
-- `pending_review`; it is invoked by a request that does carry the student's JWT, so
-- `auth.uid()` is their id, and the guard refused its own server-side transition with
-- "account status is server-controlled". The registration could never be submitted.
--
-- The right discriminator is `current_user`, which Postgres sets to the function owner inside
-- a SECURITY DEFINER body and leaves as the caller's role otherwise. A client cannot forge it:
-- becoming `postgres` requires going through one of the definer functions in this repository,
-- each of which decides for itself what it will permit.

/**
 * Note the missing SECURITY DEFINER, which the original had.
 *
 * It was never needed — this function reads OLD and NEW and touches no table — and it was
 * actively harmful to the fix: inside a SECURITY DEFINER body, `current_user` is the function
 * owner, so the trigger would have seen `postgres` for every caller including a student, and
 * the guard would have permitted everything.
 *
 * As SECURITY INVOKER it runs as whichever role is active at the moment of the UPDATE, which
 * is precisely the question being asked.
 */
create or replace function public.guard_profile_privileged_columns()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  /**
   * `authenticated` is the only role that reaches this table with a client session. Inside
   * submit_registration, admin_review_registration and admin_set_suspension — all SECURITY
   * DEFINER — current_user is the owner instead, and those functions have already made their
   * own authorisation decision before touching status.
   *
   * `service_role` is likewise trusted: it is the Edge Function runtime, and it bypasses RLS
   * entirely, so a guard here would be theatre rather than protection.
   */
  if current_user <> 'authenticated' then
    return new;
  end if;

  if new.status is distinct from old.status then
    raise exception 'account status is server-controlled (spec §11.2)'
      using errcode = 'insufficient_privilege';
  end if;

  if new.onboarding_version is distinct from old.onboarding_version then
    raise exception 'onboarding_version is server-controlled'
      using errcode = 'insufficient_privilege';
  end if;

  return new;
end;
$$;

comment on function public.guard_profile_privileged_columns is
  'Blocks a signed-in student from editing server-controlled columns (spec §11.2). Keyed on
   current_user, not on the presence of a JWT: a SECURITY DEFINER function acting for a
   signed-in user has authority the user does not.';
