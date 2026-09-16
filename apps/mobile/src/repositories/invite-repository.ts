import { AppError } from '@kyascene/domain';

import { getSupabase } from '@/services/supabase';

import { guard } from './errors';

/**
 * Invite redemption (§S04, §12.2).
 *
 * The client never touches `public.invites` — it has no Row Level Security policy at all,
 * because a readable ledger would let anyone enumerate codes. Everything goes through the
 * `redeem-invite` Edge Function, which authenticates the caller from their JWT and holds a
 * row lock while it redeems.
 */
export type RedeemOutcome = 'redeemed' | 'already_redeemed';

export interface InviteRepository {
  redeem(code: string): Promise<RedeemOutcome>;
}

interface RedeemEnvelope {
  data: { outcome: RedeemOutcome } | null;
  error: { code: string; message: string } | null;
  requestId: string;
}

export const inviteRepository: InviteRepository = {
  async redeem(code: string): Promise<RedeemOutcome> {
    return guard(async () => {
      const { data, error } = await getSupabase().functions.invoke<RedeemEnvelope>(
        'redeem-invite',
        { body: { code } },
      );

      // A non-2xx response arrives here. The function's own envelope carries the typed code,
      // so prefer it over anything the transport invented.
      if (error) {
        const envelope = await readEnvelope(error);
        throw new AppError(envelope ?? 'UNKNOWN', { cause: error });
      }

      if (!data || data.error) {
        throw new AppError(mapCode(data?.error?.code), {
          ...(data?.requestId === undefined ? {} : { requestId: data.requestId }),
        });
      }

      if (!data.data) throw new AppError('UNKNOWN');

      // §12.4: a repeat redemption is a success. The tester carries on rather than being told
      // off for tapping twice on a bad connection.
      return data.data.outcome;
    }, 'INVITE_INVALID');
  },
};

function mapCode(code: string | undefined): 'INVITE_INVALID' | 'INVITE_EXHAUSTED' | 'UNKNOWN' {
  if (code === 'INVITE_EXHAUSTED') return 'INVITE_EXHAUSTED';
  if (code === 'INVITE_INVALID') return 'INVITE_INVALID';
  return 'UNKNOWN';
}

/**
 * `FunctionsHttpError` keeps the response body, which is where our typed code lives. Reading
 * it is best-effort: if the body is not our envelope, the caller falls back to UNKNOWN.
 */
async function readEnvelope(
  error: unknown,
): Promise<'INVITE_INVALID' | 'INVITE_EXHAUSTED' | 'UNKNOWN' | null> {
  const context = (error as { context?: { json?: () => Promise<unknown> } }).context;
  if (!context?.json) return null;

  try {
    const body = (await context.json()) as RedeemEnvelope;
    return mapCode(body?.error?.code);
  } catch {
    return null;
  }
}
