import { AppError } from '@kyascene/domain';

import { toAppError } from '../errors';

/**
 * Error classification, pinned to responses observed from the live project rather than to
 * what the server ought to send.
 *
 * Every case below was, at some point, shown to a tester as the wrong message — twice as a
 * network failure for a server that answered immediately, and once as "your session has
 * ended" for a mistyped code. The mapping is where those bugs lived, and it is invisible
 * from any screen test, because a screen test supplies an `AppError` that has already been
 * classified. So the fixtures are verbatim.
 */

/** Shaped like `AuthApiError`: message, status and GoTrue's `error_code` as `code`. */
const authError = (message: string, status: number, code: string) =>
  Object.assign(new Error(message), { status, code, name: 'AuthApiError' });

describe('toAppError', () => {
  /**
   * `POST /auth/v1/verify` with a wrong code, on 2026-08-13:
   *   403 {"code":403,"error_code":"otp_expired","msg":"Token has expired or is invalid"}
   *
   * The prose matched a rule meant for expired JWTs (`token .*expired`), so the single most
   * common failure in the whole beta — mistyping a sign-in code — told the tester their
   * session had ended and to sign in again, which is what they were already doing.
   */
  it('reads a rejected sign-in code as a bad answer, not an ended session', () => {
    const error = toAppError(
      authError('Token has expired or is invalid', 403, 'otp_expired'),
      'VALIDATION_FAILED',
    );

    expect(error.code).toBe('VALIDATION_FAILED');
  });

  it('reads a disabled one-time code the same way', () => {
    expect(toAppError(authError('Email logins are disabled', 422, 'otp_disabled')).code).toBe(
      'VALIDATION_FAILED',
    );
  });

  /**
   * `POST /auth/v1/otp` while rate limited:
   *   429 {"code":429,"error_code":"over_email_send_rate_limit","msg":"For security purposes…"}
   *
   * supabase-js retries a 429 and can surface the give-up as something matching the network
   * patterns, so the code is checked before both the status and the message.
   */
  it('reads an email send limit as rate limiting', () => {
    expect(
      toAppError(
        authError(
          'For security purposes, you can only request this after 60 seconds.',
          429,
          'over_email_send_rate_limit',
        ),
      ).code,
    ).toBe('RATE_LIMITED');
  });

  it('still reads a genuine expired session as one', () => {
    expect(toAppError(authError('JWT expired', 401, 'bad_jwt')).code).toBe('SESSION_EXPIRED');
  });

  it('reads a dropped connection as being offline', () => {
    expect(toAppError(new TypeError('Network request failed')).code).toBe('NETWORK_UNAVAILABLE');
  });

  /** §6.4: the fallback is the caller's, so each repository names its own likeliest cause. */
  it('falls back to what the caller expects', () => {
    expect(toAppError(new Error('something unhelpful'), 'VALIDATION_FAILED').code).toBe(
      'VALIDATION_FAILED',
    );
    expect(toAppError(new Error('something unhelpful')).code).toBe('UNKNOWN');
  });

  it('passes an already-typed error through untouched', () => {
    const original = new AppError('RATE_LIMITED');
    expect(toAppError(original, 'UNKNOWN')).toBe(original);
  });
});
