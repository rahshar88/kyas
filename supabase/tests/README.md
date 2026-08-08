# supabase/tests

Run with `pnpm run test:rls` (needs a running PostgreSQL and libpq environment variables), or
automatically in the `database` CI job.

| File | Covers |
| --- | --- |
| `00-local-shim.sql` | Test infrastructure. Recreates `auth.users`, `auth.uid()` and the three Supabase roles on plain PostgreSQL. Never applied to a hosted project |
| `rls.test.sql` | §20 row isolation: one student cannot read another's profile, private record, suburb, hometown or redemption; status is server-controlled; the invite ledger is unreadable; catalogues are read-only |
| `redeem-invite.test.sql` | §S04 redemption: unknown, expired, revoked and exhausted codes; idempotent retry; the capacity backstop; and that a student cannot call `redeem_invite` directly |

The runner also fires **8 concurrent connections at a single remaining seat** and asserts
exactly one redemption results — §S04's "a code cannot be redeemed beyond its allowance under
concurrent requests", tested rather than assumed.

## Why plain PostgreSQL rather than the Supabase CLI

The policies are ordinary Postgres RLS. The only Supabase-specific pieces are `auth.uid()` and
the `anon` / `authenticated` / `service_role` roles, which the shim recreates faithfully —
`auth.uid()` reads `request.jwt.claim.sub` exactly as PostgREST sets it. That keeps the suite
fast and free of Docker, so it runs on every pull request rather than only locally.

## These tests are known to fail when they should

They were negative-controlled against three deliberately broken variants: a `profiles` select
policy widened to `using (true)`, the privileged-column guard trigger dropped, and RLS switched
off on `student_profiles`. Each was caught by the assertion that should have caught it.
