#!/usr/bin/env bash
#
# Applies the migrations to a throwaway PostgreSQL database and runs the RLS tests.
#
# Spec §20 requires proof that "one user cannot read another user's private records", and
# §16.1 asks for "repository integration tests against a dedicated test project or local
# Supabase". This runs against plain PostgreSQL rather than the full Supabase stack, because
# the policies are ordinary Postgres RLS — the only Supabase-specific pieces are `auth.uid()`
# and the three roles, which supabase/tests/00-local-shim.sql recreates faithfully.
#
# Requires: a running PostgreSQL server and a superuser connection.
#   Local:  pnpm run test:rls
#   CI:     the postgres service container in .github/workflows/ci.yml
#
# Environment:
#   PGHOST / PGPORT / PGUSER / PGPASSWORD  standard libpq variables
#   KYASCENE_TEST_DB                       database name (default kyascene_rls_test)

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DB_NAME="${KYASCENE_TEST_DB:-kyascene_rls_test}"

PSQL_BASE=(psql --quiet --no-psqlrc -v ON_ERROR_STOP=1)

cleanup() {
  "${PSQL_BASE[@]}" -d postgres -c "drop database if exists ${DB_NAME} with (force);" >/dev/null 2>&1 || true
}
trap cleanup EXIT

echo "→ creating throwaway database ${DB_NAME}"
cleanup
"${PSQL_BASE[@]}" -d postgres -c "create database ${DB_NAME};" >/dev/null

echo "→ applying Supabase shim"
"${PSQL_BASE[@]}" -d "${DB_NAME}" -f "${REPO_ROOT}/supabase/tests/00-local-shim.sql" >/dev/null

echo "→ applying migrations"
for migration in "${REPO_ROOT}"/supabase/migrations/*.sql; do
  echo "   $(basename "${migration}")"
  "${PSQL_BASE[@]}" -d "${DB_NAME}" -f "${migration}" >/dev/null
done

echo "→ applying seed"
for seed in "${REPO_ROOT}"/supabase/seed/*.sql; do
  echo "   $(basename "${seed}")"
  "${PSQL_BASE[@]}" -d "${DB_NAME}" -f "${seed}" >/dev/null
done

run_test() {
  echo "→ $(basename "$1")"
  # Notices carry the per-assertion output, so they must not be suppressed.
  PGOPTIONS='--client-min-messages=notice' \
    "${PSQL_BASE[@]}" -d "${DB_NAME}" -f "$1"
}

run_test "${REPO_ROOT}/supabase/tests/rls.test.sql"
run_test "${REPO_ROOT}/supabase/tests/redeem-invite.test.sql"
run_test "${REPO_ROOT}/supabase/tests/m2.test.sql"

# --------------------------------------------------------------- concurrency
#
# §S04 acceptance: "A code cannot be redeemed beyond its allowance under concurrent
# requests." The tests above run in one session, so they prove the logic but not the
# locking. This fires N real connections at a single remaining seat simultaneously.
echo "→ concurrent redemption of the last seat"

CONCURRENCY=8
"${PSQL_BASE[@]}" -d "${DB_NAME}" >/dev/null <<SQL
insert into auth.users (id, email)
  select gen_random_uuid(), 'race' || g || '@example.test' from generate_series(1, ${CONCURRENCY}) g;
insert into public.profiles (user_id, status)
  select id, 'invited' from auth.users where email like 'race%';
insert into public.invites (code_hash, capacity, redeemed_count)
  values ('hash-one-seat-race', 1, 0);
SQL

# Each background psql grabs a distinct racer and calls redeem_invite at the same moment.
pids=()
for i in $(seq 1 "${CONCURRENCY}"); do
  (
    "${PSQL_BASE[@]}" -d "${DB_NAME}" -tAc \
      "select public.redeem_invite(
         (select id from auth.users where email = 'race${i}@example.test'),
         'hash-one-seat-race')" >/dev/null 2>&1
  ) &
  pids+=($!)
done
for pid in "${pids[@]}"; do wait "${pid}" || true; done

REDEEMED=$("${PSQL_BASE[@]}" -d "${DB_NAME}" -tAc \
  "select redeemed_count from public.invites where code_hash = 'hash-one-seat-race'")
LEDGER=$("${PSQL_BASE[@]}" -d "${DB_NAME}" -tAc \
  "select count(*) from public.invite_redemptions r
     join public.invites i on i.id = r.invite_id
    where i.code_hash = 'hash-one-seat-race'")

if [ "${REDEEMED}" != "1" ] || [ "${LEDGER}" != "1" ]; then
  echo "  FAILED: ${CONCURRENCY} concurrent redemptions of a 1-seat invite produced" \
       "redeemed_count=${REDEEMED}, ledger rows=${LEDGER} (both must be 1)"
  exit 1
fi
echo "  ok   ${CONCURRENCY} concurrent redemptions of a 1-seat invite yielded exactly 1"

echo ""
echo "✔ database tests passed"
