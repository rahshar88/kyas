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

  if (status === 401 || /jwt|token .*expired|invalid claim/i.test(message)) {
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
