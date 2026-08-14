/**
 * Versioned consent (spec §S15).
 *
 * §S15: "Store policy type, version, accepted timestamp and user ID" and — the rule that
 * shapes this file — "Required and optional consent must never be bundled."
 */

/**
 * The policy version the app records consent against.
 *
 * Duplicated from `supabase/functions/_shared/policy.ts`, because Deno Edge Functions cannot
 * import from the pnpm workspace. `__tests__/consent.test.ts` reads that file and fails if the
 * two drift — a mismatch would let a user consent to one version while submission demands
 * another, and the registration would be rejected as incomplete with nothing on screen to
 * explain why.
 */
export const CURRENT_POLICY_VERSION = '2026-08-01';

/**
 * The four policies a registration cannot be submitted without (§S15: "Required: Terms
 * acceptance, privacy acknowledgement, community guidelines and confirmation that beta
 * features may change").
 */
export const REQUIRED_CONSENTS = [
  'terms',
  'privacy',
  'community_guidelines',
  'beta_changes',
] as const;

/**
 * Consent that must be separately given and separately declinable (§S15: "Optional: Marketing
 * communication consent, separate and unchecked").
 *
 * Kept in its own list rather than flagged inside one list, so that "accept all" cannot be
 * written as a loop over a single array — which is how bundling happens by accident.
 */
export const OPTIONAL_CONSENTS = ['marketing'] as const;

export type RequiredConsent = (typeof REQUIRED_CONSENTS)[number];
export type OptionalConsent = (typeof OPTIONAL_CONSENTS)[number];
export type ConsentPolicyType = RequiredConsent | OptionalConsent;

export interface ConsentChoice {
  policyType: ConsentPolicyType;
  version: string;
  accepted: boolean;
}

/** Whether every required policy has been accepted at the current version. */
export function hasAllRequiredConsents(
  choices: readonly ConsentChoice[],
  version: string = CURRENT_POLICY_VERSION,
): boolean {
  return REQUIRED_CONSENTS.every((policyType) =>
    choices.some(
      (choice) => choice.policyType === policyType && choice.version === version && choice.accepted,
    ),
  );
}

/**
 * Human copy for each policy. Kept beside the types so a new policy cannot be added without
 * someone deciding what it says on screen.
 */
export const CONSENT_LABELS: Record<ConsentPolicyType, string> = {
  terms: 'I accept the Terms of Use',
  privacy: 'I have read the Privacy Policy',
  community_guidelines: 'I agree to the Community Guidelines',
  beta_changes: 'I understand this is a beta and features may change',
  marketing: 'Send me occasional updates about KyaScene (optional)',
};
