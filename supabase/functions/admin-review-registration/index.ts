/**
 * admin-review-registration (spec §12.2, §15.2)
 *
 * "Approve/reject registration with reason and audit event."
 *
 * Authorisation is decided by `is_admin` inside the database, not by this function trusting
 * anything in the request. §15.2: "Never rely only on hidden navigation for authorisation" —
 * the admin console not showing a button is a courtesy, and this is the actual control.
 *
 * The actor id comes from the verified JWT. It is passed to the SQL function as an argument
 * because the function runs as the service role and has no session of its own — which is
 * exactly why `admin_review_registration` is granted to the service role only. A client able
 * to call it directly could name anyone as the actor and forge the audit trail.
 */
import { createClient } from 'jsr:@supabase/supabase-js@2';

import { failure, preflight, requestId, success } from '../_shared/response.ts';

type ReviewOutcome =
  | 'approved'
  | 'rejected'
  | 'not_permitted'
  | 'own_registration'
  | 'no_pending_request'
  | 'invalid_request';

const REJECTION_CATEGORIES = [
  'not_eligible',
  'incomplete_information',
  'unable_to_verify_study',
  'duplicate_account',
  'safety_concern',
  'other',
] as const;

type RejectionCategory = (typeof REJECTION_CATEGORIES)[number];

function isRejectionCategory(value: unknown): value is RejectionCategory {
  return typeof value === 'string' && (REJECTION_CATEGORIES as readonly string[]).includes(value);
}

Deno.serve(async (request: Request): Promise<Response> => {
  // Browsers preflight any POST carrying Authorization. Must come before every other check.
  const preflighted = preflight(request);
  if (preflighted) return preflighted;

  const id = requestId();

  if (request.method !== 'POST') {
    return failure('VALIDATION_FAILED', 'This request could not be understood.', { id });
  }

  const authHeader = request.headers.get('Authorization');
  if (!authHeader) {
    return failure('SESSION_EXPIRED', 'Your session has ended. Sign in again.', { id });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const asCaller = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authHeader } },
  });
  const asService = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  const { data: userResult, error: userError } = await asCaller.auth.getUser();
  if (userError || !userResult.user) {
    return failure('SESSION_EXPIRED', 'Your session has ended. Sign in again.', { id });
  }

  let body: { userId?: unknown; approve?: unknown; reason?: unknown; category?: unknown };
  try {
    body = await request.json();
  } catch {
    return failure('VALIDATION_FAILED', 'This request could not be understood.', { id });
  }

  const targetUserId = typeof body.userId === 'string' ? body.userId : '';
  const approve = body.approve === true;
  const reason = typeof body.reason === 'string' ? body.reason : '';

  if (!/^[0-9a-f-]{36}$/i.test(targetUserId)) {
    return failure('VALIDATION_FAILED', 'That user could not be identified.', { id });
  }

  // §15.2: "Sensitive actions require a reason." Rejected here so the operator sees it as a
  // form error rather than as a failed action.
  if (reason.trim().length < 3) {
    return failure('VALIDATION_FAILED', 'A reason is required for this action.', { id });
  }

  if (!approve && !isRejectionCategory(body.category)) {
    return failure('VALIDATION_FAILED', 'Choose a rejection category.', { id });
  }

  const { data, error } = await asService.rpc('admin_review_registration', {
    p_actor_id: userResult.user.id,
    p_target_user_id: targetUserId,
    p_approve: approve,
    p_reason: reason,
    p_rejection_category: approve ? null : (body.category as RejectionCategory),
  });

  if (error) {
    console.error(
      JSON.stringify({ requestId: id, fn: 'admin-review-registration', pgCode: error.code }),
    );
    return failure('UNKNOWN', 'Something went wrong on our side. Please try again.', { id });
  }

  const outcome = data as ReviewOutcome;

  switch (outcome) {
    case 'approved':
    case 'rejected':
      return success({ outcome }, id);

    case 'no_pending_request':
      // Usually means a second operator got there first, which is a normal race in a shared
      // queue rather than a fault. The console refreshes and the row disappears.
      return failure('VALIDATION_FAILED', 'This registration is no longer awaiting review.', {
        id,
      });

    case 'invalid_request':
      return failure('VALIDATION_FAILED', 'That decision could not be recorded.', { id });

    /**
     * Separated from `not_permitted` after the founder — the only operator, reviewing the
     * first registration in the system — was told they lacked authority they demonstrably
     * had, by a console they were signed into, under an error code claiming their session had
     * ended. Three false statements in one message.
     *
     * The original reason for sharing a value was that distinguishing them would tell an
     * unauthorised caller whether they hold admin rights. That does not survive reading the
     * function: `is_admin` is checked first, so this outcome is reachable only by a confirmed
     * operator, about themselves. VALIDATION_FAILED rather than SESSION_EXPIRED, because
     * nothing is wrong with the session and the console must not sign them out over it.
     */
    case 'own_registration':
      return failure(
        'VALIDATION_FAILED',
        'You cannot review your own registration — another operator has to.',
        { id },
      );

    case 'not_permitted':
      return failure('SESSION_EXPIRED', 'You do not have permission to do that.', { id });
  }
});
