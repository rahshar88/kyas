/**
 * submit-registration (spec §12.2, §S16)
 *
 * "Validate complete profile and move status to pending review."
 *
 * Thin, for the same reason redeem-invite is: the completeness rules and the idempotency
 * guarantee both live in the `submit_registration` SQL function, where they run inside one
 * transaction against the rows that actually exist. §S16 requires that "repeated taps cannot
 * create duplicate registration records" — a check-then-insert in TypeScript is precisely the
 * race that produces duplicates.
 *
 * The user id comes from the verified JWT and never from the request body, so a caller cannot
 * submit on someone else's behalf.
 */
import { createClient } from 'jsr:@supabase/supabase-js@2';

import { CURRENT_POLICY_VERSION } from '../_shared/policy.ts';
import { failure, requestId, success } from '../_shared/response.ts';

type SubmitOutcome = 'submitted' | 'already_submitted' | 'incomplete' | 'not_permitted';

interface SubmitResult {
  outcome: SubmitOutcome;
  missing: string[] | null;
  request_id: string | null;
}

Deno.serve(async (request: Request): Promise<Response> => {
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

  const { data, error } = await asService.rpc('submit_registration', {
    p_user_id: userResult.user.id,
    p_policy_version: CURRENT_POLICY_VERSION,
  });

  if (error) {
    console.error(JSON.stringify({ requestId: id, fn: 'submit-registration', pgCode: error.code }));
    return failure('UNKNOWN', 'Something went wrong on our side. Please try again.', { id });
  }

  const result = data as SubmitResult;

  switch (result.outcome) {
    case 'submitted':
      return success({ outcome: result.outcome, requestRef: result.request_id }, id);

    case 'already_submitted':
      // §12.4: a retry is not an error. S17 shows the same pending state either way, so the
      // client needs no special handling — but the distinct code lets it skip a second
      // "submitted" analytics event.
      return failure(
        'REGISTRATION_ALREADY_SUBMITTED',
        'Your registration is already with our team for review.',
        { id },
      );

    case 'incomplete':
      /**
       * The missing list is returned as stable identifiers, not sentences. The app maps each
       * to the screen that collects it, so "study" navigates to S06 rather than leaving the
       * user to hunt for what is wrong — §S16's whole purpose is to "inspect and correct".
       */
      return Response.json(
        {
          data: null,
          error: {
            code: 'VALIDATION_FAILED',
            message: 'Some answers still need finishing before we can submit this.',
            missing: result.missing ?? [],
          },
          requestId: id,
        },
        { status: 400 },
      );

    case 'not_permitted':
      // Covers a suspended account, an account already approved, and one that never redeemed
      // an invitation. Deliberately one message: distinguishing them tells a caller something
      // about an account they may not own.
      return failure(
        'ACCOUNT_SUSPENDED',
        'This account cannot submit a registration right now. Contact support and we will help.',
        { id },
      );
  }
});
