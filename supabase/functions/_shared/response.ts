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

/**
 * Cross-origin headers, on every response.
 *
 * The mobile app is not a browser, so it never sends a preflight and these functions worked
 * without this for two milestones. The admin console is the first browser client: a POST
 * carrying `Authorization` and `Content-Type: application/json` triggers an `OPTIONS`
 * preflight, which was answered with a 400 and no CORS headers — so Chrome blocked the real
 * request before it was ever sent, and the console reported that a deployed, working function
 * "did not answer".
 *
 * `*` is safe here specifically because authentication is a bearer token the caller must
 * attach deliberately. There are no cookies, so a hostile page cannot make an authenticated
 * request on someone's behalf — the thing a narrower origin list would be protecting against.
 * It also means the console can move host without a redeployment.
 */
export const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

/** Answers the browser's preflight. Every function must call this before anything else. */
export function preflight(request: Request): Response | null {
  return request.method === 'OPTIONS'
    ? new Response(null, { status: 204, headers: CORS_HEADERS })
    : null;
}

export function requestId(): string {
  return crypto.randomUUID();
}

export function success<T>(data: T, id = requestId()): Response {
  return Response.json(
    { data, error: null, requestId: id },
    { status: 200, headers: CORS_HEADERS },
  );
}

export function failure(
  code: AppErrorCode,
  message: string,
  options: { id?: string; retryAfterSeconds?: number } = {},
): Response {
  const id = options.id ?? requestId();
  const headers: Record<string, string> = { ...CORS_HEADERS };

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
