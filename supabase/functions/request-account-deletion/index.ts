/**
 * request-account-deletion (spec §S22, §11.4, §12.2)
 *
 * §S22: "Allow complete account-deletion initiation inside the app."
 *
 * Privileged because it moves `profiles.status` to `deletion_pending`, and status is a
 * server-controlled lifecycle (§11.2) — a client that could set it could also set itself to
 * `approved`. The request row and the status change happen together in
 * `request_account_deletion`, because either half without the other is worse than neither: an
 * account that still works with a deletion nobody actions, or a person locked out of an
 * account nobody deletes.
 *
 * The user id comes from the verified JWT. There is no path here to delete somebody else.
 *
 * What this does not do is erase anything. §S22 asks for deletion "according to the approved
 * retention policy", which is a §22 founder decision that does not exist yet — so the request
 * is dated and recorded, and the erasure job waits for a policy to implement rather than a
 * guess. That gap is stated in the build log rather than papered over.
 */
import { createClient } from 'jsr:@supabase/supabase-js@2';

import { failure, preflight, requestId, success } from '../_shared/response.ts';

type DeletionOutcome = 'requested' | 'already_requested' | 'not_permitted';

/** §S22 asks why, optionally. Long enough to be useful, short enough not to be an essay. */
const MAX_REASON = 1000;

Deno.serve(async (request: Request): Promise<Response> => {
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

  let reason: string | null = null;
  try {
    const body = (await request.json()) as { reason?: unknown };
    if (typeof body.reason === 'string' && body.reason.trim() !== '') {
      reason = body.reason.trim().slice(0, MAX_REASON);
    }
  } catch {
    // §S22's confirmation is the deliberate act, not the reason. A malformed or absent body
    // must not stand between someone and deleting their account.
    reason = null;
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

  const { data, error } = await asService.rpc('request_account_deletion', {
    p_user_id: userResult.user.id,
    p_reason: reason,
  });

  if (error) {
    console.error(
      JSON.stringify({ requestId: id, fn: 'request-account-deletion', pgCode: error.code }),
    );
    return failure('UNKNOWN', 'Something went wrong on our side. Please try again.', { id });
  }

  const outcome = data as DeletionOutcome;

  if (outcome === 'not_permitted') {
    return failure('VALIDATION_FAILED', 'This account cannot be deleted.', { id });
  }

  /**
   * `already_requested` is a success, not an error.
   *
   * Someone who taps confirm twice, or whose first response was lost, has done the thing they
   * intended — and §S22 requires them to be signed out and shown confirmation either way.
   * Reporting a failure here would tell a person their deletion did not happen when it did,
   * which is the worst possible thing to be wrong about on this screen.
   */
  return success({ outcome }, id);
});
