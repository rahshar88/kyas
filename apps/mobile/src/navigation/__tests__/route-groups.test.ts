import { ACCOUNT_STATUSES, type AccountStatus } from '@kyascene/domain';

import { ROUTE_GROUPS, resolveRouteGroup, type RouteGroup } from '../route-groups';

/**
 * The §8.2 routing rules, written out independently of the implementation.
 *
 * `satisfies Record<AccountStatus, RouteGroup>` is the point of this table: adding a
 * status to §11.2 without deciding where it routes becomes a compile error, not a runtime
 * surprise on a tester's phone.
 */
const EXPECTED = {
  invited: ROUTE_GROUPS.registration,
  email_verified: ROUTE_GROUPS.registration,
  onboarding: ROUTE_GROUPS.registration,
  pending_review: ROUTE_GROUPS.registration,
  rejected: ROUTE_GROUPS.registration,
  suspended: ROUTE_GROUPS.registration,
  approved: ROUTE_GROUPS.approved,
  deletion_pending: ROUTE_GROUPS.public,
  deleted: ROUTE_GROUPS.public,
} satisfies Record<AccountStatus, RouteGroup>;

describe('resolveRouteGroup (spec §8.2)', () => {
  it.each(ACCOUNT_STATUSES)('routes %s to its specified group', (status) => {
    expect(resolveRouteGroup(status)).toBe(EXPECTED[status]);
  });

  it('covers every account status in §11.2', () => {
    expect(Object.keys(EXPECTED).sort()).toEqual([...ACCOUNT_STATUSES].sort());
  });

  /**
   * §20: "An approved user reaches the beta home; a pending or suspended user cannot."
   * Asserted directly so the guarantee survives a future refactor of the switch.
   */
  it('admits only approved accounts to the beta home', () => {
    const admitted = ACCOUNT_STATUSES.filter(
      (status) => resolveRouteGroup(status) === ROUTE_GROUPS.approved,
    );
    expect(admitted).toEqual(['approved']);
  });

  it('returns a deleted account to the public group so no session lingers', () => {
    expect(resolveRouteGroup('deleted')).toBe(ROUTE_GROUPS.public);
    expect(resolveRouteGroup('deletion_pending')).toBe(ROUTE_GROUPS.public);
  });
});
