import type { AccountStatus } from '@kyascene/domain';

/**
 * Route groups from spec §8.1.
 *
 * Only `(public)` has route files in Milestone 0 — §21.2 limits this milestone to a launch
 * screen and a welcome route. `(registration)` and `(approved)` are named here because the
 * *rules* about them are testable now even though the screens are not built: an empty
 * route group would type-check and then fail at runtime, which is worse than no group.
 * See docs/architecture/navigation.md for the full route map and its milestone owners.
 */
export const ROUTE_GROUPS = {
  public: '(public)',
  registration: '(registration)',
  approved: '(approved)',
} as const;

export type RouteGroup = (typeof ROUTE_GROUPS)[keyof typeof ROUTE_GROUPS];

/** Where a signed-out or unrecognised session lands. */
export const WELCOME_ROUTE = '/(public)/welcome' as const;

/**
 * The §8.2 routing rules as a pure function of server-reported account status.
 *
 * §8.2 is explicit that "route guards must be derived from server status, not only client
 * state", so this takes the status the server gave us and nothing else — no local flags,
 * no draft inspection. Milestone 1 wires it to the real status query; until then it is
 * exercised only by its test.
 *
 * The mapping:
 *  - invited / email_verified / onboarding  → resume registration
 *  - pending_review / rejected / suspended  → registration group, which owns the status screen
 *  - approved                               → beta home
 *  - deletion_pending / deleted             → session cleared, back to public welcome
 */
export function resolveRouteGroup(status: AccountStatus): RouteGroup {
  switch (status) {
    case 'invited':
    case 'email_verified':
    case 'onboarding':
    case 'pending_review':
    case 'rejected':
    case 'suspended':
      return ROUTE_GROUPS.registration;
    case 'approved':
      return ROUTE_GROUPS.approved;
    case 'deletion_pending':
    case 'deleted':
      return ROUTE_GROUPS.public;
  }
}

/** No session at all (§8.2: "No session: public welcome or sign-in"). */
export function resolveRouteGroupForSignedOut(): RouteGroup {
  return ROUTE_GROUPS.public;
}
