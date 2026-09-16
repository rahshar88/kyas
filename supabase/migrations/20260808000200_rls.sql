-- Row Level Security (spec §13.1, §20)
--
-- §13.1: "Row Level Security enabled before any beta user is added."
-- §20:   "Row Level Security tests prove that one user cannot read another user's private
--         records."
--
-- The shape of these policies:
--   * A student may read and update ONLY their own rows.
--   * A student may never read another student's rows — not even a public-safe profile.
--     Milestone 6 ("Find Your People") is what opens that up, gated on profile_visibility,
--     and it must arrive with its own policies. Until then the safe default is deny.
--   * Status is server-controlled: a student cannot promote themselves to 'approved'.
--   * Invitations are never selectable by clients. Redemption happens in an Edge Function
--     running with elevated rights, because a readable invites table would let anyone
--     enumerate codes.
--
-- Every table below has RLS enabled AND at least one policy. An enabled table with no policy
-- denies everything, which is safe but usually a mistake; a table with policies and RLS
-- disabled is the dangerous inverse. Both are asserted in supabase/tests.

-- ---------------------------------------------------------------- profiles

alter table public.profiles enable row level security;
alter table public.profiles force row level security;

create policy "profiles: read own"
  on public.profiles for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "profiles: insert own"
  on public.profiles for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

-- A student may edit their display name and avatar. They may NOT change `status` or
-- `onboarding_version` — those are moved by Edge Functions and administrators only.
-- Postgres has no column-level WITH CHECK, so the guard is a trigger below.
create policy "profiles: update own"
  on public.profiles for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- No delete policy: account deletion goes through the request-account-deletion workflow
-- (§S22, §11.4), never a direct client delete.

create or replace function public.guard_profile_privileged_columns()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Elevated callers (Edge Functions using the service role, and administrators) bypass RLS
  -- entirely and are not subject to this guard.
  if (select auth.uid()) is null then
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

create trigger profiles_guard_privileged_columns
  before update on public.profiles
  for each row execute function public.guard_profile_privileged_columns();

-- ---------------------------------------------------------- student_profiles

alter table public.student_profiles enable row level security;
alter table public.student_profiles force row level security;

-- Private information. There is deliberately no policy that ever exposes this to another
-- student — §S14's visibility controls apply to a public-safe projection built in Milestone 6,
-- not to this table.
create policy "student_profiles: read own"
  on public.student_profiles for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "student_profiles: insert own"
  on public.student_profiles for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "student_profiles: update own"
  on public.student_profiles for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------- invites

alter table public.invites enable row level security;
alter table public.invites force row level security;

-- No client policy at all, by design. Any select policy would allow enumerating the ledger,
-- and a code hash plus a campaign name is enough to attack. Validation and redemption happen
-- in the redeem-invite Edge Function (§12.1, §12.2), which runs with elevated rights.
--
-- §S19 also depends on this: "Shared link contains an opaque code, not the inviter's user ID",
-- and the inviter's own row must not be readable by the person they invited.

-- ------------------------------------------------------- invite_redemptions

alter table public.invite_redemptions enable row level security;
alter table public.invite_redemptions force row level security;

-- A student may confirm their own redemption happened — needed to resume onboarding after a
-- reinstall — but may not see who else redeemed. §S19: "Do not reveal referred users until
-- they independently consent."
create policy "invite_redemptions: read own"
  on public.invite_redemptions for select
  to authenticated
  using ((select auth.uid()) = user_id);

-- No insert policy: only the Edge Function may write here, so the capacity check cannot be
-- bypassed by a client inserting its own redemption row.

-- ------------------------------------------------------ reference catalogues

alter table public.india_states enable row level security;
alter table public.education_providers enable row level security;

-- Readable by any signed-in user, writable by none. These drive the pickers in §S06 and §S08.
create policy "india_states: read active"
  on public.india_states for select
  to authenticated
  using (active);

create policy "education_providers: read active"
  on public.education_providers for select
  to authenticated
  using (active);

-- ---------------------------------------------------------------- grants
--
-- RLS filters rows; grants decide whether the table is reachable at all. Both are needed.
-- Nothing here grants DELETE to a client on any table.

grant usage on schema public to authenticated;

grant select, insert, update on public.profiles to authenticated;
grant select, insert, update on public.student_profiles to authenticated;
grant select on public.invite_redemptions to authenticated;
grant select on public.india_states to authenticated;
grant select on public.education_providers to authenticated;

-- Explicitly NOT granted to authenticated: public.invites (any access), and delete on
-- everything.
revoke all on public.invites from authenticated;
