#!/usr/bin/env bash
#
# Grants an address administrative access to the operations console (§15.2).
#
# `admin_users` is unreachable from every client role, so this is one of only two ways to write
# it — the other is the SQL editor. Both need the service-role key, which is the point: a
# console that could create its own administrators would be the most valuable thing in the
# company to phish.
#
# The key stays in your shell. See scripts/dev-signin-code.sh for why that matters.
#
# Usage: pnpm run dev:admin <email> [project-ref]

set -euo pipefail

EMAIL="${1:-}"
PROJECT_REF="${2:-yvofvmrsnhddpthzgkep}"

if [[ -z "${EMAIL}" ]]; then
  echo "usage: pnpm run dev:admin <email> [project-ref]" >&2
  exit 2
fi

if [[ -z "${SUPABASE_SERVICE_ROLE_KEY:-}" ]]; then
  echo "SUPABASE_SERVICE_ROLE_KEY is not set. See scripts/dev-signin-code.sh." >&2
  exit 1
fi

URL="https://${PROJECT_REF}.supabase.co"

# Look the user up rather than taking an id on the command line: an operator granted to the
# wrong uuid is silent, and a typo in an email address is not.
USER_JSON=$(curl -sS "${URL}/auth/v1/admin/users?page=1&per_page=1000" \
  -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}")

USER_ID=$(echo "${USER_JSON}" | node -e "
let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{
  const users = (JSON.parse(s).users ?? []);
  const match = users.find(u => (u.email ?? '').toLowerCase() === process.argv[1].toLowerCase());
  process.stdout.write(match ? match.id : '');
});" "${EMAIL}")

if [[ -z "${USER_ID}" ]]; then
  echo "No account for ${EMAIL}. Run 'pnpm run dev:code ${EMAIL}' first — it creates one." >&2
  exit 1
fi

# PostgREST reaches admin_users because the service role bypasses RLS. No client role can.
RESULT=$(curl -sS -X POST "${URL}/rest/v1/admin_users" \
  -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Content-Type: application/json" \
  -H "Prefer: resolution=merge-duplicates,return=representation" \
  -d "{\"user_id\":\"${USER_ID}\",\"role\":\"administrator\",\"active\":true}")

if echo "${RESULT}" | grep -q '"user_id"'; then
  echo "✔ ${EMAIL} is now an administrator"
else
  echo "Could not grant access:" >&2
  echo "${RESULT}" >&2
  exit 1
fi
