-- Row Level Security for the Milestone 2 tables (spec §13.1, §15.2, §20)
--
-- Same posture as 20260808000200_rls.sql: a student reaches their own rows and nothing else,
-- privileged transitions belong to Edge Functions, and administrative tables are unreachable
-- from any client session.
--
-- Grants are re-stated explicitly because 20260808000400_lock_down_anon.sql revoked
-- everything from `authenticated` and set default privileges to deny `anon`. A new table is
-- therefore unreachable until it is named here, which is the correct default — forgetting a
-- grant produces a broken feature, while forgetting a revoke produces a data leak.

-- ------------------------------------------------------- reference catalogues

-- Readable by any signed-in student; writable by nobody with a client session. The pickers in
-- S09–S12 break without the read, so this is deliberately permissive on select only.
alter table public.languages enable row level security;
alter table public.communities enable row level security;
alter table public.interests enable row level security;
alter table public.goals enable row level security;

create policy "languages: read" on public.languages
  for select to authenticated using (true);
create policy "communities: read" on public.communities
  for select to authenticated using (true);
create policy "interests: read" on public.interests
  for select to authenticated using (true);
create policy "goals: read" on public.goals
  for select to authenticated using (true);

grant select on public.languages to authenticated;
grant select on public.communities to authenticated;
grant select on public.interests to authenticated;
grant select on public.goals to authenticated;

-- ------------------------------------------------------------ user relations

/**
 * The four selection tables share one shape: a student may read, add and remove their own
 * rows. DELETE is granted here — unlike on profiles — because deselecting a language is an
 * ordinary edit, not an account action. There is no path to another user's rows at any status;
 * §S14's visibility settings apply to a public projection built in Milestone 6, not to these
 * tables.
 */
do $$
declare
  tbl text;
begin
  foreach tbl in array array[
    'profile_languages', 'profile_communities', 'profile_interests', 'profile_goals'
  ]
  loop
    execute format('alter table public.%I enable row level security', tbl);
    execute format('alter table public.%I force row level security', tbl);

    execute format(
      'create policy "%s: read own" on public.%I for select to authenticated
         using ((select auth.uid()) = user_id)', tbl, tbl);
    execute format(
      'create policy "%s: insert own" on public.%I for insert to authenticated
         with check ((select auth.uid()) = user_id)', tbl, tbl);
    execute format(
      'create policy "%s: delete own" on public.%I for delete to authenticated
         using ((select auth.uid()) = user_id)', tbl, tbl);

    execute format('grant select, insert, delete on public.%I to authenticated', tbl);
  end loop;
end
$$;

-- profile_goals additionally allows UPDATE, because re-ranking an existing goal is an update
-- rather than a delete-and-insert. The rank constraints still apply.
create policy "profile_goals: update own" on public.profile_goals
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

grant update on public.profile_goals to authenticated;

-- ---------------------------------------------------------------- S10 rule

/**
 * §S10: "Prefer not to specify clears other selections."
 *
 * A trigger rather than app code, so the rule holds regardless of the order in which a client
 * writes the flag and the rows. Doing it in the app would leave a window where both are true —
 * and "declined to say" plus a list of communities is exactly the contradiction the
 * acceptance criterion exists to prevent.
 */
create or replace function public.clear_communities_when_not_specified()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.communities_not_specified and not coalesce(old.communities_not_specified, false) then
    delete from public.profile_communities where user_id = new.user_id;
  end if;
  return new;
end;
$$;

create trigger student_profiles_clear_communities
  after update of communities_not_specified on public.student_profiles
  for each row execute function public.clear_communities_when_not_specified();

-- The inverse direction: selecting a community means you have not declined to answer.
create or replace function public.unset_communities_not_specified()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.student_profiles
     set communities_not_specified = false
   where user_id = new.user_id
     and communities_not_specified;
  return new;
end;
$$;

create trigger profile_communities_unset_not_specified
  after insert on public.profile_communities
  for each row execute function public.unset_communities_not_specified();

-- --------------------------------------------------------- profile_visibility

alter table public.profile_visibility enable row level security;
alter table public.profile_visibility force row level security;

create policy "profile_visibility: read own" on public.profile_visibility
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "profile_visibility: insert own" on public.profile_visibility
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "profile_visibility: update own" on public.profile_visibility
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

grant select, insert, update on public.profile_visibility to authenticated;

-- ---------------------------------------------------------------- consents

/**
 * §S15 evidence. A student may record their own consent and read it back, and may do nothing
 * else: no update policy and no delete policy exist, so an acceptance cannot be rewritten or
 * erased. Withdrawing consent is a new row with `accepted = false`, which keeps the history
 * that makes the record worth having.
 */
alter table public.consents enable row level security;
alter table public.consents force row level security;

create policy "consents: read own" on public.consents
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "consents: insert own" on public.consents
  for insert to authenticated with check ((select auth.uid()) = user_id);

grant select, insert on public.consents to authenticated;

-- ------------------------------------------------------ verification_requests

/**
 * §S17 needs the student to see their own review state and rejection category. They may not
 * create one: submission runs through the submit-registration Edge Function, which validates
 * the whole profile server-side (§S16: "Run server validation again") before any row exists.
 * A client-created request would be a status change a student granted themselves.
 */
alter table public.verification_requests enable row level security;
alter table public.verification_requests force row level security;

create policy "verification_requests: read own" on public.verification_requests
  for select to authenticated using ((select auth.uid()) = user_id);

grant select on public.verification_requests to authenticated;

-- ------------------------------------------------- administrative tables

/**
 * RLS enabled with NO policy, and no grant to any client role. Both halves matter: the missing
 * grant makes the table unreachable, and the enabled RLS means it stays denied even if a
 * future migration grants by accident.
 *
 * §15.2: "Never rely only on hidden navigation for authorisation." The admin console reads
 * these through Edge Functions running with elevated rights, which check membership first —
 * it never queries them with a user's own session.
 */
alter table public.admin_users enable row level security;
alter table public.admin_users force row level security;

alter table public.admin_audit_logs enable row level security;
alter table public.admin_audit_logs force row level security;

/**
 * §11.1: "Immutable administrative history."
 *
 * Enforced by trigger rather than by withholding privileges, because the Edge Functions that
 * write here use the service role, which bypasses RLS and holds every grant. A trigger fires
 * for the service role too, so append-only means append-only for everyone.
 *
 * Retention or anonymisation of old audit rows (§11.4) will need a deliberate migration that
 * drops and restores this trigger, which is the point: erasing an audit record should be a
 * reviewed schema change, never an ordinary statement.
 */
create or replace function public.admin_audit_logs_are_append_only()
returns trigger
language plpgsql
as $$
begin
  raise exception 'admin_audit_logs is append-only (spec §11.1)'
    using errcode = 'insufficient_privilege';
end;
$$;

create trigger admin_audit_logs_no_update
  before update on public.admin_audit_logs
  for each row execute function public.admin_audit_logs_are_append_only();

create trigger admin_audit_logs_no_delete
  before delete on public.admin_audit_logs
  for each row execute function public.admin_audit_logs_are_append_only();

-- ------------------------------------------------------------ anon lockdown

-- Re-asserted for the tables this migration adds. `alter default privileges` in
-- 20260808000400 should already cover them, but that only applies to objects created by the
-- same role — and a data leak is not the place to rely on "should".
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
revoke all on all functions in schema public from anon;
