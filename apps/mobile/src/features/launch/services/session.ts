import type { AccountStatus } from '@kyascene/domain';

export interface RestoredSession {
  status: AccountStatus;
}

/** How long S00 will wait before giving up and showing a retry path. */
export const SESSION_RESTORE_TIMEOUT_MS = 4_000;

/**
 * Stub for Milestone 0.
 *
 * S00's real job is to read the secure session, check network state, check the onboarding
 * draft version and fetch server account status. None of that exists until Milestone 1 —
 * there is no Supabase client, no session and no status endpoint yet. This resolves `null`
 * (no session) so the launch screen exercises its real routing and timeout paths against a
 * seam that Milestone 1 replaces rather than against nothing.
 *
 * Deliberately not reading SecureStore yet: writing a read against a key format we have
 * not designed would bake in a guess.
 */
export async function restoreSession(): Promise<RestoredSession | null> {
  return null;
}
