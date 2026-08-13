/**
 * ensure-referral-code (spec §S19, §12.2)
 *
 * "Personal referral code, remaining invitations, share sheet and redemption count."
 *
 * Thin, like the rest: the idempotency guarantee and the approved-only rule live in the
 * `ensure_referral_invite` SQL function, where they run in one transaction against the rows
 * that exist. A check-then-insert in TypeScript is the race that hands one person two referral
 * links and twice their allowance.
 *
 * What TypeScript does own is the code itself. Generation and hashing live here for the same
 * reason `redeem-invite` hashes here: minting and redeeming must apply the same normalisation
 * (`_shared/invite-code.ts`), and keeping both in one language is what stops a perfectly valid
 * code failing to match. It also means the database needs no pgcrypto.
 *
 * The user id comes from the verified JWT and never from the request body, so a caller cannot
 * mint someone else's referral code.
 */
import { createClient } from 'jsr:@supabase/supabase-js@2';

import { hashInviteCode, normaliseInviteCode } from '../_shared/invite-code.ts';
import { failure, preflight, requestId, success } from '../_shared/response.ts';

type ReferralOutcome = 'issued' | 'existing' | 'not_permitted';

/**
 * Eight characters from an alphabet with no I, O, 0 or 1.
 *
 * §S19 expects this to be shared by voice and by screenshot, so the ambiguous pairs are the
 * ones that matter — a code that cannot be read back correctly is a referral that silently
 * fails. Eight characters from 32 symbols is about 10^12 combinations, which is not guessable
 * at any rate a rate limiter would allow.
 */
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function generateCode(): string {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);

  // Rejection-free indexing: 256 is not a multiple of 32, but 32 divides 256 exactly, so a
  // plain modulo is uniform here. Worth saying, because it usually is not.
  return Array.from(bytes, (byte) => ALPHABET[byte % ALPHABET.length]).join('');
}

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

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const asCaller = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authHeader } },
  });
  const asService = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  const { data: userResult, error: userError } = await asCaller.auth.getUser();
  if (userError || !userResult.user) {
    return failure('SESSION_EXPIRED', 'Your session has ended. Sign in again.', { id });
  }

  const code = normaliseInviteCode(generateCode());

  const { data, error } = await asService.rpc('ensure_referral_invite', {
    p_user_id: userResult.user.id,
    p_code_plain: code,
    p_code_hash: await hashInviteCode(code),
  });

  if (error) {
    console.error(
      JSON.stringify({ requestId: id, fn: 'ensure-referral-code', pgCode: error.code }),
    );
    return failure('UNKNOWN', 'Something went wrong on our side. Please try again.', { id });
  }

  const outcome = data as ReferralOutcome;

  if (outcome === 'not_permitted') {
    return failure(
      'VALIDATION_FAILED',
      'Invitations become available once your registration is approved.',
      { id },
    );
  }

  /**
   * The code is not returned here, even when this call just minted it.
   *
   * S19 reads it from `invites` under the owner-only policy, so there is exactly one path to a
   * referral code and one place that decides who may see it. Returning it from this function
   * as well would mean a second answer to that question, which is how the two drift apart.
   */
  return success({ outcome }, id);
});
