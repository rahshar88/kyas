#!/usr/bin/env bash
#
# Applies migrations, seed data and Edge Functions to a hosted Supabase project.
#
# Run this once per environment (§5.2 requires separate dev, beta and production projects).
# It is idempotent: migrations are tracked by Supabase, and every seed file uses
# `on conflict … do update`, so re-running is how the reference lists get amended.
#
# Usage:
#   pnpm run supabase:deploy <project-ref>
#
# The project ref is the subdomain of your project URL — for
# https://abcdefgh.supabase.co the ref is `abcdefgh`.
#
# Prerequisites:
#   npx supabase login          (once per machine — opens a browser)
#   the database password from when the project was created; `link` prompts for it
#
# What this deliberately does NOT do: touch the service-role key, write anything to the
# repository, or run against a project you have not explicitly named. §5.2 is emphatic that
# beta and production stay separate, so there is no "deploy everywhere" mode.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PROJECT_REF="${1:-}"
SUPABASE="npx --yes supabase@latest"

if [ -z "${PROJECT_REF}" ]; then
  echo "usage: pnpm run supabase:deploy <project-ref>" >&2
  echo "  the ref is the subdomain of your project URL, e.g. abcdefgh" >&2
  exit 2
fi

cd "${REPO_ROOT}"

echo "→ linking to project ${PROJECT_REF}"
${SUPABASE} link --project-ref "${PROJECT_REF}"

# Applies everything in supabase/migrations in filename order, recording each in the
# project's migration history so a second run is a no-op. `--include-seed` also applies the
# reference catalogues declared under [db.seed] in supabase/config.toml — those are idempotent
# upserts, so re-running amends the lists rather than duplicating them.
echo "→ applying migrations and seed data"
${SUPABASE} db push --include-seed

echo "→ deploying Edge Functions"
${SUPABASE} functions deploy redeem-invite --project-ref "${PROJECT_REF}"

echo ""
echo "✔ deployed to ${PROJECT_REF}"
echo ""
echo "Next: confirm Row Level Security is on for every table in the dashboard"
echo "  (Database → Tables → each table should show 'RLS enabled')."
echo "§13.1 requires this BEFORE any beta user is added."
