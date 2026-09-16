#!/usr/bin/env node
/**
 * Checks `apps/mobile/eas.json` — structure, secrets, and (the part that matters) whether
 * each build profile can actually produce a valid app config.
 *
 * EAS itself only validates the file once a build is submitted, which needs an account, a
 * queue slot and about twenty minutes. That is the wrong place to discover that a profile is
 * missing a variable.
 *
 * ## Why the environment completeness check exists
 *
 * `.env` is gitignored, so it exists on a developer's machine and does NOT exist on an EAS
 * build server — the server gets a clean checkout and whatever the profile's `env` block
 * supplies. A profile carrying only `EXPO_PUBLIC_ENVIRONMENT` therefore builds fine locally
 * and fails on EAS at the "Read app config" phase, where the CLI reports it as
 * "Unknown error. See logs of the Read app config build phase" — a summary line that names
 * neither the variable nor the file.
 *
 * That is not hypothetical: it burned a real iOS build on 13 August. The structural checks
 * were all green at the time, because none of them asked the only question that mattered.
 *
 * Usage:
 *   node scripts/verify-eas-config.mjs                  all profiles; buildable ones must pass
 *   node scripts/verify-eas-config.mjs --profile beta   strict — that profile MUST be complete
 */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const MOBILE = resolve(HERE, '..', 'apps', 'mobile');
const EAS_PATH = resolve(MOBILE, 'eas.json');

// The same schema app.config.ts uses. Importing it rather than restating the variable list is
// the point: a variable added to the schema is immediately required of every profile here.
const require = createRequire(import.meta.url);
const { parseEnv, EnvValidationError } = require(resolve(MOBILE, 'env.config.js'));

const raw = readFileSync(EAS_PATH, 'utf8');
const eas = JSON.parse(raw);

const argProfile = process.argv.includes('--profile')
  ? process.argv[process.argv.indexOf('--profile') + 1]
  : undefined;

const failures = [];
const checks = [];

function check(name, condition, detail = '') {
  checks.push(name);
  if (!condition) failures.push(`${name}${detail ? ` — ${detail}` : ''}`);
}

/** Every profile a human can actually build. `base` and `dev-environment` are mixins. */
const BUILDABLE = ['development', 'preview', 'beta', 'production'];

/** Which environment each profile is wired to (§5.2 — beta and production stay separable). */
const EXPECTED_ENVIRONMENT = {
  development: 'development',
  preview: 'development',
  beta: 'beta',
  production: 'production',
};

/**
 * Profiles whose environment cannot be complete yet, with the reason.
 *
 * These are not excused — they are *reported*, and `--profile <name>` still fails on them, so
 * attempting the build gets the list of missing variables in a second rather than after a
 * queue. They come off this list when the underlying §22 decisions are made.
 */
const PENDING = {
  beta: 'needs its own Supabase project (§5.2) plus Sentry and analytics keys (§20, §22)',
  production: 'needs its own Supabase project (§5.2) plus Sentry and analytics keys (§20, §22)',
};

if (argProfile !== undefined && !BUILDABLE.includes(argProfile)) {
  console.error(`unknown profile "${argProfile}" — expected one of ${BUILDABLE.join(', ')}`);
  process.exit(2);
}

/** Resolves a profile's `env` through its `extends` chain, the way EAS merges it. */
function resolveEnv(name, seen = new Set()) {
  const profile = eas.build?.[name];
  if (profile === undefined || seen.has(name)) return {};
  seen.add(name);
  const inherited = profile.extends ? resolveEnv(profile.extends, seen) : {};
  return { ...inherited, ...(profile.env ?? {}) };
}

check('declares a cli version requirement', typeof eas.cli?.version === 'string');
check(
  'uses remote app version source so build numbers cannot collide',
  eas.cli?.appVersionSource === 'remote',
);

