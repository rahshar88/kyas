-- Invite redemption tests (spec §S04, §12.4)
--
-- §S04 acceptance: "A code cannot be redeemed beyond its allowance under concurrent
-- requests." True concurrency is exercised separately by scripts/run-rls-tests.sh, which
-- fires two real sessions at the last remaining seat. This file covers the single-session
-- logic: validity, expiry, exhaustion and idempotent retry.

\set ON_ERROR_STOP on

begin;

insert into auth.users (id, email) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'a@example.test'),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'b@example.test'),
  ('aaaaaaaa-0000-0000-0000-000000000003', 'c@example.test'),
  ('aaaaaaaa-0000-0000-0000-000000000004', 'd@example.test');

insert into public.profiles (user_id, status) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'invited'),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'invited'),
  ('aaaaaaaa-0000-0000-0000-000000000003', 'invited'),
  ('aaaaaaaa-0000-0000-0000-000000000004', 'invited');

insert into public.invites (id, code_hash, capacity, redeemed_count, expires_at, status) values
  ('bbbbbbbb-0000-0000-0000-000000000001', 'hash-two-seats', 2, 0, null, 'active'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'hash-expired', 5, 0, now() - interval '1 day', 'active'),
  ('bbbbbbbb-0000-0000-0000-000000000003', 'hash-revoked', 5, 0, null, 'revoked');

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

do $$
declare
  outcome public.redeem_invite_outcome;
  seats integer;
  invite_status public.invite_status;
begin
  raise notice 'redeem_invite';

  outcome := public.redeem_invite('aaaaaaaa-0000-0000-0000-000000000001', 'no-such-hash');
  perform pg_temp.assert(outcome = 'invite_invalid', 'an unknown code is rejected');

  outcome := public.redeem_invite('aaaaaaaa-0000-0000-0000-000000000001', 'hash-expired');
  perform pg_temp.assert(outcome = 'invite_invalid', 'an expired code is rejected');

  select status into invite_status
    from public.invites where code_hash = 'hash-expired';
  perform pg_temp.assert(invite_status = 'expired', 'an expired code is marked expired');

  outcome := public.redeem_invite('aaaaaaaa-0000-0000-0000-000000000001', 'hash-revoked');
  perform pg_temp.assert(outcome = 'invite_invalid', 'a revoked code is rejected');

  -- First seat.
  outcome := public.redeem_invite('aaaaaaaa-0000-0000-0000-000000000001', 'hash-two-seats');
  perform pg_temp.assert(outcome = 'redeemed', 'a valid code is redeemed');

  select redeemed_count into seats
    from public.invites where code_hash = 'hash-two-seats';
  perform pg_temp.assert(seats = 1, 'redeemed_count increments');

  -- §12.4: a retry must not consume a second seat.
  outcome := public.redeem_invite('aaaaaaaa-0000-0000-0000-000000000001', 'hash-two-seats');
  perform pg_temp.assert(outcome = 'already_redeemed', 'a retry is idempotent');

  select redeemed_count into seats
    from public.invites where code_hash = 'hash-two-seats';
  perform pg_temp.assert(seats = 1, 'a retry does not consume a second seat');

  -- Second and final seat.
  outcome := public.redeem_invite('aaaaaaaa-0000-0000-0000-000000000002', 'hash-two-seats');
  perform pg_temp.assert(outcome = 'redeemed', 'the second seat is redeemable');

  select status into invite_status
    from public.invites where code_hash = 'hash-two-seats';
  perform pg_temp.assert(
    invite_status = 'exhausted',
    'the invite marks itself exhausted when the last seat goes'
  );

  -- One seat too many.
  outcome := public.redeem_invite('aaaaaaaa-0000-0000-0000-000000000003', 'hash-two-seats');
  perform pg_temp.assert(outcome = 'invite_exhausted', 'a third redemption is refused');

  select redeemed_count into seats
    from public.invites where code_hash = 'hash-two-seats';
  perform pg_temp.assert(seats = 2, 'redeemed_count never exceeds capacity');

  -- §11.1: one invitation per user.
  outcome := public.redeem_invite('aaaaaaaa-0000-0000-0000-000000000001', 'hash-revoked');
  perform pg_temp.assert(
    outcome = 'invite_invalid',
    'a user who already redeemed cannot redeem a different code'
  );
end
$$;

-- The check constraint must make over-redemption impossible even if redeem_invite is wrong.
do $$
declare
  blocked boolean := false;
begin
  raise notice 'capacity backstop';

  begin
    update public.invites set redeemed_count = 99 where code_hash = 'hash-two-seats';
  exception
    when check_violation then blocked := true;
  end;

  perform pg_temp.assert(blocked, 'redeemed_count cannot be forced above capacity');
end
$$;

-- A signed-in student must not be able to call the function directly and redeem for someone
-- else — that is the whole reason redemption lives behind an Edge Function (§12.1).
do $$
declare
  blocked boolean := false;
begin
  raise notice 'privilege';

  set local role authenticated;
  begin
    perform public.redeem_invite('aaaaaaaa-0000-0000-0000-000000000004', 'hash-two-seats');
  exception
    when insufficient_privilege then blocked := true;
  end;
  reset role;

  perform pg_temp.assert(blocked, 'a student cannot execute redeem_invite directly');
end
$$;

rollback;
