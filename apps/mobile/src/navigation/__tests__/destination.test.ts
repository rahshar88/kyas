import {
  ACCOUNT_STATUSES,
  REGISTRATION_STEPS,
  emptyDraft,
  type AccountStatus,
  type RegistrationDraft,
  type RegistrationStep,
} from '@kyascene/domain';

import { REGISTRATION_ROUTES, resolveDestination } from '../destination';
import { WELCOME_ROUTE } from '../route-groups';

const draftWith = (completed: RegistrationStep[]): RegistrationDraft => ({
  ...emptyDraft('2026-08-13T00:00:00.000Z'),
  completed,
});

const resolve = (
  status: AccountStatus | null,
  options: { hasRedeemedInvite?: boolean; draft?: RegistrationDraft | null } = {},
) =>
  resolveDestination({
    status,
    hasRedeemedInvite: options.hasRedeemedInvite ?? true,
    draft: options.draft ?? null,
  });

describe('resolveDestination (§8.2, §10.2)', () => {
  it('sends a signed-out user to the public welcome', () => {
    expect(resolve(null)).toBe(WELCOME_ROUTE);
  });

  /**
   * The whole point of §10.2: a returning tester resumes where they stopped. Before this
   * function existed every one of these landed on the welcome screen.
   */
  describe('resuming registration', () => {
    it('asks for the invitation first, whatever the draft says', () => {
      expect(
        resolve('invited', { hasRedeemedInvite: false, draft: draftWith(['eligibility']) }),
      ).toBe(REGISTRATION_ROUTES.invite);
    });

    it('starts at eligibility when there is no draft', () => {
      expect(resolve('invited', { draft: null })).toBe(REGISTRATION_ROUTES.eligibility);
    });

    it.each(REGISTRATION_STEPS.map((_, index) => index))(
      'resumes at the first unfinished step when %i are done',
      (count) => {
        const completed = REGISTRATION_STEPS.slice(0, count);
        const expected = REGISTRATION_STEPS[count];

        expect(resolve('onboarding', { draft: draftWith([...completed]) })).toBe(
          REGISTRATION_ROUTES[expected as RegistrationStep],
        );
      },
    );

    it('goes to review when every step is done but nothing is submitted', () => {
      expect(resolve('onboarding', { draft: draftWith([...REGISTRATION_STEPS]) })).toBe(
        REGISTRATION_ROUTES.review,
      );
    });

    /**
     * Steps are resumed in order, not by furthest reached. Someone who went back to change an
     * earlier answer must not be thrown forward past it — §10.2 resumes the "last valid" step.
     */
    it('returns to an earlier gap rather than the furthest step reached', () => {
      const draft = draftWith(['eligibility', 'sydney-location', 'india-background']);

      expect(resolve('onboarding', { draft })).toBe(REGISTRATION_ROUTES.study);
    });
  });

  describe('after submission', () => {
    it.each(['pending_review', 'rejected', 'suspended', 'approved'] as const)(
      'sends a %s account to the status screen',
      (status) => {
        expect(resolve(status)).toBe(REGISTRATION_ROUTES.status);
      },
    );

    /**
     * §20 and §8.2: a rejected or suspended account must not be able to walk back into
     * registration. The server also refuses their resubmission, so this is the visible half of
     * a rule enforced in both places.
     */
    it.each(['rejected', 'suspended'] as const)(
      'does not send a %s account back into the flow, even with an unfinished draft',
      (status) => {
        expect(resolve(status, { draft: draftWith([]) })).toBe(REGISTRATION_ROUTES.status);
      },
    );
  });

  describe('accounts on their way out (§11.4)', () => {
    it.each(['deletion_pending', 'deleted'] as const)('sends a %s account to welcome', (status) => {
      expect(resolve(status, { draft: draftWith([...REGISTRATION_STEPS]) })).toBe(WELCOME_ROUTE);
    });
  });

  /**
   * Exhaustive over §11.2's nine statuses. Adding a tenth without deciding where it routes
   * breaks this test rather than silently defaulting someone somewhere plausible.
   */
  it('resolves a destination for every account status', () => {
    for (const status of ACCOUNT_STATUSES) {
      expect(typeof resolve(status)).toBe('string');
    }
    expect(ACCOUNT_STATUSES).toHaveLength(9);
  });

  /** Every registration step must have a route, or a resume would navigate nowhere. */
  it('has a route for every registration step', () => {
    for (const step of REGISTRATION_STEPS) {
      expect(REGISTRATION_ROUTES[step]).toEqual(expect.stringMatching(/^\//));
    }
  });
});