for (const profile of BUILDABLE) {
  const build = eas.build?.[profile];
  check(`build profile "${profile}" exists`, build !== undefined);
  if (!build) continue;

  const env = resolveEnv(profile);

  check(
    `"${profile}" targets the ${EXPECTED_ENVIRONMENT[profile]} environment`,
    env.EXPO_PUBLIC_ENVIRONMENT === EXPECTED_ENVIRONMENT[profile],
    `got "${env.EXPO_PUBLIC_ENVIRONMENT}"`,
  );
  check(`"${profile}" pins an update channel`, typeof build.channel === 'string');
  check(`submit profile "${profile}" exists`, eas.submit?.[profile] !== undefined);

  /**
   * The check that would have saved the build. A build server has no `.env`, so the profile's
   * own env block is the whole environment — if it does not satisfy the schema, the build
   * cannot read its config no matter what else is right.
   */
  const strict = argProfile === profile || !Object.hasOwn(PENDING, profile);
  let envError;
  try {
    parseEnv(env);
  } catch (error) {
    if (!(error instanceof EnvValidationError)) throw error;
    envError = error;
  }

  if (strict) {
    check(
      `"${profile}" supplies a complete environment for a build server`,
      envError === undefined,
      // Keeps only the "  - KEY: reason" lines from the schema error, dropping its heading
      // and its "copy .env.example" advice, which is wrong guidance for a build server.
      envError && `\n${envError.message.split('\n').slice(2, -3).join('\n')}`,
    );
  } else if (envError !== undefined) {
    console.log(`  … "${profile}" environment incomplete — ${PENDING[profile]}`);
  } else {
    console.log(`  … "${profile}" is now complete and can come off the pending list`);
  }
}

// §5.2 — beta and production must stay separable.
check(
  'beta and production use different channels',
  eas.build?.beta?.channel !== eas.build?.production?.channel,
);
check(
  'preview and beta use different channels',
  eas.build?.preview?.channel !== eas.build?.beta?.channel,
);
check('production distributes to the store', eas.build?.production?.distribution === 'store');
check('beta distributes internally', eas.build?.beta?.distribution === 'internal');
check('preview distributes internally', eas.build?.preview?.distribution === 'internal');
check(
  'preview builds for a real device, not a simulator',
  eas.build?.preview?.ios?.simulator === false,
  'preview is the profile testers install from',
);
check(
  'development builds a dev client',
  eas.build?.development?.developmentClient === true,
  'Milestone 0 exits on a *development* build opening on device',
);

/**
 * §5.3 / §13.1 — nothing privileged in the repository. Checked against the raw text so a
 * secret nested anywhere in the file is caught, not just the keys we thought to look at.
 *
 * `sb_secret_` and the service_role JWT are named explicitly: a Supabase project hands you a
 * publishable key and a secret key side by side, and the secret one bypasses every RLS policy
 * in the schema. Pasting the wrong one into this file is the single most damaging mistake
 * available here, and neither string contains the word "secret" in a form the generic pattern
 * would catch.
 */
const FORBIDDEN =
  /SERVICE_ROLE|SECRET|PRIVATE_KEY|PASSWORD|_TOKEN|serviceAccountKeyPath|appleTeamId|sb_secret_/i;
const offending = raw
  .split('\n')
  .map((line, index) => ({ line: line.trim(), number: index + 1 }))
  .filter(({ line }) => FORBIDDEN.test(line));

check(
  'contains no privileged value',
  offending.length === 0,
  offending.map(({ number, line }) => `line ${number}: ${line}`).join('; '),
);

/** Every non-EXPO_PUBLIC_ env key would be a build-time secret in a committed file. */
for (const profile of Object.keys(eas.build ?? {})) {
  for (const key of Object.keys(eas.build[profile]?.env ?? {})) {
    check(
      `"${profile}" env key ${key} is publishable`,
      key.startsWith('EXPO_PUBLIC_'),
      'privileged values belong in EAS environment variables, not eas.json',
    );
  }
}

if (failures.length > 0) {
  console.error('\n✖ eas.json verification failed\n');
  for (const failure of failures) console.error(`  - ${failure}`);
  console.error(`\n${checks.length - failures.length}/${checks.length} checks passed\n`);
  process.exit(1);
}

console.log(
  `✔ eas.json verified${argProfile ? ` for "${argProfile}"` : ''} (${checks.length} checks)`,
);
