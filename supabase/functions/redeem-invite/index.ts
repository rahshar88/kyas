/**
 * redeem-invite (spec §12.2, §S04)
 *
 * Validates and atomically redeems an invitation.
 *
 * This function is deliberately thin. All of the atomicity lives in the `redeem_invite`
 * SQL function, which takes a row lock — putting the read-then-write in TypeScript would
 * reintroduce exactly the race §S04 forbids. What happens here is the part that must not
 * happen in the database: authenticating the caller, hashing the code, and translating the
 * outcome into the §12.3 envelope.
 *
 * Two things a client must never be able to do, and cannot:
 *   - redeem on someone else's behalf. The user id comes from the verified JWT, never the
 *     request body.
 *   - read the invite ledger. `public.invites` has no client policy at all (§13.1 RLS), and
 *     `redeem_invite` is granted only to the service role.
 */
import { createClient } from 'jsr:@supabase/supabase-js@2';

import { hashInviteCode, isPlausibleInviteCode } from '../_shared/invite-code.ts';
import { failure, requestId, success } from '../_shared/response.ts';

type RedeemOutcome = 'redeemed' | 'already_redeemed' | 'invite_invalid' | 'invite_exhausted';

Deno.serve(async (request: Request): Promise<Response> => {
  const id = requestId();

  if (request.method !== 'POST') {
    return failure('VALIDATION_FAILED', 'This request could not be understood.', { id });
  }

  const authHeader = request.headers.get('Authorization');
  if (!authHeader) {
    return failure('SESSION_EXPIRED', 'Your session has ended. Sign in again.', { id });
  }

  // Two clients: one bound to the caller's JWT purely to identify them, and one with the
  // service role to perform the privileged redemption (§12.1).
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const asCaller = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authHeader } },
  });
  const asService = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  const { data: userResult, error: userError } = await asCaller.auth.getUser();
  if (userError || !userResult.user) {
    return failure('SESSION_EXPIRED', 'Your session has ended. Sign in again.', { id });
  }

  let body: { code?: unknown };
  try {
    body = await request.json();
  } catch {
    return failure('VALIDATION_FAILED', 'This request could not be understood.', { id });
  }

  const code = typeof body.code === 'string' ? body.code : '';

  // Reject implausible codes before touching the database. This is a cheap brute-force
  // dampener as well as validation — §12.5 requires rate limiting on invite redemption, and
  // Supabase's platform rate limits sit in front of this function.
  if (!isPlausibleInviteCode(code)) {
    return failure('INVITE_INVALID', 'This invitation could not be used.', { id });
  }

  const codeHash = await hashInviteCode(code);

  const { data, error } = await asService.rpc('redeem_invite', {
    p_user_id: userResult.user.id,
    p_code_hash: codeHash,
  });

  if (error) {
    // §12.3: log the code and request id, never the raw backend message, and never the
    // invite code itself.
    console.error(JSON.stringify({ requestId: id, fn: 'redeem-invite', pgCode: error.code }));
    return failure('UNKNOWN', 'Something went wrong on our side. Please try again.', { id });
  }

  const outcome = data as RedeemOutcome;

  switch (outcome) {
    case 'redeemed':
    case 'already_redeemed':
      // §12.4: a retry is a success, not an error. The client resumes onboarding either way.
      return success({ outcome }, id);

    case 'invite_exhausted':
      return failure('INVITE_EXHAUSTED', 'This invitation has already been fully used.', { id });

    case 'invite_invalid':
      return failure('INVITE_INVALID', 'This invitation could not be used.', { id });
  }
});
