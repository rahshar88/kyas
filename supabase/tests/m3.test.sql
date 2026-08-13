-- Milestone 3 database behaviour (spec §20, §S18–§S22)
--
-- Two kinds of claim are proved here:
--
--   * Isolation — a tester cannot reach another tester's votes, feedback, devices, deletion
--     request or referral code. §20 requires that "one user cannot read another user's private
--     records", and Milestone 3 adds five tables that would each be a leak on their own.
--   * Behaviour — referral issuance, deletion and feedback references do what §S19, §S20 and
--     §S22 say, including on the second call, which is where the interesting bugs live.
--
-- Runs in one transaction that is rolled back. Run with: pnpm run test:rls

\set ON_ERROR_STOP on

begin;

create or replace function pg_temp.assert(condition boolean, description text)
returns void
language plpgsql
as $$
begin
  if condition then
    raise notice '  ok   %', description;
  else
    raise exception 'FAILED: %', description;
  end if;
end;
$$;

-- Asha is approved and in the beta. Rohan is a second approved tester she must never see.
-- Priya is still under review, which is its own set of rules.
insert into auth.users (id, email) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'asha@example.test'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'rohan@example.test'),
  ('dddddddd-0000-0000-0000-000000000004', 'priya@example.test');

insert into public.profiles (user_id, display_name, status) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Asha', 'approved'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'Rohan', 'approved'),
  ('dddddddd-0000-0000-0000-000000000004', 'Priya', 'pending_review');

insert into public.announcements (title, body) values
  ('Welcome to the beta', 'Thanks for being early.');
insert into public.announcements (title, body, active) values
  ('Old news', 'This was retired.', false);

-- Rohan's data, which Asha must not be able to see.
insert into public.feature_votes (user_id, feature_key) values
  ('bbbbbbbb-0000-0000-0000-000000000002', 'discovery_enabled');
insert into public.feedback (user_id, category, comment, rating) values
  ('bbbbbbbb-0000-0000-0000-000000000002', 'bug', 'The invite screen scrolled oddly.', 3);
insert into public.push_tokens (token, user_id, platform) values
  ('ExponentPushToken[rohan]', 'bbbbbbbb-0000-0000-0000-000000000002', 'ios');
insert into public.deletion_requests (user_id) values
  ('bbbbbbbb-0000-0000-0000-000000000002');
insert into public.invites (code_hash, code_plain, owner_user_id, campaign, capacity) values
  ('hash-rohan', 'ROHAN01', 'bbbbbbbb-0000-0000-0000-000000000002', 'referral', 3);

-- ------------------------------------------------------------------ isolation

set local role authenticated;
set local request.jwt.claim.sub = 'aaaaaaaa-0000-0000-0000-000000000001';

do $$
declare
  visible integer;
  tbl text;
begin
  raise notice 'cross-user isolation (§20)';

  foreach tbl in array array[
    'feature_votes', 'feedback', 'push_tokens', 'deletion_requests'
  ]
  loop
    execute format('select count(*) from public.%I', tbl) into visible;
    perform pg_temp.assert(
      visible = 0,
      format('a tester sees nothing of another tester in public.%s', tbl)
    );
  end loop;
end
$$;

/**
 * §S19 acceptance: "Shared link contains an opaque code, not the inviter's user ID."
 *
 * The stronger property is the one tested here: a code belongs to exactly one person, and
 * `invites` is otherwise still the closed ledger Milestone 1 made it. Opening a row for its
 * owner is a narrow exception, and this is what proves it stayed narrow.
 */
do $$
declare
  visible integer;
begin
  raise notice 'S19 referral codes';

  select count(*) into visible from public.invites;
  perform pg_temp.assert(visible = 0, 'a tester cannot read a referral code that is not theirs');

  select count(*) into visible
    from public.invites where code_plain = 'ROHAN01';
  perform pg_temp.assert(visible = 0, 'nor find one by guessing at the code itself');
end
$$;

-- §S18: announcements are for people who are in, and retired ones are for nobody.
do $$
declare
  visible integer;
begin
  raise notice 'S18 announcements';

  select count(*) into visible from public.announcements;
  perform pg_temp.assert(visible = 1, 'an approved tester sees the live announcement');

  select count(*) into visible from public.announcements where not active;
  perform pg_temp.assert(visible = 0, 'a retired announcement is not readable at all');
