#!/usr/bin/env node
/**
 * Keeps the consent policy version identical across the three languages that need it.
 *
 * §S15 requires versioned consent: a registration is only complete if the user has accepted
 * the *current* version of each required policy. That check is made by SQL, using a version
 * supplied by a Deno Edge Function, against rows written by a React Native app. Three
 * languages, three files, one value — and no import can span them, because the Edge Function
 * runs on Deno and cannot reach the pnpm workspace.
 *
 * A drift is silent and expensive. The user accepts version A on S15, submission demands
 * version B, and `submit_registration` returns `incomplete` with `consent` in the missing
 * list — pointing the user back at a screen they have already completed correctly, with
 * nothing on it to fix.
 *
 * This cannot live in `packages/domain`'s test suite: that package has no Node types on
 * purpose, so shared domain code cannot reach the filesystem.
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const failures = [];
const checks = [];

function check(name, condition, detail = '') {
  checks.push(name);
  if (!condition) failures.push(`${name}${detail ? ` — ${detail}` : ''}`);
}

function read(relativePath) {
  return readFileSync(resolve(ROOT, relativePath), 'utf8');
}

function extractVersion(source, where) {
  const match = /CURRENT_POLICY_VERSION\s*=\s*'([^']+)'/.exec(source);
  if (match?.[1] === undefined) {
    failures.push(`could not find CURRENT_POLICY_VERSION in ${where}`);
    return null;
  }
  return match[1];
}

const domainPath = 'packages/domain/src/consent.ts';
const denoPath = 'supabase/functions/_shared/policy.ts';

const domainVersion = extractVersion(read(domainPath), domainPath);
const denoVersion = extractVersion(read(denoPath), denoPath);

check(
  'the app and the Edge Function agree on the current policy version',
  domainVersion !== null && domainVersion === denoVersion,
  `${domainPath} says "${domainVersion}", ${denoPath} says "${denoVersion}"`,
);

check(
  'the policy version is a date, so "newer" is obvious at a glance',
  domainVersion !== null && /^\d{4}-\d{2}-\d{2}$/.test(domainVersion),
  `got "${domainVersion}"`,
);

/**
 * The SQL must take the version as an argument rather than hard-coding one. A hard-coded
 * version in the migration would be a fourth copy — and the only one that cannot be changed
 * without a database deployment.
 */
const submitSql = read('supabase/migrations/20260813000300_submit_registration.sql');

check(
  'submit_registration takes the policy version as an argument',
  /p_policy_version\s+text/.test(submitSql),
  'a hard-coded version in SQL would be a fourth copy, and the hardest one to change',
);

check(
  'submit_registration does not hard-code a version of its own',
  !/'20\d\d-\d\d-\d\d'/.test(submitSql),
);

/**
 * §S15: "Required and optional consent must never be bundled." The SQL checks required
 * policies only; marketing appearing in that loop would make declining it block submission,
 * which is precisely the bundling the specification forbids.
 */
check(
  'the SQL completeness check does not require marketing consent',
  !/'marketing'::public\.consent_policy_type/.test(submitSql),
  'requiring optional consent to submit is the bundling §S15 forbids',
);

for (const policy of ['terms', 'privacy', 'community_guidelines', 'beta_changes']) {
  check(
    `the SQL completeness check requires ${policy}`,
    submitSql.includes(`'${policy}'::public.consent_policy_type`),
  );
}

if (failures.length > 0) {
  console.error('\n✖ consent version verification failed\n');
  for (const failure of failures) console.error(`  - ${failure}`);
  console.error(`\n${checks.length - failures.length}/${checks.length} checks passed\n`);
  process.exit(1);
}

console.log(
  `✔ consent policy version consistent across app, Edge Function and SQL (${checks.length} checks)`,
);
