#!/usr/bin/env bash
#
# Prints a valid sign-in code for an address, without sending an email.
#
# Supabase's Admin API can *generate* the same one-time code the email would have carried.
# The code is real: it goes through the same verification path, produces the same session, and
# expires the same way. Nothing is bypassed — the delivery step is simply skipped.
#
# ## Why this exists rather than a "master code" in the app
#
# A fixed code compiled into the app would be an authentication bypass in a signed binary. It
# would survive every future build, it would be readable by anyone who unpacked the bundle, and
# the day it reached production nobody would notice — §13.1's mandatory controls exist to stop
# exactly that. This tool lives outside the app, runs on your machine, and needs a key the app
# has never had.
#
# ## The key
#
# This needs the **service-role key**, which bypasses every Row Level Security policy in the
# schema. It stays in your shell and nowhere else:
#
#   * never commit it — `.env*` is gitignored and this script reads only the environment
#   * never paste it into a chat, an issue, or `eas.json`
#   * never give it an EXPO_PUBLIC_ prefix (§5.3)
#
# Supabase → Project settings → API keys → `service_role`. Then:
#
#   export SUPABASE_SERVICE_ROLE_KEY='sb_secret_...'
#   pnpm run dev:code you@example.com
#
# Usage: scripts/dev-signin-code.sh <email> [project-ref]

set -euo pipefail

EMAIL="${1:-}"
PROJECT_REF="${2:-yvofvmrsnhddpthzgkep}"

if [[ -z "${EMAIL}" ]]; then
  echo "usage: pnpm run dev:code <email> [project-ref]" >&2
  exit 2
fi

if [[ -z "${SUPABASE_SERVICE_ROLE_KEY:-}" ]]; then
  cat >&2 <<'MSG'
SUPABASE_SERVICE_ROLE_KEY is not set.

Get it from Supabase → Project settings → API keys → service_role, then:

  export SUPABASE_SERVICE_ROLE_KEY='sb_secret_...'

Keep it in your shell. It bypasses every security policy in the database, so it must
never be committed, pasted into a chat, or given an EXPO_PUBLIC_ prefix.
MSG
  exit 1
fi

# A publishable key here would fail with a confusing 401. Catching it by shape gives a useful
# message instead, and — more usefully — catches the reverse mistake elsewhere by making the
# distinction explicit.
if [[ "${SUPABASE_SERVICE_ROLE_KEY}" == sb_publishable_* ]]; then
  echo "That is the publishable key. This needs the service_role key." >&2
  exit 1
fi

URL="https://${PROJECT_REF}.supabase.co"

api() {
  curl -sS -X "$1" "${URL}$2" \
    -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \
    -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
    -H "Content-Type: application/json" \
    -d "$3"
}

echo "→ ${EMAIL} on ${PROJECT_REF}"

# Create the account if it does not exist yet. `email_confirm: true` marks the address verified
# without a round trip — the address belongs to whoever ran this, and a confirmation email is
# the thing we are working around.
CREATE=$(api POST "/auth/v1/admin/users" "{\"email\":\"${EMAIL}\",\"email_confirm\":true}")

if echo "${CREATE}" | grep -q '"id"'; then
  echo "  created a new account"
elif echo "${CREATE}" | grep -qi 'already been registered\|already exists'; then
  echo "  account already exists"
else
  echo "  could not create or find the account:" >&2
  echo "${CREATE}" >&2
  exit 1
fi

# `generate_link` returns the code without sending anything, so this is not subject to the
# email rate limit that blocks the normal path.
LINK=$(api POST "/auth/v1/admin/generate_link" "{\"type\":\"magiclink\",\"email\":\"${EMAIL}\"}")

CODE=$(echo "${LINK}" | sed -n 's/.*"email_otp":"\([0-9]*\)".*/\1/p')

if [[ -z "${CODE}" ]]; then
  echo "  no code came back:" >&2
  echo "${LINK}" >&2
  exit 1
fi

echo
echo "  ┌──────────────┐"
echo "  │   ${CODE}   │"
echo "  └──────────────┘"
echo
echo "Enter it on the 'Check your email' screen. It expires like any other code,"
echo "so generate a fresh one rather than reusing this."
