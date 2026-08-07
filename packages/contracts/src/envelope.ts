import type { AppErrorCode } from '@kyascene/domain';

/**
 * Standard response envelope, per spec §12.3. Every Edge Function returns this shape.
 *
 * "The client may display the safe message but must log only the code and request ID."
 */
export interface ApiErrorBody {
  code: AppErrorCode;
  /** Safe, user-presentable text. Never a raw backend or database message. */
  message: string;
  /** Present only on RATE_LIMITED responses (§12.5). */
  retryAfterSeconds?: number;
}

export interface ApiSuccess<TData> {
  data: TData;
  error: null;
  requestId: string;
}

export interface ApiFailure {
  data: null;
  error: ApiErrorBody;
  requestId: string;
}

export type ApiResponse<TData> = ApiSuccess<TData> | ApiFailure;

export function isApiSuccess<TData>(response: ApiResponse<TData>): response is ApiSuccess<TData> {
  return response.error === null;
}

/**
 * Operations that must tolerate retries, per spec §12.4. Callers pass a stable
 * idempotency key so a dropped connection cannot create a duplicate record.
 */
export interface IdempotentRequest {
  idempotencyKey: string;
}
