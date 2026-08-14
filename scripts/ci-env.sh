#!/usr/bin/env bash
# Placeholder EXPO_PUBLIC_* values for config validation, prebuild and bundle checks.
#
# These are obviously-fake and must stay that way. Real beta and production values live in
# EAS environment variables (§5.3), never in the repository. Source this, then set
# EXPO_PUBLIC_ENVIRONMENT to the environment under test.
export EXPO_PUBLIC_SUPABASE_URL="https://ci-placeholder.supabase.co"
export EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY="ci-placeholder-publishable-key-value"
export EXPO_PUBLIC_SENTRY_DSN="https://ci@ci.ingest.sentry.io/0"
export EXPO_PUBLIC_ANALYTICS_KEY="ci-placeholder-analytics-key"
export EXPO_PUBLIC_SUPPORT_URL="https://kyascene.app/support"
export EXPO_PUBLIC_PRIVACY_URL="https://kyascene.app/privacy"
export EXPO_PUBLIC_TERMS_URL="https://kyascene.app/terms"
