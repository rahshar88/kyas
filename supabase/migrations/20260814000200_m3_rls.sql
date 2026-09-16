-- Row Level Security for the Milestone 3 tables (spec §13.1, §20)
--
-- Same posture as the earlier milestones: a student reaches their own rows and nothing else,
-- privileged writes belong to Edge Functions, and grants are stated explicitly because
-- 20260808000400_lock_down_anon.sql revoked everything from `authenticated` and set default
-- privileges to deny it. A new table is unreachable until named here — forgetting a grant
-- produces a broken feature, forgetting a revoke produces a data leak.

-- ------------------------------------------------------------- feature flags

/**
 * Readable by any signed-in student, writable by nobody with a client session.
 *
 * A client that could write here would turn its own unreleased features on, which is the one
 * thing §6.5 exists to prevent.
 */
alter table public.feature_flags enable row level security;

create policy "feature_flags: read" on public.feature_flags
  for select to authenticated using (true);

grant select on public.feature_flags to authenticated;

-- ------------------------------------------------------------ feature voting
--
-- Every table below that keys rows to a person also FORCEs RLS, so the policies apply to the
-- table owner as well. Without it a SECURITY DEFINER function — which runs as the owner —
-- would see every row regardless of policy, and the isolation proved by the tests would hold
-- only for direct client queries. `rls.test.sql` derives the list of tables this must be true
-- of from their columns, so a new table is covered without anyone remembering to add it.

/**
 * §S18. A student may cast, see and withdraw their own vote, and can never see another's.
 *
 * Tallies are deliberately not readable. Showing "148 people want this" from a table a client
 * can query means the client can also query who they are; a count belongs in a server-side
 * aggregate when there is a reason to show one.
 */
alter table public.feature_votes enable row level security;
alter table public.feature_votes force row level security;

create policy "feature_votes: own" on public.feature_votes
  for select to authenticated using (user_id = auth.uid());
create policy "feature_votes: cast" on public.feature_votes
  for insert to authenticated with check (user_id = auth.uid());
create policy "feature_votes: withdraw" on public.feature_votes
  for delete to authenticated using (user_id = auth.uid());

grant select, insert, delete on public.feature_votes to authenticated;

-- ------------------------------------------------------------- announcements

/**
 * §S18 announcements are for people who are in. An account still in review has no business
 * reading operational messages addressed to the beta, and `canEnterBeta` in the client makes
 * the same distinction — so the rule is stated once here where it cannot be bypassed.
 */
alter table public.announcements enable row level security;

create policy "announcements: approved readers" on public.announcements
  for select to authenticated
  using (
    active
    and exists (
      select 1 from public.profiles
       where user_id = auth.uid() and status = 'approved'
    )
  );

grant select on public.announcements to authenticated;

-- ----------------------------------------------------------------- feedback

/**
 * §S20. A student may file feedback and read their own back — the second half is what makes
 * the reference number worth returning.
 *
 * No update and no delete. Feedback is a report of what someone experienced at a moment;
 * letting it be edited afterwards would mean an operator acting on something that no longer
 * says what it said. Retraction is a support conversation, not a DELETE.
 */
alter table public.feedback enable row level security;
alter table public.feedback force row level security;

create policy "feedback: own" on public.feedback
  for select to authenticated using (user_id = auth.uid());
create policy "feedback: file" on public.feedback
  for insert to authenticated with check (user_id = auth.uid());

grant select, insert on public.feedback to authenticated;

-- --------------------------------------------------------------- push tokens

/**
 * A student registers their own device and can remove it. Reading another user's tokens would
 * expose which devices a person owns, which is exactly the kind of detail §13.2 asks us not to
 * accumulate and certainly not to share.
 */
alter table public.push_tokens enable row level security;
alter table public.push_tokens force row level security;

create policy "push_tokens: own" on public.push_tokens
  for select to authenticated using (user_id = auth.uid());
create policy "push_tokens: register" on public.push_tokens
  for insert to authenticated with check (user_id = auth.uid());
create policy "push_tokens: refresh" on public.push_tokens
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "push_tokens: remove" on public.push_tokens
  for delete to authenticated using (user_id = auth.uid());

grant select, insert, update, delete on public.push_tokens to authenticated;

-- ---------------------------------------------------------- deletion requests

/**
 * A student may read their own deletion request, and nothing else.
 *
 * Insert is **not** granted. §S22 requires the account to move to `deletion_pending` and the
 * session to end, and status is server-controlled (§11.2) — so the request and the status
 * change have to happen together, in a function, or an interrupted client leaves an account
 * marked for deletion that still works, or a request nobody will action.
 */
alter table public.deletion_requests enable row level security;
alter table public.deletion_requests force row level security;

create policy "deletion_requests: own" on public.deletion_requests
  for select to authenticated using (user_id = auth.uid());

grant select on public.deletion_requests to authenticated;

-- ------------------------------------------------------------- referral codes

/**
 * §S19. The owner of a referral invite may read that row — and only that row.
 *
 * Milestone 1 made `invites` unreachable to every client session, because it is the ledger
 * that says which codes exist. That still holds for founder and campaign invites. What opens
 * here is exactly one thing: the row you own, so S19 can show you your own code, your
 * capacity and how many people have used it.
 *
 * `owner_user_id = auth.uid()` is the whole policy. There is no path to a code you were not
 * given, and no update or delete: capacity and redemption count are server-controlled.
 */
create policy "invites: own referral" on public.invites
  for select to authenticated using (owner_user_id = auth.uid());

grant select on public.invites to authenticated;