end
$$;

-- Approved is doing real work in that policy, so prove it by changing only the status.
set local request.jwt.claim.sub = 'dddddddd-0000-0000-0000-000000000004';

do $$
declare
  visible integer;
begin
  select count(*) into visible from public.announcements;
  perform pg_temp.assert(
    visible = 0,
    'an account still under review sees no beta announcements'
  );
end
$$;

set local request.jwt.claim.sub = 'aaaaaaaa-0000-0000-0000-000000000001';

-- ------------------------------------------------------------- own-row access

/** The screens are useless if the owner cannot reach their own rows, so prove both halves. */
do $$
declare
  changed integer;
  v_reference text;
begin
  raise notice 'a tester can manage their own rows';

  insert into public.feature_votes (user_id, feature_key)
    values ('aaaaaaaa-0000-0000-0000-000000000001', 'discovery_enabled');
  get diagnostics changed = row_count;
  perform pg_temp.assert(changed = 1, 'a tester can vote for a feature (§S18)');

  delete from public.feature_votes
   where user_id = 'aaaaaaaa-0000-0000-0000-000000000001'
     and feature_key = 'discovery_enabled';
  get diagnostics changed = row_count;
  perform pg_temp.assert(changed = 1, 'and withdraw the vote');

  delete from public.feature_votes where user_id = 'bbbbbbbb-0000-0000-0000-000000000002';
  get diagnostics changed = row_count;
  perform pg_temp.assert(changed = 0, 'but cannot withdraw someone else''s');

  insert into public.push_tokens (token, user_id, platform)
    values ('ExponentPushToken[asha]', 'aaaaaaaa-0000-0000-0000-000000000001', 'ios');
  get diagnostics changed = row_count;
  perform pg_temp.assert(changed = 1, 'a tester can register their own device');

  insert into public.feedback (user_id, category, comment, rating)
    values ('aaaaaaaa-0000-0000-0000-000000000001', 'confusing', 'I could not find settings.', 4)
    returning reference into v_reference;

  -- §S20 acceptance: "returns a reference number". It has to come back to the caller, or the
  -- screen has nothing to show and the person has nothing to quote to support.
  perform pg_temp.assert(
    v_reference ~ '^KYA-[A-Z2-9]{6}$',
    format('filing feedback returns a readable reference (%s)', v_reference)
  );
end
$$;

/**
 * §S18: one vote per person per feature.
 *
 * Enforced by the primary key rather than by the screen, because a screen cannot see a second
 * device — and a vote count that can be inflated by reinstalling the app measures nothing.
 */
do $$
declare
  blocked boolean := false;
begin
  insert into public.feature_votes (user_id, feature_key)
    values ('aaaaaaaa-0000-0000-0000-000000000001', 'scene_feed_enabled');

  begin
    insert into public.feature_votes (user_id, feature_key)
      values ('aaaaaaaa-0000-0000-0000-000000000001', 'scene_feed_enabled');
  exception
    when unique_violation then blocked := true;
  end;

  perform pg_temp.assert(blocked, 'a second vote for the same feature is refused');
end
$$;

/**
 * §S20: feedback is a report of what someone experienced at a moment.
 *
 * Editing it afterwards would mean an operator acting on something that no longer says what it
 * said when they read it. Retraction is a support conversation, not an UPDATE.
 */
do $$
declare
  blocked boolean := false;
  changed integer;
begin
  raise notice 'S20 feedback cannot be rewritten';

  begin
    update public.feedback set comment = 'Actually it was fine.'
     where user_id = 'aaaaaaaa-0000-0000-0000-000000000001';
    get diagnostics changed = row_count;
    blocked := changed = 0;
  exception
    when insufficient_privilege then blocked := true;
  end;

  perform pg_temp.assert(blocked, 'a tester cannot edit feedback they already filed');

  blocked := false;
  begin
    delete from public.feedback where user_id = 'aaaaaaaa-0000-0000-0000-000000000001';
    get diagnostics changed = row_count;
    blocked := changed = 0;
  exception
    when insufficient_privilege then blocked := true;
  end;

  perform pg_temp.assert(blocked, 'nor delete it');
end
$$;

/** §S22: a client cannot mark itself for deletion — that has to move status too. */
do $$
declare
  blocked boolean := false;
