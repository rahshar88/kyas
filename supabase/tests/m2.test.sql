-- Milestone 2 database behaviour (spec §20, §S09–S17, §15.2)
--
-- Two things are proved here, and they are different in kind:
--
--   * Isolation — a student cannot reach another student's languages, communities, interests,
--     goals, privacy settings, consent evidence or review state. This is §20's requirement
--     that "one user cannot read another user's private records", extended to every table
--     Milestone 2 adds.
--   * Behaviour — the submission and review functions do what §S16 and §15.2 say, including
--     under a repeated tap and against an unauthorised caller.
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

-- Asha is mid-registration. Rohan is a second student she must never see. Meera is an operator.
insert into auth.users (id, email) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'asha@example.test'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'rohan@example.test'),
  ('cccccccc-0000-0000-0000-000000000003', 'meera@example.test');

insert into public.profiles (user_id, display_name, status) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Asha', 'onboarding'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'Rohan', 'onboarding'),
  ('cccccccc-0000-0000-0000-000000000003', 'Meera', 'approved');

insert into public.admin_users (user_id, role) values
  ('cccccccc-0000-0000-0000-000000000003', 'administrator');

-- Rohan's data, which Asha must not be able to see.
insert into public.student_profiles (user_id, suburb, hometown) values
  ('bbbbbbbb-0000-0000-0000-000000000002', 'Parramatta', 'Ludhiana');
insert into public.profile_languages (user_id, language_code, proficiency) values
  ('bbbbbbbb-0000-0000-0000-000000000002', 'punjabi', 'native');
insert into public.profile_communities (user_id, community_code) values
  ('bbbbbbbb-0000-0000-0000-000000000002', 'punjabi');
insert into public.profile_interests (user_id, interest_code) values
  ('bbbbbbbb-0000-0000-0000-000000000002', 'cricket');
insert into public.profile_goals (user_id, goal_code, rank) values
  ('bbbbbbbb-0000-0000-0000-000000000002', 'meet_people', 1);
insert into public.profile_visibility (user_id, show_suburb) values
  ('bbbbbbbb-0000-0000-0000-000000000002', true);
insert into public.consents (user_id, policy_type, version, accepted) values
  ('bbbbbbbb-0000-0000-0000-000000000002', 'terms', '2026-08-01', true);
insert into public.verification_requests (user_id) values
  ('bbbbbbbb-0000-0000-0000-000000000002');

-- ------------------------------------------------------------ isolation

set local role authenticated;
set local request.jwt.claim.sub = 'aaaaaaaa-0000-0000-0000-000000000001';

do $$
declare
  visible integer;
  tbl text;
begin
  raise notice 'cross-user isolation (§20)';

  foreach tbl in array array[
    'profile_languages', 'profile_communities', 'profile_interests', 'profile_goals',
    'profile_visibility', 'consents', 'verification_requests'
  ]
  loop
    execute format('select count(*) from public.%I', tbl) into visible;
    perform pg_temp.assert(
      visible = 0,
      format('a student sees nothing of another student in public.%s', tbl)
    );
  end loop;
end
$$;

-- §S14: a privacy setting saying "show my suburb" applies to a future public projection, not
-- to this table. Nothing in P0 exposes one student's row to another, and a test that assumed
-- otherwise would quietly bless a leak the moment Milestone 6 lands.
do $$
declare
  visible integer;
begin
  select count(*) into visible
    from public.profile_visibility where show_suburb;
  perform pg_temp.assert(
    visible = 0,
    'a student opting to show their suburb does not become readable to another student'
  );
end
$$;

-- The four selection tables must still be usable by their owner, or the screens do not work.
do $$
declare
  changed integer;
begin
  raise notice 'a student can manage their own selections';

  insert into public.profile_languages (user_id, language_code, proficiency)
    values ('aaaaaaaa-0000-0000-0000-000000000001', 'hindi', 'native');
  get diagnostics changed = row_count;
  perform pg_temp.assert(changed = 1, 'a student can add their own language (§S09)');

  delete from public.profile_languages
   where user_id = 'aaaaaaaa-0000-0000-0000-000000000001' and language_code = 'hindi';
  get diagnostics changed = row_count;
  perform pg_temp.assert(changed = 1, 'a student can remove their own language');

  delete from public.profile_languages
   where user_id = 'bbbbbbbb-0000-0000-0000-000000000002';
  get diagnostics changed = row_count;
  perform pg_temp.assert(changed = 0, 'a student cannot delete another student''s language');
end
$$;

-- §S09 acceptance: "Duplicate language entries are prevented."
do $$
declare
  blocked boolean := false;
