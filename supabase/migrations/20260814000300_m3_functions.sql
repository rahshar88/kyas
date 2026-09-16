-- Milestone 3 behaviour: referral issuance, feedback references and deletion requests.
--
-- Each of these exists in SQL rather than in an Edge Function for the same reason
-- `redeem_invite` and `submit_registration` do: they change more than one row, or they change
-- a row a client is not allowed to touch, and an interrupted client must not be able to leave
-- half of it done.

-- ------------------------------------------------------------ referral seats

/**
 * How many people one tester may invite (§S19: "remaining invitations").
 *
 * A function rather than a literal, mirroring `registration_minimum_interests()`, so the
 * number is one edit instead of a value copied into the schema, the screen and the tests. How
 * many seats a beta hands out is a §22 growth decision, and it will change.
 */
create or replace function public.referral_capacity()
returns integer language sql immutable as $$ select 3 $$;

-- -------------------------------------------------------- feedback reference

/**
 * §S20 acceptance: "Submission works without an email client and returns a reference number."
 *
 * Assigned by the database, not the client: a client-chosen reference could collide, or be
 * chosen to collide, dropping someone into another person's support thread. The retry loop is
 * for the ordinary collision — six characters from a 32-symbol alphabet is roughly a billion
 * values, so this practically never runs twice, but "practically never" is not a guarantee and
 * the failure mode is a rejected submission from someone reporting a bug.
 */
create or replace function public.assign_feedback_reference()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_candidate text;
  v_attempt integer := 0;
begin
  if new.reference is not null and btrim(new.reference) <> '' then
    return new;
  end if;

  loop
    v_attempt := v_attempt + 1;
    v_candidate := public.generate_feedback_reference();

    exit when not exists (
      select 1 from public.feedback where reference = v_candidate
    );

    if v_attempt >= 10 then
      raise exception 'could not allocate a feedback reference after % attempts', v_attempt;
    end if;
  end loop;

  new.reference := v_candidate;
  return new;
end;
$$;

create trigger feedback_reference
  before insert on public.feedback
  for each row execute function public.assign_feedback_reference();

-- ------------------------------------------------------------ referral issue

create type public.referral_outcome as enum ('issued', 'existing', 'not_permitted');

/**
 * §S19 — give a tester their own invitation to share, once.
 *
 * Created lazily on the first visit to S19 rather than at approval. Approval already writes
 * three tables inside one audited transaction (`admin_review_registration`), and adding a
 * fourth side effect there would mean a failure to mint a referral code could fail a review
 * decision — a much worse outcome than a referral screen that creates the row when asked.
 *
 * The code itself is generated and hashed by the Edge Function, exactly as `redeem_invite`
 * expects it to be: hashing lives in TypeScript (`_shared/invite-code.ts`), so the database
 * needs no pgcrypto and the same normalisation applies to minting and redeeming. Passing both
 * halves in is what keeps those two paths agreeing.
 *
 * Only an approved account gets one. §S19 is a screen inside the beta, and a referral from
 * someone still under review would let an unvetted account recruit.
 */
create or replace function public.ensure_referral_invite(
  p_user_id uuid,
  p_code_plain text,
  p_code_hash text
)
returns public.referral_outcome
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status public.account_status;
begin
  select status into v_status from public.profiles where user_id = p_user_id;

  if not found or v_status <> 'approved' then
    return 'not_permitted';
  end if;

  -- Idempotent: a second call, a retry after a dropped response, or a second device all find
  -- the code that already exists rather than minting a rival one.
  if exists (select 1 from public.invites where owner_user_id = p_user_id) then
    return 'existing';
  end if;

  insert into public.invites (code_hash, code_plain, owner_user_id, campaign, capacity)
    values (p_code_hash, p_code_plain, p_user_id, 'referral', public.referral_capacity());

  return 'issued';
exception
  -- Two devices asking at the same moment. The unique index on code_hash decides; both
  -- callers then read the same row, which is the answer they wanted anyway.
  when unique_violation then
    return 'existing';
end;
$$;

comment on function public.ensure_referral_invite is
  'Mints a tester''s referral invitation once, for approved accounts only (§S19). Idempotent.';

-- ---------------------------------------------------------- account deletion

create type public.deletion_outcome as enum ('requested', 'already_requested', 'not_permitted');

/**
 * §S22 — record a deletion request and end the account's access in one transaction.
 *
 * Both halves or neither. A client that inserted the request and then failed to change status
 * would leave an account that still works with a deletion nobody actions; a client that
 * changed status first and then failed would lock someone out of an account nobody deletes.
 * Status is server-controlled anyway (§11.2), so this is the only place it can happen.
 *
 * What this deliberately does not do is delete anything. §S22 requires deletion "according to
 * the approved retention policy", and that policy is a §22 founder decision that does not yet
 * exist. `scheduled_for` records the intent; the erasure job is Milestone 4 work at the
 * earliest, and writing one against a guessed policy is the one mistake here that cannot be
 * undone.
 */
create or replace function public.request_account_deletion(
  p_user_id uuid,
  p_reason text default null
)
returns public.deletion_outcome
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status public.account_status;
begin
  select status into v_status from public.profiles where user_id = p_user_id for update;

  if not found then
    return 'not_permitted';
  end if;

  if v_status = 'deleted' then
    return 'not_permitted';
  end if;

  if exists (
    select 1 from public.deletion_requests
     where user_id = p_user_id and state = 'requested'
  ) then
    return 'already_requested';
  end if;

  insert into public.deletion_requests (user_id, reason)
    values (p_user_id, nullif(btrim(coalesce(p_reason, '')), ''));

  update public.profiles set status = 'deletion_pending' where user_id = p_user_id;

  return 'requested';
end;
$$;

comment on function public.request_account_deletion is
  'Records a deletion request and moves the account to deletion_pending in one transaction
   (§S22, §11.4). Records intent only — erasure awaits an approved retention policy.';

-- ------------------------------------------------------------------- grants

/**
 * A client calling any of these directly would supply its own p_user_id and act for somebody
 * else. Only the service role, which the Edge Functions use, may execute them.
 */
revoke all on function public.referral_capacity() from public, anon, authenticated;
revoke all on function public.ensure_referral_invite(uuid, text, text)
  from public, anon, authenticated;
revoke all on function public.request_account_deletion(uuid, text)
  from public, anon, authenticated;
revoke all on function public.generate_feedback_reference() from public, anon, authenticated;

grant execute on function public.referral_capacity() to service_role;
grant execute on function public.ensure_referral_invite(uuid, text, text) to service_role;
grant execute on function public.request_account_deletion(uuid, text) to service_role;
grant execute on function public.generate_feedback_reference() to service_role;
