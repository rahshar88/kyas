/**
 * Account lifecycle, per spec §11.2.
 *
 * Status changes must be validated server-side and recorded in `admin_audit_logs`.
 * The client treats this value as read-only truth from the server (§8.2: "Route guards
 * must be derived from server status, not only client state").
 */
export const ACCOUNT_STATUSES = [
  'invited',
  'email_verified',
  'onboarding',
  'pending_review',
  'approved',
  'rejected',
  'suspended',
  'deletion_pending',
  'deleted',
] as const;

export type AccountStatus = (typeof ACCOUNT_STATUSES)[number];

export function isAccountStatus(value: unknown): value is AccountStatus {
  return typeof value === 'string' && (ACCOUNT_STATUSES as readonly string[]).includes(value);
}

/**
 * Only an approved account may enter the `(approved)` route group. Spec §20 requires
 * that "an approved user reaches the beta home; a pending or suspended user cannot".
 */
export function canEnterBeta(status: AccountStatus): boolean {
  return status === 'approved';
}