begin
  raise notice 'S09 duplicates';

  insert into public.profile_languages (user_id, language_code, proficiency)
    values ('aaaaaaaa-0000-0000-0000-000000000001', 'hindi', 'native');
  begin
    insert into public.profile_languages (user_id, language_code, proficiency)
      values ('aaaaaaaa-0000-0000-0000-000000000001', 'hindi', 'fluent');
  exception
    when unique_violation then blocked := true;
  end;

  perform pg_temp.assert(blocked, 'a duplicate language entry is refused by the database');
end
$$;

-- §S12: "Select up to five and rank the top need."
do $$
declare
  blocked boolean := false;
begin
  raise notice 'S12 goal ranking';

  insert into public.profile_goals (user_id, goal_code, rank) values
    ('aaaaaaaa-0000-0000-0000-000000000001', 'meet_people', 1),
    ('aaaaaaaa-0000-0000-0000-000000000001', 'find_events', 2),
    ('aaaaaaaa-0000-0000-0000-000000000001', 'jobs', 3),
    ('aaaaaaaa-0000-0000-0000-000000000001', 'food', 4),
    ('aaaaaaaa-0000-0000-0000-000000000001', 'sport', 5);

  begin
    insert into public.profile_goals (user_id, goal_code, rank)
      values ('aaaaaaaa-0000-0000-0000-000000000001', 'accommodation', 6);
  exception
    when check_violation then blocked := true;
  end;

  perform pg_temp.assert(blocked, 'a sixth goal has no valid rank and is refused');

  blocked := false;
  begin
    insert into public.profile_goals (user_id, goal_code, rank)
      values ('aaaaaaaa-0000-0000-0000-000000000001', 'accommodation', 3);
  exception
    when unique_violation then blocked := true;
  end;

  perform pg_temp.assert(blocked, 'two goals cannot share a rank');
end
$$;

-- §S15: consent is evidence, so it cannot be rewritten or erased by the person it concerns.
do $$
declare
  blocked boolean := false;
  remaining integer;
begin
  raise notice 'S15 consent is append-only';

  insert into public.consents (user_id, policy_type, version, accepted)
    values ('aaaaaaaa-0000-0000-0000-000000000001', 'terms', '2026-08-01', true);

  begin
    update public.consents set accepted = false
     where user_id = 'aaaaaaaa-0000-0000-0000-000000000001';
    blocked := false;
  exception
    when insufficient_privilege then blocked := true;
  end;

  select count(*) into remaining
    from public.consents
   where user_id = 'aaaaaaaa-0000-0000-0000-000000000001' and accepted;
  perform pg_temp.assert(remaining = 1, 'a student cannot flip their own recorded consent');

  begin
    delete from public.consents where user_id = 'aaaaaaaa-0000-0000-0000-000000000001';
  exception
    when insufficient_privilege then null;
  end;

  select count(*) into remaining
    from public.consents where user_id = 'aaaaaaaa-0000-0000-0000-000000000001';
  perform pg_temp.assert(remaining = 1, 'a student cannot delete their own consent evidence');
end
$$;

-- §S17: a student may read their own review state, and may not create or alter one.
do $$
declare
  blocked boolean := false;
begin
  raise notice 'S17 review state';

  begin
    insert into public.verification_requests (user_id)
      values ('aaaaaaaa-0000-0000-0000-000000000001');
  exception
    when insufficient_privilege then blocked := true;
  end;

  perform pg_temp.assert(blocked, 'a student cannot submit themselves for review directly');
end
$$;

-- §15.2: administrative tables are unreachable from any client session.
do $$
declare
  blocked boolean;
  tbl text;
begin
  raise notice 'administrative tables (§15.2)';

  foreach tbl in array array['admin_users', 'admin_audit_logs']
  loop
    blocked := false;
    begin
      execute format('select 1 from public.%I limit 1', tbl);
    exception
      when insufficient_privilege then blocked := true;
    end;
    perform pg_temp.assert(blocked, format('a student cannot read public.%s', tbl));
  end loop;
end
$$;

reset role;

-- Anonymous callers must not reach the Milestone 2 tables either.
do $$
declare
  blocked boolean;
  tbl text;
begin
  raise notice 'anonymous access to Milestone 2 tables';

  set local role anon;

  foreach tbl in array array[
    'languages', 'communities', 'interests', 'goals',
    'profile_languages', 'profile_communities', 'profile_interests', 'profile_goals',
    'profile_visibility', 'consents', 'verification_requests',
    'admin_users', 'admin_audit_logs'
  ]
  loop
    blocked := false;
    begin
      execute format('select 1 from public.%I limit 1', tbl);
    exception
      when insufficient_privilege then blocked := true;
    end;
    perform pg_temp.assert(blocked, format('anon cannot reach public.%s', tbl));
  end loop;

  reset role;
