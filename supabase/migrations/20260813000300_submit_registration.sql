-- Registration submission (spec §S16, §12.2, §12.4)
--
-- §S16: "Run server validation again; submission is idempotent." and
--       "Repeated taps cannot create duplicate registration records."
--
-- Both properties live here rather than in the Edge Function's TypeScript, for the same reason
-- redeem_invite does: a read-then-write across the network is a race, and "did a pending
-- request already exist?" is exactly the question two simultaneous taps both answer wrongly.
--
-- Re-validating server-side is not belt-and-braces. The client's Zod schemas run on a device
-- we do not control, and the same tables are reachable by any caller holding a session — so
-- the completeness rules have to be checked at the moment status changes, against the rows
-- that actually exist, not against what a form claimed.

/** §S11: "Require at least three for the beta." */
create or replace function public.registration_minimum_interests()
returns integer language sql immutable as $$ select 3 $$;

create type public.submit_registration_outcome as enum (
  'submitted',
  'already_submitted',
  'incomplete',
  'not_permitted'
);

/**
 * Returns the outcome plus, when incomplete, the list of missing pieces.
 *
 * The missing list is a set of stable identifiers rather than sentences: the app owns the
 * wording (§7.6 asks for a specific tone the database has no business deciding), and §14.3
 * forbids free text reaching analytics. The client maps each code to a screen so "study" sends
 * the user to S06 rather than making them hunt.
 */
create type public.submit_registration_result as (
  outcome public.submit_registration_outcome,
  missing text[],
  request_id uuid
);

create or replace function public.submit_registration(
  p_user_id uuid,
  p_policy_version text
)
returns public.submit_registration_result
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile public.profiles%rowtype;
  v_student public.student_profiles%rowtype;
  v_missing text[] := '{}';
  v_existing uuid;
  v_result public.submit_registration_result;
  v_policy public.consent_policy_type;
  -- array_append rather than `v_missing || 'study'`. With an unquoted literal on the right,
  -- Postgres resolves `||` to anyarray||anyarray and tries to parse the string AS an array,
  -- failing with "malformed array literal". That would have turned every incomplete
  -- registration — the ordinary path — into a server error instead of a list of what to fix.
begin
  select * into v_profile from public.profiles where user_id = p_user_id for update;

  if not found then
    v_result := ('not_permitted', '{}'::text[], null);
    return v_result;
  end if;

  /**
   * §8.2 and §11.2: status is a server-controlled lifecycle, not a free-for-all. A suspended
   * or deleted account cannot re-enter review by resubmitting, and an already-approved user
   * has nothing to submit.
   */
  if v_profile.status in ('suspended', 'deletion_pending', 'deleted', 'approved') then
    v_result := ('not_permitted', '{}'::text[], null);
    return v_result;
  end if;

  -- §12.4 idempotency. The `for update` above serialises concurrent taps, so the second one
  -- reaches this check after the first has already inserted.
  select id into v_existing
    from public.verification_requests
   where user_id = p_user_id and state = 'pending';

  if found then
    v_result := ('already_submitted', '{}'::text[], v_existing);
    return v_result;
  end if;

  -- §S04: the beta is invite-only, so a submission from someone who never redeemed one is not
  -- an incomplete registration — it is a request that should never have been possible.
  if not exists (select 1 from public.invite_redemptions where user_id = p_user_id) then
    v_result := ('not_permitted', '{}'::text[], null);
    return v_result;
  end if;

  select * into v_student from public.student_profiles where user_id = p_user_id;

  if not found then
    v_result := ('incomplete', array['eligibility', 'study', 'location', 'india_background'], null);
    return v_result;
  end if;

  -- §S06 study details.
  if v_student.provider is null or v_student.course is null or v_student.study_level is null
     or v_student.intake_month is null or v_student.intake_year is null then
    v_missing := array_append(v_missing, 'study');
  end if;

  -- §S07 Sydney location. Suburb only — §13.2 forbids anything finer.
  if v_student.suburb is null or v_student.arrival_status is null then
    v_missing := array_append(v_missing, 'location');
  end if;

  -- §S08 India background.
  if v_student.india_state_code is null then
    v_missing := array_append(v_missing, 'india_background');
  end if;

  -- §S09. At least one language, or the screen produced nothing.
  if not exists (select 1 from public.profile_languages where user_id = p_user_id) then
    v_missing := array_append(v_missing, 'languages');
  end if;

  -- §S11: "Require at least three for the beta."
  if (select count(*) from public.profile_interests where user_id = p_user_id)
     < public.registration_minimum_interests() then
    v_missing := array_append(v_missing, 'interests');
  end if;

  -- §S12: at least a ranked top need. The five-goal ceiling is a table constraint, so it
  -- cannot be violated by the time we get here.
  if not exists (
    select 1 from public.profile_goals where user_id = p_user_id and rank = 1
  ) then
    v_missing := array_append(v_missing, 'goals');
  end if;

  -- §S14. The row exists as soon as the screen is completed; conservative defaults mean an
  -- absent row would silently mean "share nothing", which is safe but not a completed step.
  if not exists (select 1 from public.profile_visibility where user_id = p_user_id) then
    v_missing := array_append(v_missing, 'privacy');
  end if;

  /**
   * §S15: "Required and optional consent must never be bundled."
   *
   * Only the four required policies are checked. Marketing is deliberately absent from this
   * loop — a user who declines it must still be able to submit, and making it required here
   * is precisely the bundling the specification forbids.
   */
  foreach v_policy in array array[
    'terms'::public.consent_policy_type,
    'privacy'::public.consent_policy_type,
    'community_guidelines'::public.consent_policy_type,
    'beta_changes'::public.consent_policy_type
  ]
  loop
    if not exists (
      select 1 from public.consents
       where user_id = p_user_id
         and policy_type = v_policy
         and version = p_policy_version
         and accepted
    ) then
      v_missing := array_append(v_missing, 'consent');
      exit;
    end if;
  end loop;

  if array_length(v_missing, 1) > 0 then
    v_result := ('incomplete', v_missing, null);
    return v_result;
  end if;

  insert into public.verification_requests (user_id, state)
    values (p_user_id, 'pending')
    returning id into v_existing;

  update public.profiles
     set status = 'pending_review'
   where user_id = p_user_id;

  v_result := ('submitted', '{}'::text[], v_existing);
  return v_result;
end;
$$;

comment on function public.submit_registration is
  'S16 submission: re-validates the whole profile server-side and moves status to
   pending_review. Idempotent — a second call while a request is pending returns
   already_submitted rather than creating another.';

-- A client calling this directly would supply its own p_user_id and submit on someone else's
-- behalf. Only the service role, which the Edge Function uses, may execute it.
revoke all on function public.submit_registration(uuid, text) from public, anon, authenticated;
grant execute on function public.submit_registration(uuid, text) to service_role;

revoke all on function public.registration_minimum_interests() from public, anon, authenticated;
grant execute on function public.registration_minimum_interests() to service_role;
