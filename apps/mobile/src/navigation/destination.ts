import { nextIncompleteStep, type AccountStatus, type RegistrationDraft } from '@kyascene/domain';

import { WELCOME_ROUTE } from './route-groups';

/**
 * Where a returning user belongs (§8.2, §10.2).
 *
 * `route-groups.ts` answers which *group* a status maps to. That was enough for Milestone 0,
 * when the groups had no screens. This answers the question that actually matters now: which
 * route, given the status the server reported and how far the draft got.
 *
 * §10.2 "Returning incomplete tester": _"Launch → Restore session → Fetch status → Resume last
 * valid registration step."_ Until this existed, the launch screen sent every signed-in user to
 * the welcome screen regardless of status — so a tester mid-registration was greeted with
 * "Join the beta" and a submitted tester never saw their own status. It carried a comment
 * saying Milestone 1 would replace it, and Milestone 1 did not.
 *
 * A pure function on purpose: §8.2 requires guards "derived from server status, not only
 * client state", which means the decision has to be testable without a navigator, and the same
 * decision has to be reachable from anywhere that needs to re-check it.
 */
export interface DestinationInput {
  status: AccountStatus | null;
  /** §S04 gates registration on redemption, so "invited" alone does not say where to go. */
  hasRedeemedInvite: boolean;
  draft: RegistrationDraft | null;
}

/** Route paths, matching the files under `app/(registration)/`. */
export const REGISTRATION_ROUTES = {
  invite: '/invite',
  eligibility: '/eligibility',
  study: '/study',
  'sydney-location': '/sydney-location',
  'india-background': '/india-background',
  languages: '/languages',
  communities: '/communities',
  interests: '/interests',
  goals: '/goals',
  privacy: '/privacy',
  consent: '/consent',
  review: '/review',
  status: '/status',
} as const;

export function resolveDestination(input: DestinationInput): string {
  const { status, hasRedeemedInvite, draft } = input;

  // No session, or a status this build does not recognise: start from the public surface
  // rather than guessing. §8.2's first rule.
  if (status === null) return WELCOME_ROUTE;

  switch (status) {
    /**
     * Deleted accounts must not resume anything. §11.4 puts deletion behind a workflow, and a
     * session that outlives it should find nothing to return to.
     */
    case 'deletion_pending':
    case 'deleted':
      return WELCOME_ROUTE;

    /**
     * §S17 owns all four of these. A rejected or suspended tester is deliberately sent to the
     * same screen as a pending one — it is the screen that explains their state, and routing
     * them anywhere else would either hide the reason or drop them into a flow they cannot
     * complete.
     *
     * `approved` lands here too until Milestone 3 builds S18. That is honest rather than
     * ideal: an approved tester sees "you are in" and a note that the beta home is coming,
     * which beats a route that does not exist.
     */
    case 'pending_review':
    case 'rejected':
    case 'suspended':
    case 'approved':
      return REGISTRATION_ROUTES.status;

    case 'invited':
    case 'email_verified':
    case 'onboarding': {
      // §S04: the beta is invite-only, and every later step assumes a redemption exists.
      if (!hasRedeemedInvite) return REGISTRATION_ROUTES.invite;

      // No draft yet — signed in on a new device, or the draft was discarded by a version
      // bump. Start at the beginning; the server still holds anything already submitted.
      if (draft === null) return REGISTRATION_ROUTES.eligibility;

      const next = nextIncompleteStep(draft);

      // Every step done but not submitted: §S16 is where they left off, not step one.
      return next === null ? REGISTRATION_ROUTES.review : REGISTRATION_ROUTES[next];
    }
  }
}