end
$$;

-- ---------------------------------------------------------- S10 clearing rule

do $$
declare
  remaining integer;
  flag boolean;
begin
  raise notice 'S10 prefer-not-to-specify';

  insert into public.student_profiles (user_id, suburb)
    values ('aaaaaaaa-0000-0000-0000-000000000001', 'Ultimo');
  insert into public.profile_communities (user_id, community_code) values
    ('aaaaaaaa-0000-0000-0000-000000000001', 'punjabi'),
    ('aaaaaaaa-0000-0000-0000-000000000001', 'goan');

  update public.student_profiles set communities_not_specified = true
   where user_id = 'aaaaaaaa-0000-0000-0000-000000000001';

  select count(*) into remaining
    from public.profile_communities
   where user_id = 'aaaaaaaa-0000-0000-0000-000000000001';

  perform pg_temp.assert(
    remaining = 0,
    'choosing "prefer not to specify" clears existing community selections (§S10)'
  );

  -- And the inverse: choosing a community means you have not declined to answer, so the two
  -- can never both be true whichever order a client writes them in.
  insert into public.profile_communities (user_id, community_code)
    values ('aaaaaaaa-0000-0000-0000-000000000001', 'marathi');

  select communities_not_specified into flag
    from public.student_profiles
   where user_id = 'aaaaaaaa-0000-0000-0000-000000000001';

  perform pg_temp.assert(
    not flag,
    'selecting a community clears "prefer not to specify"'
  );
end
$$;

-- ------------------------------------------------------ S16 submission rules

do $$
declare
  result public.submit_registration_result;
begin
  raise notice 'S16 submission';

  -- Asha has not redeemed an invitation, so this is not merely incomplete.
  result := public.submit_registration(
    'aaaaaaaa-0000-0000-0000-000000000001', '2026-08-01'
  );
  perform pg_temp.assert(
    result.outcome = 'not_permitted',
    'a student who never redeemed an invitation cannot submit (§S04)'
  );

  insert into public.invites (id, code_hash, capacity, redeemed_count)
    values ('dddddddd-0000-0000-0000-000000000004', 'digest', 10, 1);
  insert into public.invite_redemptions (invite_id, user_id)
    values ('dddddddd-0000-0000-0000-000000000004', 'aaaaaaaa-0000-0000-0000-000000000001');

  result := public.submit_registration(
    'aaaaaaaa-0000-0000-0000-000000000001', '2026-08-01'
  );
  perform pg_temp.assert(
    result.outcome = 'incomplete',
    'an unfinished registration is reported incomplete, not submitted'
  );
  -- Array containment rather than repeated `= any(...)`: plpgsql resolves the latter against
  -- a composite field inconsistently, and the failure it produces ("malformed array literal")
  -- points nowhere near the cause.
  perform pg_temp.assert(
    result.missing @> array['study', 'interests', 'consent', 'privacy'],
    'the missing list names each unfinished step so the app can route to it'
  );
end
$$;

-- Complete the registration, then submit for real.
do $$
declare
  result public.submit_registration_result;
  pending integer;
  v_status public.account_status;
begin
  update public.student_profiles set
    provider = 'uts', course = 'Information Technology', study_level = 'master',
    intake_month = 2, intake_year = 2026, arrival_status = 'in_sydney',
    india_state_code = 'IN-KL'
  where user_id = 'aaaaaaaa-0000-0000-0000-000000000001';

  insert into public.profile_languages (user_id, language_code, proficiency) values
    ('aaaaaaaa-0000-0000-0000-000000000001', 'english', 'fluent');
  insert into public.profile_interests (user_id, interest_code) values
    ('aaaaaaaa-0000-0000-0000-000000000001', 'cricket'),
    ('aaaaaaaa-0000-0000-0000-000000000001', 'music'),
    ('aaaaaaaa-0000-0000-0000-000000000001', 'startups');
  insert into public.profile_visibility (user_id) values
    ('aaaaaaaa-0000-0000-0000-000000000001');
  insert into public.consents (user_id, policy_type, version, accepted) values
    ('aaaaaaaa-0000-0000-0000-000000000001', 'privacy', '2026-08-01', true),
    ('aaaaaaaa-0000-0000-0000-000000000001', 'community_guidelines', '2026-08-01', true),
    ('aaaaaaaa-0000-0000-0000-000000000001', 'beta_changes', '2026-08-01', true);

  -- §S15: marketing is declined, and that must not block submission.
  insert into public.consents (user_id, policy_type, version, accepted) values
    ('aaaaaaaa-0000-0000-0000-000000000001', 'marketing', '2026-08-01', false);

  result := public.submit_registration(
    'aaaaaaaa-0000-0000-0000-000000000001', '2026-08-01'
  );
  perform pg_temp.assert(
    result.outcome = 'submitted',
    'a complete registration submits, with marketing consent declined (§S15)'
  );

  select status into v_status
    from public.profiles where user_id = 'aaaaaaaa-0000-0000-0000-000000000001';
  perform pg_temp.assert(v_status = 'pending_review', 'submission moves status to pending_review');

  -- §S16 acceptance: "Repeated taps cannot create duplicate registration records."
  result := public.submit_registration(
    'aaaaaaaa-0000-0000-0000-000000000001', '2026-08-01'
  );
  perform pg_temp.assert(
    result.outcome = 'already_submitted',
    'a second submission returns already_submitted rather than raising'
  );

  select count(*) into pending
    from public.verification_requests
   where user_id = 'aaaaaaaa-0000-0000-0000-000000000001';
  perform pg_temp.assert(pending = 1, 'a repeated tap creates exactly one review request');
