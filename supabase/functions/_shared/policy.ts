/**
 * The policy version a registration must have consented to (spec §S15).
 *
 * §S15 requires storing "policy type, version, accepted timestamp and user ID", which only
 * means anything if there is a single authority on what "current" is. Bump this when the
 * terms, privacy policy, community guidelines or beta-change notice materially change, and
 * every user is asked again — existing consent rows survive as the evidence of what they
 * agreed to at the time.
 *
 * This value is duplicated in `packages/domain/src/consent.ts` because Deno Edge Functions
 * cannot import from the pnpm workspace. A test in that package reads THIS file and fails if
 * the two drift, so the duplication cannot rot silently.
 */
export const CURRENT_POLICY_VERSION = '2026-08-01';
