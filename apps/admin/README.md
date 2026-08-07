# apps/admin — private operations console

**Not implemented. Milestone 2 owns this.**

Spec §15 introduces a small private web console for the founder and authorised operators.
§15 explicitly notes this does not conflict with §4.7's app-only consumer strategy: the
consumer product is native-only; this is internal tooling.

## Why it is a placeholder in Milestone 0

Milestone 0 delivers the repository and vertical foundation. Milestone 2's exit criterion is
_"an administrator can approve a submitted student and the user can enter approved routes"_,
so the console arrives with the registration data and the audit log it operates on. Standing
up an empty web shell now would add setup surface with nothing to administer — and §11.3's
principle applies: do not create scaffolding merely to appear complete.

## P0 screens (§15.1)

1. Admin sign-in
2. Registration queue
3. Registration detail
4. Approve/reject decision
5. User search and status
6. Invite campaigns
7. Referral overview
8. Feedback inbox
9. Beta announcements
10. Audit log

## Rules that constrain the implementation (§15.2)

- Admin roles are **separate** from student roles.
- Never rely only on hidden navigation for authorisation — every privileged action is
  checked server-side.
- Sensitive actions require a reason, recorded in `admin_audit_logs` (§11.1).
- Bulk announcements require a preview and an explicit confirmation.
- Rejected users never see private moderator notes (§S17).
- Exports are restricted, logged, and contain only the required fields.

Also relevant: §13.3 requires moderation controls over profile names, photographs and
hometown text — user-generated content exists before the feed does.

## Shared code

The console consumes `@kyascene/domain` and `@kyascene/contracts` so that account statuses,
error codes and the API envelope cannot drift between the app and the admin tooling.