end
$$;

-- A consent given against a superseded policy version does not count.
do $$
declare
  result public.submit_registration_result;
begin
  result := public.submit_registration(
    'bbbbbbbb-0000-0000-0000-000000000002', '2099-01-01'
  );
  perform pg_temp.assert(
    result.outcome in ('incomplete', 'already_submitted', 'not_permitted'),
    'a superseded policy version never yields a silent submission'
  );
end
$$;

-- ------------------------------------------------------------ admin review

do $$
declare
  outcome public.admin_review_outcome;
  audit_rows integer;
  v_status public.account_status;
begin
  raise notice 'admin review (§13.1, §15.2)';

  -- §15.2: authorisation is not hidden navigation. Rohan is an ordinary student.
  outcome := public.admin_review_registration(
    'bbbbbbbb-0000-0000-0000-000000000002',
    'aaaaaaaa-0000-0000-0000-000000000001',
    true, 'looks fine to me'
  );
  perform pg_temp.assert(
    outcome = 'not_permitted',
    'a non-admin cannot approve a registration'
  );

  select count(*) into audit_rows from public.admin_audit_logs;
  perform pg_temp.assert(audit_rows = 0, 'a refused action writes no audit record');

  -- §15.2: "Sensitive actions require a reason."
  outcome := public.admin_review_registration(
    'cccccccc-0000-0000-0000-000000000003',
    'aaaaaaaa-0000-0000-0000-000000000001',
    true, '  '
  );
  perform pg_temp.assert(outcome = 'invalid_request', 'an approval with no reason is refused');

  -- A rejection with no category leaves the student nothing actionable on S17.
  outcome := public.admin_review_registration(
    'cccccccc-0000-0000-0000-000000000003',
    'aaaaaaaa-0000-0000-0000-000000000001',
    false, 'not a student', null
  );
  perform pg_temp.assert(
    outcome = 'invalid_request',
    'a rejection without a category is refused'
  );

  -- The real decision.
  outcome := public.admin_review_registration(
    'cccccccc-0000-0000-0000-000000000003',
    'aaaaaaaa-0000-0000-0000-000000000001',
    true, 'verified enrolment via institutional email'
  );
  perform pg_temp.assert(outcome = 'approved', 'an operator can approve a pending registration');

  select status into v_status
    from public.profiles where user_id = 'aaaaaaaa-0000-0000-0000-000000000001';
  perform pg_temp.assert(v_status = 'approved', 'approval moves the account to approved');

  select count(*) into audit_rows
    from public.admin_audit_logs
   where action = 'registration_approved'
     and target_user_id = 'aaaaaaaa-0000-0000-0000-000000000001';
  perform pg_temp.assert(audit_rows = 1, 'the decision is audited (§11.2)');

  -- §S16: the queue is shared, so a second operator acting on the same row is a normal race.
  outcome := public.admin_review_registration(
    'cccccccc-0000-0000-0000-000000000003',
    'aaaaaaaa-0000-0000-0000-000000000001',
    true, 'approving again'
  );
  perform pg_temp.assert(
    outcome = 'no_pending_request',
    'reviewing an already-decided registration is refused'
  );
end
$$;

-- §11.1: "Immutable administrative history."
do $$
declare
  blocked boolean := false;
