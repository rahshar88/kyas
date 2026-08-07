#!/usr/bin/env node
/**
 * Structural checks on apps/mobile/eas.json.
 *
 * EAS itself only validates the file when a build is submitted, which needs an account.
 * These checks run everywhere and catch the two mistakes that actually hurt: a profile
 * pointing at the wrong environment (shipping a beta build wired to production Supabase),
 * and a privileged value committed to the repository.
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const EAS_PATH = resolve(HERE, '..', 'apps', 'mobile', 'eas.json');

const raw = readFileSync(EAS_PATH, 'utf8');
const eas = JSON.parse(raw);

const failures = [];
const checks = [];

function check(name, condition, detail = '') {
  checks.push(name);
  if (!condition) failures.push(`${name}${detail ? ` — ${detail}` : ''}`);
}

const PROFILES = ['development', 'beta', 'production'];

check('declares a cli version requirement', typeof eas.cli?.version === 'string');
check(
  'uses remote app version source so build numbers cannot collide',
  eas.cli?.appVersionSource === 'remote',
);

for (const profile of PROFILES) {
  const build = eas.build?.[profile];
  check(`build profile "${profile}" exists`, build !== undefined);
  if (!build) continue;

  check(
    `"${profile}" sets EXPO_PUBLIC_ENVIRONMENT to ${profile}`,
    build.env?.EXPO_PUBLIC_ENVIRONMENT === profile,
    `got "${build.env?.EXPO_PUBLIC_ENVIRONMENT}"`,
  );
  check(`"${profile}" pins an update channel`, typeof build.channel === 'string');
  check(`submit profile "${profile}" exists`, eas.submit?.[profile] !== undefined);
}

// §5.2 — beta and production must stay separable.
check(
  'beta and production use different channels',
  eas.build?.beta?.channel !== eas.build?.production?.channel,
);
check('production distributes to the store', eas.build?.production?.distribution === 'store');
check('beta distributes internally', eas.build?.beta?.distribution === 'internal');
check(
  'development builds a dev client',
  eas.build?.development?.developmentClient === true,
  'Milestone 0 exits on a *development* build opening on device',
);

/**
 * §5.3 / §13.1 — nothing privileged in the repository. Checked against the raw text so a
 * secret nested anywhere in the file is caught, not just the keys we thought to look at.
 */
const FORBIDDEN =
  /SERVICE_ROLE|SECRET|PRIVATE_KEY|PASSWORD|_TOKEN|serviceAccountKeyPath|appleTeamId/i;
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
for (const profile of PROFILES) {
  for (const key of Object.keys(eas.build?.[profile]?.env ?? {})) {
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

console.log(`✔ eas.json verified (${checks.length} checks)`);
