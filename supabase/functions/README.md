# supabase/functions

Edge Functions for operations that need privileged checks, multi-table transactions or
administrative authority (§12.1). Anything safe under RLS goes direct from the client instead.

| Function                    | Milestone | Responsibility                                                |
| --------------------------- | --------- | ------------------------------------------------------------- |
| `redeem-invite`             | ✅ M1     | Validate and atomically redeem an invitation (§S04)           |
| `submit-registration`       | M2        | Validate a complete profile and move status to pending review |
| `submit-feedback`           | M3        | Create feedback and an optional screenshot reference          |
| `request-account-deletion`  | M3        | Verify and initiate the deletion workflow                     |
| `register-push-device`      | M3        | Validate and store a platform push token                      |
| `admin-review-registration` | M2        | Approve or reject with a reason and an audit event            |
| `admin-suspend-user`        | M2        | Suspend access with a reason and an audit event               |
| `admin-send-announcement`   | M3        | Send controlled beta communication                            |

## Conventions

- Return the §12.3 envelope via `_shared/response.ts`. Never leak a database message to a
  client; log the error code and request id only.
- Take the caller's identity from the verified JWT, **never** from the request body.
- Keep atomicity in SQL. `redeem-invite` is thin on purpose — the row lock lives in the
  `redeem_invite` function, because a read-then-write in TypeScript reintroduces the race
  §S04 forbids.
- Operations that must tolerate retries (§12.4) return success for a repeat, not an error.
