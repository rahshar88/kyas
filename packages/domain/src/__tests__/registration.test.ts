import {
  REGISTRATION_STEPS,
  emailSchema,
  emptyDraft,
  eligibilitySchema,
  indiaBackgroundSchema,
  ineligibilityReason,
  inviteCodeSchema,
  isDraftComplete,
  isEligible,
  nextIncompleteStep,
  otpCodeSchema,
  studyDetailsSchema,
  sydneyLocationSchema,
  type EligibilityAnswers,
} from '../index';

const ALL_YES: EligibilityAnswers = {
  isEighteenOrOlder: true,
  isFromIndia: true,
  isStudyingOrOffered: true,
  hasSydneyConnection: true,
};

describe('eligibility (§S05, §2.4, §2.5)', () => {
  it('admits someone who answers yes to all four', () => {
    expect(isEligible(ALL_YES)).toBe(true);
    expect(ineligibilityReason(ALL_YES)).toBeNull();
  });

  it.each([
    ['isEighteenOrOlder', 'under_18'],
    ['isFromIndia', 'not_from_india'],
    ['isStudyingOrOffered', 'not_studying'],
    ['hasSydneyConnection', 'not_sydney'],
  ] as const)('refuses when %s is false, and says why', (field, reason) => {
    const answers = { ...ALL_YES, [field]: false };

    expect(isEligible(answers)).toBe(false);
    expect(ineligibilityReason(answers)).toBe(reason);
  });

  it('requires every question to be answered', () => {
    expect(eligibilitySchema.safeParse({ isFromIndia: true }).success).toBe(false);
  });
});

describe('email (§S02)', () => {
  it('normalises case and whitespace, as §S02 requires', () => {
    expect(emailSchema.parse('  Asha@Example.COM ')).toBe('asha@example.com');
  });

  it.each(['not-an-email', 'a@', '@b.com', ''])('rejects %p', (value) => {
    expect(emailSchema.safeParse(value).success).toBe(false);
  });
});

describe('one-time code (§S03)', () => {
  it('accepts six digits, including a pasted value with spaces', () => {
    expect(otpCodeSchema.parse(' 123456 ')).toBe('123456');
  });

  it.each(['12345', '1234567', 'abcdef', ''])('rejects %p', (value) => {
    expect(otpCodeSchema.safeParse(value).success).toBe(false);
  });
});

describe('invite code (§S04)', () => {
  it('normalises the way the Edge Function does', () => {
    // Must match supabase/functions/_shared/invite-code.ts, or a valid code silently fails.
    expect(inviteCodeSchema.parse(' kya-scene-01 ')).toBe('KYASCENE01');
  });

  it.each(['abc', 'way-too-long-a-code-here', 'has_underscore!'])('rejects %p', (value) => {
    expect(inviteCodeSchema.safeParse(value).success).toBe(false);
  });
});

describe('study details (§S06)', () => {
  const valid = {
    provider: 'usyd',
    course: 'Master of IT',
    studyLevel: 'master' as const,
    intakeMonth: 2,
    intakeYear: 2026,
    completionMonth: 11,
    completionYear: 2027,
  };

  it('accepts a complete answer', () => {
    expect(studyDetailsSchema.safeParse(valid).success).toBe(true);
  });

  /** §S06: "Completion cannot precede intake." */
  it('rejects a completion date before the intake', () => {
    const result = studyDetailsSchema.safeParse({
      ...valid,
      completionYear: 2025,
    });

    expect(result.success).toBe(false);
  });

  it('rejects a completion month before the intake in the same year', () => {
    const result = studyDetailsSchema.safeParse({
      ...valid,
      intakeMonth: 7,
      intakeYear: 2026,
      completionMonth: 2,
      completionYear: 2026,
    });

    expect(result.success).toBe(false);
  });

  /** §S06: "future intake is allowed" — a student with an offer has not started yet. */
  it('allows an intake in the future', () => {
    expect(
      studyDetailsSchema.safeParse({
        ...valid,
        intakeYear: 2099,
        completionYear: 2100,
      }).success,
    ).toBe(true);
  });

  it('requires a name when the provider is not listed', () => {
    const withoutName = studyDetailsSchema.safeParse({ ...valid, provider: '__not_listed__' });
    expect(withoutName.success).toBe(false);

    const withName = studyDetailsSchema.safeParse({
      ...valid,
      provider: '__not_listed__',
      providerOther: 'Some Small College',
    });
    expect(withName.success).toBe(true);
  });
});

describe('Sydney location (§S07, §13.2)', () => {
  it('accepts a suburb with no postcode', () => {
    expect(
      sydneyLocationSchema.safeParse({ suburb: 'Ultimo', arrivalStatus: 'in_sydney' }).success,
    ).toBe(true);
  });

  it('rejects a postcode that is not four digits', () => {
    expect(
      sydneyLocationSchema.safeParse({
        suburb: 'Ultimo',
        postcode: '20',
        arrivalStatus: 'in_sydney',
      }).success,
    ).toBe(false);
  });

  /** §S07: "Public suburb visibility defaults off." */
  it('defaults suburb visibility to off', () => {
    const parsed = sydneyLocationSchema.parse({ suburb: 'Ultimo', arrivalStatus: 'in_sydney' });
    expect(parsed.suburbVisible).toBe(false);
  });

  /**
   * §13.2 forbids exact location and street address in P0. The guarantee is the absence of
   * the fields, so this asserts they cannot be smuggled in.
   */
  it('carries no coordinate or street field', () => {
    const parsed = sydneyLocationSchema.parse({
      suburb: 'Ultimo',
      arrivalStatus: 'in_sydney',
      // Extra keys are accepted by the input type and stripped by parse — which is the
      // behaviour being asserted.
      latitude: -33.88,
      streetAddress: '1 Example St',
    });

    expect(parsed).not.toHaveProperty('latitude');
    expect(parsed).not.toHaveProperty('streetAddress');
  });
});

describe('India background (§S08)', () => {
  /** §S08 acceptance: "A user may decline the city field without blocking registration." */
  it('accepts a state with no hometown', () => {
    expect(indiaBackgroundSchema.safeParse({ stateCode: 'IN-KL' }).success).toBe(true);
  });

  it('requires a state', () => {
    expect(indiaBackgroundSchema.safeParse({ hometown: 'Kochi' }).success).toBe(false);
  });

  /** §S08: "Both fields have independent profile-visibility controls", both off by default. */
  it('defaults both visibility controls to off', () => {
    const parsed = indiaBackgroundSchema.parse({ stateCode: 'IN-KL' });
    expect(parsed.stateVisible).toBe(false);
    expect(parsed.hometownVisible).toBe(false);
  });
});

describe('draft resumption (§10.2)', () => {
  it('resumes at the first incomplete step', () => {
    const draft = { ...emptyDraft('now'), completed: ['eligibility' as const] };
    expect(nextIncompleteStep(draft)).toBe('study');
  });

  it('resumes at an earlier gap rather than jumping forward', () => {
    // A student who went back and cleared an answer must not be thrown past it.
    const draft = { ...emptyDraft('now'), completed: ['study' as const] };
    expect(nextIncompleteStep(draft)).toBe('eligibility');
  });

  it('reports completion only when every step is done', () => {
    const draft = { ...emptyDraft('now'), completed: [...REGISTRATION_STEPS] };
    expect(nextIncompleteStep(draft)).toBeNull();
    expect(isDraftComplete(draft)).toBe(true);
  });
});
