import {
  CONSENT_LABELS,
  CURRENT_POLICY_VERSION,
  OPTIONAL_CONSENTS,
  REQUIRED_CONSENTS,
  hasAllRequiredConsents,
  type ConsentChoice,
} from '../consent';

const accept = (policyType: string, version = CURRENT_POLICY_VERSION): ConsentChoice =>
  ({ policyType, version, accepted: true }) as ConsentChoice;

describe('consent (§S15)', () => {
  // The cross-language version drift guard lives in scripts/verify-consent-version.mjs:
  // it reads the Deno Edge Function and the SQL migration, which this package must not be
  // able to do. `packages/domain` has no Node types on purpose, so shared domain code cannot
  // reach the filesystem.

  describe('required and optional consent are never bundled', () => {
    it('keeps marketing out of the required set', () => {
      expect(REQUIRED_CONSENTS).not.toContain('marketing');
      expect(OPTIONAL_CONSENTS).toContain('marketing');
    });

    it('submits with every required policy accepted and marketing declined', () => {
      const choices = [
        ...REQUIRED_CONSENTS.map((policy) => accept(policy)),
        { policyType: 'marketing', version: CURRENT_POLICY_VERSION, accepted: false },
      ] as ConsentChoice[];

      expect(hasAllRequiredConsents(choices)).toBe(true);
    });

    it.each(REQUIRED_CONSENTS)('refuses when %s is missing', (missing) => {
      const choices = REQUIRED_CONSENTS.filter((policy) => policy !== missing).map((policy) =>
        accept(policy),
      );

      expect(hasAllRequiredConsents(choices)).toBe(false);
    });

    it('refuses a required policy that was explicitly declined', () => {
      const choices = [
        ...REQUIRED_CONSENTS.filter((policy) => policy !== 'terms').map((policy) => accept(policy)),
        { policyType: 'terms', version: CURRENT_POLICY_VERSION, accepted: false },
      ] as ConsentChoice[];

      expect(hasAllRequiredConsents(choices)).toBe(false);
    });
  });

  it('ignores consent given to a superseded version', () => {
    const choices = REQUIRED_CONSENTS.map((policy) => accept(policy, '2020-01-01'));

    expect(hasAllRequiredConsents(choices)).toBe(false);
  });

  it('gives every policy a label, so a new one cannot ship unworded', () => {
    for (const policy of [...REQUIRED_CONSENTS, ...OPTIONAL_CONSENTS]) {
      expect(CONSENT_LABELS[policy]).toEqual(expect.any(String));
      expect(CONSENT_LABELS[policy].length).toBeGreaterThan(10);
    }
  });

  it('marks the optional consent as optional in its own label', () => {
    // §S15 wants the distinction visible to the user, not only in the data model.
    expect(CONSENT_LABELS.marketing).toMatch(/optional/i);
  });
});
