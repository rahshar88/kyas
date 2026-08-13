import type { AccountStatus } from '@kyascene/domain';

export interface RestoredSession {
  status: AccountStatus;
}

/**
 * How long S00 will wait before giving up and showing a retry path.
 *
 * §S00: "After a bounded timeout, show retry and offline guidance. Never trap the user on a
 * permanent splash screen." The bound covers session restoration and the two lookups that
 * decide where to go — from the user's side that is one wait, and a query that hangs after an
 * instant restore still leaves them staring at a splash screen.
 */
export const SESSION_RESTORE_TIMEOUT_MS = 4_000;

/**
 * Session restoration now lives in `AuthProvider`, which reads the platform keychain and
 * fetches server status (§8.2: guards derived from server status, not client state).
 *
 * This stub returned `null` unconditionally as a Milestone 0 seam. It is kept only as the home
 * of the timeout constant — a function that always says "no session" would silently sign
 * everyone out if anything called it again.
 */
