/**
 * Typed application errors, per spec §6.4.
 *
 * Every service error must become one of these codes before it reaches a screen.
 * Screens show human guidance and never expose raw backend messages.
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

export class AppError extends Error {
  readonly code: AppErrorCode;
  /** Server request id, safe to show to a user and to quote to support (§12.3). */
  readonly requestId: string | undefined;
  /** Seconds to wait before retrying. Only meaningful for `RATE_LIMITED` (§12.5). */
  readonly retryAfterSeconds: number | undefined;

  constructor(
    code: AppErrorCode,
    options: {
      message?: string;
      requestId?: string;
      retryAfterSeconds?: number;
      cause?: unknown;
    } = {},
  ) {
    super(
      options.message ?? code,
      options.cause === undefined ? undefined : { cause: options.cause },
    );
    this.name = 'AppError';
    this.code = code;
    this.requestId = options.requestId;
    this.retryAfterSeconds = options.retryAfterSeconds;
  }
}

export function isAppError(value: unknown): value is AppError {
  return value instanceof AppError;
}

/**
 * Copy shown to users. Spec §7.6 asks for calm, specific error language, and §12.3
 * says the client may display a safe message but must log only the code and request id.
 */
export const APP_ERROR_MESSAGES: Record<AppErrorCode, string> = {
  NETWORK_UNAVAILABLE: "We couldn't reach KyaScene. Your answers are still on this phone.",
  SESSION_EXPIRED: 'Your session has ended. Sign in again to pick up where you left off.',
  VALIDATION_FAILED: 'Some answers need another look before we can continue.',
  INVITE_INVALID: 'This invitation could not be used.',
  INVITE_EXHAUSTED: 'This invitation has already been fully used.',
  REGISTRATION_ALREADY_SUBMITTED: 'Your registration is already with our team for review.',
  ACCOUNT_SUSPENDED: 'This account is on hold. Contact support and we will help.',
  // "A moment" was wrong and cost real debugging time: an email-code rate limit is measured
  // in tens of minutes, not seconds, so a tester who waits thirty seconds and retries simply
  // deepens the limit and concludes the app is broken. §7.6 asks for calm and specific — the
  // honest version says the wait is long without inventing a number the server never sent.
  RATE_LIMITED: 'Too many attempts. This one needs a longer wait — try again later.',
  UNKNOWN: 'Something went wrong on our side. Nothing you entered has been lost.',
};