begin
  raise notice 'audit immutability';

  begin
    update public.admin_audit_logs set reason = 'rewritten';
  exception
    when insufficient_privilege then blocked := true;
  end;
  perform pg_temp.assert(blocked, 'an audit record cannot be edited, even by the table owner');

  blocked := false;
  begin
    delete from public.admin_audit_logs;
  exception
    when insufficient_privilege then blocked := true;
  end;
  perform pg_temp.assert(blocked, 'an audit record cannot be deleted, even by the table owner');
end
$$;

-- An operator must not review their own registration: the audit trail would show it as
-- legitimate, and nobody reading it later would know.
do $$
declare
  outcome public.admin_review_outcome;
begin
  insert into public.verification_requests (user_id)
    values ('cccccccc-0000-0000-0000-000000000003');

  outcome := public.admin_review_registration(
    'cccccccc-0000-0000-0000-000000000003',
    'cccccccc-0000-0000-0000-000000000003',
    true, 'approving myself'
  );
  perform pg_temp.assert(
    outcome = 'own_registration',
    'an operator cannot review their own registration'
  );

  /**
   * And the refusal must be distinguishable from "you are not an operator".
   *
   * Both used to return `not_permitted`, so the console told the founder — the only operator
   * in the system, reviewing the first registration in it — that they lacked authority they
   * demonstrably had. Sharing one value looked like prudent non-disclosure; it was reachable
   * only by a confirmed operator asking about themselves, so it disclosed nothing and cost an
   * hour of doubting the sign-in instead of the rule.
   */
  perform pg_temp.assert(
    public.admin_review_registration(
      'aaaaaaaa-0000-0000-0000-000000000001',
      'cccccccc-0000-0000-0000-000000000003',
      true, 'not an operator at all'
    ) = 'not_permitted',
    'a non-operator is still refused without being told which rule stopped them'
  );
end
$$;

-- §13.3 moderation.
do $$
declare
  outcome public.admin_review_outcome;
  v_avatar text;
  audit_rows integer;
begin
  raise notice 'moderation (§13.3)';

  update public.profiles set avatar_path = 'avatars/asha.jpg'
   where user_id = 'aaaaaaaa-0000-0000-0000-000000000001';

  outcome := public.admin_moderate_profile(
    'cccccccc-0000-0000-0000-000000000003',
    'aaaaaaaa-0000-0000-0000-000000000001',
    true, false, 'reported photograph'
  );
  perform pg_temp.assert(outcome = 'approved', 'an operator can hide an avatar');

  select avatar_path into v_avatar
    from public.profiles where user_id = 'aaaaaaaa-0000-0000-0000-000000000001';
  perform pg_temp.assert(v_avatar is null, 'the avatar is actually removed');

  select count(*) into audit_rows
    from public.admin_audit_logs where action = 'avatar_hidden';
  perform pg_temp.assert(audit_rows = 1, 'hiding an avatar is audited with its reason');

  outcome := public.admin_moderate_profile(
    'bbbbbbbb-0000-0000-0000-000000000002',
    'aaaaaaaa-0000-0000-0000-000000000001',
    true, false, 'I do not like it'
  );
  perform pg_temp.assert(outcome = 'not_permitted', 'a student cannot moderate another profile');
end
$$;

-- §13.3 suspension.
do $$
declare
  outcome public.admin_review_outcome;
  v_status public.account_status;
begin
  raise notice 'suspension (§13.3)';

  outcome := public.admin_set_suspension(
    'cccccccc-0000-0000-0000-000000000003',
    'aaaaaaaa-0000-0000-0000-000000000001',
    true, 'safety report pending investigation'
  );
  perform pg_temp.assert(outcome = 'rejected', 'an operator can suspend an account');

  select status into v_status
    from public.profiles where user_id = 'aaaaaaaa-0000-0000-0000-000000000001';
  perform pg_temp.assert(v_status = 'suspended', 'the account is suspended');

  -- §8.2 / §20: a suspended user cannot resubmit their way back into the queue.
  perform pg_temp.assert(
    (public.submit_registration('aaaaaaaa-0000-0000-0000-000000000001', '2026-08-01')).outcome
      = 'not_permitted',
    'a suspended account cannot resubmit a registration'
  );

  outcome := public.admin_set_suspension(
    'cccccccc-0000-0000-0000-000000000003',
    'aaaaaaaa-0000-0000-0000-000000000001',
    false, 'investigation closed, no action'
  );
  select status into v_status
    from public.profiles where user_id = 'aaaaaaaa-0000-0000-0000-000000000001';
  perform pg_temp.assert(
    v_status = 'pending_review',
    'reinstating returns the account to review rather than straight to approved'
  );
end
$$;

rollback;
