# supabase/migrations

Applied in filename order. Never edited after being applied to a hosted project — write a new
migration instead.

| Migration                           | Contents                                                                                                                                                 |
| ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `20260808000100_initial_schema.sql` | §11.1 tables for Milestone 1: `profiles`, `student_profiles`, `invites`, `invite_redemptions`, and the `india_states` / `education_providers` catalogues |
| `20260808000200_rls.sql`            | Row Level Security on every table, plus the trigger that keeps `status` server-controlled (§11.2)                                                        |
| `20260808000300_redeem_invite.sql`  | The atomic `redeem_invite` function behind the Edge Function (§S04)                                                                                      |

Milestone 2 adds `profile_visibility`, `consents`, `verification_requests`, the interest and
community catalogues, and `admin_audit_logs`. Milestone 3 adds `beta_feedback`,
`push_devices`, `feature_flags` and `deletion_requests`.

## Rules

- **RLS with every table, in the same migration.** §13.1: "Row Level Security enabled before
  any beta user is added." A table that exists without a policy is a defect.
- Verified by `pnpm run test:rls`, which applies every migration to a throwaway database and
  asserts row isolation. It runs in CI on each pull request.
