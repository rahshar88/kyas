# supabase/

Backend structure for KyaScene (spec §4.3, §11, §12).

## Milestone 0 scope

Structure only. **No tables, no migrations, no Edge Functions yet** — §11.3 is explicit:

> Do not create empty future tables merely to appear complete. Add them with the milestone
> that owns them.

`@supabase/supabase-js` is deliberately not a dependency of the mobile app yet either.
Milestone 1 adds the client, the first migration and the first RLS policies together, so
that no table ever exists without the policy that protects it.

## Ownership by milestone

| Directory     | Owner       | First contents                                                         |
| ------------- | ----------- | ---------------------------------------------------------------------- |
| `migrations/` | Milestone 1 | `profiles`, `student_profiles`, `invites`, `invite_redemptions`        |
| `seed/`       | Milestone 1 | reference catalogues: `languages`, `communities`, `interests`, `goals` |
| `functions/`  | Milestone 1 | `redeem-invite`, `submit-registration` (§12.2)                         |
| `tests/`      | Milestone 1 | RLS tests proving one user cannot read another's private records (§20) |

## Environments (§5.2)

Three **separate hosted projects** — never one project with a shared database:

| Environment | Data                 | Credentials                                           |
| ----------- | -------------------- | ----------------------------------------------------- |
| Development | Synthetic only       | Local `supabase start`, or a dedicated dev project    |
| Beta        | Real invited testers | Own project, own storage bucket, own push credentials |
| Production  | Real public users    | Own project, strictly separated from beta             |

## Non-negotiable rules

- **Row Level Security enabled before any beta user is added** (§13.1). A table without a
  policy is a defect, not a to-do.
- The service-role key never leaves Edge Function secrets. It must never appear in the
  mobile bundle, in `eas.json`, or in this repository (§5.3, §13.1).
- Privileged, multi-table or administrative work goes through Edge Functions; direct client
  access is only for what is safe under RLS (§12.1).
- Registration submission, invite redemption, feedback upload, push registration and
  deletion requests must all tolerate retries (§12.4).
- Migrations are reviewed and committed — never applied by hand to a hosted project (§13.1).
