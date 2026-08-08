/**
 * The standard response envelope (spec §12.3).
 *
 * Every Edge Function returns `{ data, error, requestId }`. The client may display the safe
 * message but must log only the code and the request id — so the message here is always
 * user-facing copy, never a database error.
 */
export type AppErrorCode =
  | 'NETWORK_UNAVAILABLE'
  | 'SESSION_EXPIRED'
  | 'VALIDATION_FAILED'
  | 'INVITE_INVALID'
  | 'INVITE_EXHAUSTED'
  | 'REGISTRATION_ALREADY_SUBMITTED'
  | 'ACCOUNT_SUSPENDED'
  | 'RATE_LIMITED'
  | 'UNKNOWN';

const STATUS_BY_CODE: Record<AppErrorCode, number> = {
  NETWORK_UNAVAILABLE: 503,
  SESSION_EXPIRED: 401,
  VALIDATION_FAILED: 400,
  INVITE_INVALID: 400,
  INVITE_EXHAUSTED: 409,
  REGISTRATION_ALREADY_SUBMITTED: 409,
  ACCOUNT_SUSPENDED: 403,
  RATE_LIMITED: 429,
  UNKNOWN: 500,
};

export function requestId(): string {
  return crypto.randomUUID();
}

export function success<T>(data: T, id = requestId()): Response {
  return Response.json({ data, error: null, requestId: id }, { status: 200 });
}

export function failure(
  code: AppErrorCode,
  message: string,
  options: { id?: string; retryAfterSeconds?: number } = {},
): Response {
  const id = options.id ?? requestId();
  const headers: Record<string, string> = {};

  // §12.5: a RATE_LIMITED response carries a safe retry time.
  if (options.retryAfterSeconds !== undefined) {
    headers['Retry-After'] = String(options.retryAfterSeconds);
  }

  return Response.json(
    {
      data: null,
      error: {
        code,
        message,
        ...(options.retryAfterSeconds === undefined
          ? {}
          : { retryAfterSeconds: options.retryAfterSeconds }),
      },
      requestId: id,
    },
    { status: STATUS_BY_CODE[code], headers },
  );
}
