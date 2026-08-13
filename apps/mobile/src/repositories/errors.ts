import { AppError, type AppErrorCode } from '@kyascene/domain';

/**
 * Translates anything a backend call can throw into a typed `AppError` (§6.4).
 *
 * §6.4: "Every service error must become a typed application error" and "Screens show human
 * guidance and never expose raw backend messages." This is the single choke point where that
 * becomes true — every repository funnels through it, so no screen can accidentally render a
 * Postgres error string.
 */
interface SupabaseLikeError {
  message?: string;
  code?: string;
  status?: number;
  name?: string;
}

export function toAppError(error: unknown, fallback: AppErrorCode = 'UNKNOWN'): AppError {
  if (error instanceof AppError) return error;

  const candidate = (error ?? {}) as SupabaseLikeError;
  const message = candidate.message ?? '';
  const status = candidate.status;

  // Offline is by far the most common failure on a phone, and §7.6 asks for calm, specific
  // language about it — so it must not be lumped in with UNKNOWN.
  if (
    candidate.name === 'AbortError' ||
    /network request failed|fetch failed|timeout/i.test(message)
  ) {
    return new AppError('NETWORK_UNAVAILABLE', { cause: error });
  }

  /**
   * A rejected sign-in code, before anything that looks at prose.
   *
   * GoTrue answers a wrong or stale one-time code with 403 `otp_expired` and the message
   * "Token has expired or is invalid" — which the session rule below matched on
   * `token .*expired`. So typing a bad code told you *"your session has ended, sign in
   * again"*, on the sign-in screen, while the correct copy in S03 was unreachable. The one
   * error a tester meets most often was the one we explained worst.
   *
   * GoTrue deliberately does not distinguish "wrong" from "expired" here — telling them apart
   * would confirm which codes had once been valid — so both land on the same message.
   */
  if (candidate.code === 'otp_expired' || candidate.code === 'otp_disabled') {
    return new AppError('VALIDATION_FAILED', { cause: error });
  }

  /**
   * An expired *session*: a JWT the server would not accept, not a code the user typed.
   *
   * The message patterns are deliberately narrow. Matching loose prose here is what let an
   * OTP rejection through above, and the cost of over-matching is high — SESSION_EXPIRED
   * sends someone back to sign in, which is useless advice for anything else.
   */
  if (status === 401 || /jwt|invalid claim|refresh token|session not found/i.test(message)) {
    return new AppError('SESSION_EXPIRED', { cause: error });
  }

  /**
   * Supabase names its rate limits in `code` — `over_email_send_rate_limit` and friends. Those
   * were reaching the status/message checks below and, when supabase-js had retried and given
   * up, surfacing as NETWORK_UNAVAILABLE: "we couldn't reach KyaScene", for a server that
   * answered immediately and precisely. Matching the code first is both more accurate and more
   * stable than matching prose.
   */
  if (
    status === 429 ||
    /rate.?limit/i.test(candidate.code ?? '') ||
    /rate limit|too many requests/i.test(message)
  ) {
    return new AppError('RATE_LIMITED', { cause: error });
  }

  // Postgres check-constraint and RLS violations mean the request was malformed or not
  // permitted — never something to show verbatim.
  if (candidate.code === '23514' || candidate.code === '23505') {
    return new AppError('VALIDATION_FAILED', { cause: error });
  }
  if (candidate.code === '42501') {
    return new AppError('SESSION_EXPIRED', { cause: error });
  }

  return new AppError(fallback, { cause: error });
}

/** Wraps a call so callers only ever have to catch `AppError`. */
export async function guard<T>(
  operation: () => Promise<T>,
  fallback: AppErrorCode = 'UNKNOWN',
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    throw toAppError(error, fallback);
  }
}