begin
  begin
    insert into public.deletion_requests (user_id)
      values ('aaaaaaaa-0000-0000-0000-000000000001');
  exception
    when insufficient_privilege then blocked := true;
  end;

  perform pg_temp.assert(
    blocked,
    'a tester cannot insert their own deletion request, because status must move with it'
  );
end
$$;

-- ------------------------------------------------------------------ behaviour

reset role;

/**
 * §S19 — referral issuance.
 *
 * The second call is the interesting one. A dropped response, a retry or a second device must
 * all find the code that already exists; minting a rival code would give one person two
 * referral links and double their allowance.
 */
do $$
declare
  outcome public.referral_outcome;
  v_capacity integer;
  v_codes integer;
begin
  raise notice 'S19 referral issuance';

  outcome := public.ensure_referral_invite(
    'aaaaaaaa-0000-0000-0000-000000000001', 'ASHA01', 'hash-asha'
  );
  perform pg_temp.assert(outcome = 'issued', 'an approved tester is issued a referral code');

  select capacity into v_capacity
    from public.invites where owner_user_id = 'aaaaaaaa-0000-0000-0000-000000000001';
  perform pg_temp.assert(
    v_capacity = public.referral_capacity(),
    'the code carries the configured number of seats'
  );

  outcome := public.ensure_referral_invite(
    'aaaaaaaa-0000-0000-0000-000000000001', 'ASHA02', 'hash-asha-2'
  );
  perform pg_temp.assert(outcome = 'existing', 'asking again returns the existing code');

  select count(*) into v_codes
    from public.invites where owner_user_id = 'aaaaaaaa-0000-0000-0000-000000000001';
  perform pg_temp.assert(v_codes = 1, 'and does not mint a second one');

  -- §S19 is a screen inside the beta. A referral from an unvetted account would let someone
  -- still under review recruit.
  outcome := public.ensure_referral_invite(
    'dddddddd-0000-0000-0000-000000000004', 'PRIYA01', 'hash-priya'
  );
  perform pg_temp.assert(
    outcome = 'not_permitted',
    'an account under review cannot issue referrals'
  );
end
$$;

/** §S22 — deletion moves status and the request together, exactly once. */
do $$
declare
  outcome public.deletion_outcome;
  v_status public.account_status;
  v_requests integer;
begin
  raise notice 'S22 account deletion';

  outcome := public.request_account_deletion(
    'aaaaaaaa-0000-0000-0000-000000000001', '  Not for me  '
  );
  perform pg_temp.assert(outcome = 'requested', 'a deletion request is recorded');

  select status into v_status
    from public.profiles where user_id = 'aaaaaaaa-0000-0000-0000-000000000001';
  perform pg_temp.assert(
    v_status = 'deletion_pending',
    'and the account moves to deletion_pending in the same transaction (§11.2)'
  );

  outcome := public.request_account_deletion('aaaaaaaa-0000-0000-0000-000000000001', null);
  perform pg_temp.assert(
    outcome = 'already_requested',
    'a second confirmation does not open a second request'
  );

  select count(*) into v_requests
    from public.deletion_requests where user_id = 'aaaaaaaa-0000-0000-0000-000000000001';
  perform pg_temp.assert(v_requests = 1, 'exactly one open request exists');

  -- §S22: "Deactivation alone is not presented as deletion." The intent is dated, so whatever
  -- retention policy is approved later has something to act on.
  perform pg_temp.assert(
    (select scheduled_for > requested_at
       from public.deletion_requests
      where user_id = 'aaaaaaaa-0000-0000-0000-000000000001'),
    'the request carries a future date for the erasure a retention policy will define'
  );
end
$$;

/** §6.5: "Default every future flag to false." The seed is where that promise is kept. */
do $$
declare
  enabled_future integer;
begin
  raise notice 'feature flags (§6.5)';

  select count(*) into enabled_future
    from public.feature_flags
   where enabled
     and key in ('discovery_enabled', 'scene_feed_enabled', 'messaging_enabled', 'kya_enabled');

  perform pg_temp.assert(enabled_future = 0, 'no unbuilt feature is switched on');

  perform pg_temp.assert(
    (select enabled from public.feature_flags where key = 'feedback_enabled'),
    'a feature that exists is switched on'
  );
end
$$;

rollback;
